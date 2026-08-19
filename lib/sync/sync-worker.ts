import { SYNC_TABLES, type Id } from "@/drizzle/schema";
import {
  accountHasAnyData,
  applyIncomingRow,
  discardLocalData,
  getDirtyRows,
  markAllDirty,
  markRowsSynced,
  reownLocalData,
} from "@/server/_core/sync-engine";
import {
  adoptAccountIdentity,
  getLocalUserId,
} from "@/server/_core/local-context";
import type { RemoteSyncClient } from "./remote-client";
import { adoptAccountCardKeyForDevice } from "./card-key-sync";
import {
  getLastPulledSeq,
  hasCompletedFirstSync,
  isSyncEnabled,
  markFirstSyncComplete,
  setLastPulledSeq,
} from "./sync-state";

/**
 * local-first-sync-plan.md phase 4: the sync worker. Runs entirely on the
 * client, driven by `RemoteSyncClient` (lib/sync/remote-client.ts) for the
 * network leg and `server/_core/sync-engine.ts` for the local-SQLite leg —
 * the same generic per-table upsert functions the server uses against MySQL,
 * since both sides of a sync are "apply this row into whatever data store I
 * am."
 */
const BATCH_LIMIT = 200;

export type FirstSyncChoice = "keep-phone" | "keep-account" | "merge";

/**
 * "first-sync": this device has never synced before and both it and the
 * account already hold data — the original first-sync-choice case.
 * "stale-cursor": this device *has* synced before, but its pull cursor has
 * fallen behind the tombstone purge watermark (server/_core/sync-engine.ts's
 * getPurgeWatermark) — it can no longer trust an incremental pull to have
 * carried every deletion, so it's treated the same way, just with a
 * different (and more consequential — "keep phone's" here can discard other
 * devices' contributions) prompt.
 */
export type SyncChoiceReason = "first-sync" | "stale-cursor";

export type SyncOutcome =
  | { status: "disabled" }
  | { status: "needs-first-sync-choice"; reason: SyncChoiceReason }
  | { status: "synced"; pushed: number; pulled: number };

async function reconcileFirstSync(
  client: RemoteSyncClient,
  accountUserId: Id,
): Promise<"resolved" | "needs-choice"> {
  if (await hasCompletedFirstSync()) return "resolved";

  const localUserId = await getLocalUserId();
  const [localHasData, accountHasData] = await Promise.all([
    accountHasAnyData(SYNC_TABLES, localUserId),
    client.sync.accountHasData.query(),
  ]);

  if (localHasData && accountHasData) {
    return "needs-choice";
  }
  if (localHasData && !accountHasData) {
    // Nothing to conflict with — this is implicitly "keep the phone's data".
    await reownLocalData(SYNC_TABLES, localUserId, accountUserId);
  }
  // Neither has data, or only the account does: nothing to reown; the
  // normal pull phase below brings the account's data down if any exists.
  await adoptAccountIdentity(accountUserId);
  await adoptAccountCardKeyForDevice(client, accountUserId);
  await markFirstSyncComplete();
  return "resolved";
}

/**
 * Resolves the prompt `runSync` returns `needs-first-sync-choice` for.
 * "keep-phone" wipes the account's existing data first (reusing the same
 * tombstone-everything the Settings "Clear all data" action uses) then
 * re-owns and pushes the phone's data; "keep-account" discards the phone's
 * pre-sync rows outright (they were never shared with anything, so a hard
 * delete is correct, not a tombstone); "merge" re-owns the phone's rows
 * alongside whatever the account already has — local-first-sync-plan.md's
 * documented duplicate-row caveat applies.
 */
export async function resolveFirstSync(
  client: RemoteSyncClient,
  choice: FirstSyncChoice,
  accountUserId: Id,
): Promise<void> {
  const localUserId = await getLocalUserId();

  if (choice === "keep-account") {
    await discardLocalData(SYNC_TABLES, localUserId);
  } else if (choice === "keep-phone") {
    await client.data.clearAll.mutate();
    await reownLocalData(SYNC_TABLES, localUserId, accountUserId);
  } else {
    await reownLocalData(SYNC_TABLES, localUserId, accountUserId);
  }

  // Every branch above, "keep-account" included, leaves this device reading
  // and writing under the account's id from here on — and encrypting card
  // numbers under the account's key rather than its own, so a card entered
  // on this phone is readable on every other device on the account.
  await adoptAccountIdentity(accountUserId);
  await adoptAccountCardKeyForDevice(client, accountUserId);
  await markFirstSyncComplete();
}

/**
 * Resolves a `reason: "stale-cursor"` prompt. Unlike `resolveFirstSync`,
 * this device's local rows are already owned by the account (a previous
 * sync re-owned them), so there is nothing to re-own here — only whichever
 * side needs discarding, plus resetting the pull cursor to 0 so the normal
 * pull phase that follows re-fetches the account's current data from
 * scratch instead of resuming from a cursor that can no longer be trusted.
 * "merge" needs no local mutation at all: the reset cursor and the
 * push-then-pull that follows already reconcile both sides row by row via
 * `applyIncomingRow`'s last-write-wins.
 */
export async function resolveStaleCursor(
  client: RemoteSyncClient,
  choice: FirstSyncChoice,
  accountUserId: Id,
): Promise<void> {
  if (choice === "keep-account") {
    await discardLocalData(SYNC_TABLES, accountUserId);
  } else if (choice === "keep-phone") {
    await client.data.clearAll.mutate();
    await markAllDirty(SYNC_TABLES, accountUserId);
  }
  await setLastPulledSeq(0);
}

async function pushAll(
  client: RemoteSyncClient,
  accountUserId: Id,
): Promise<number> {
  let pushed = 0;
  for (const table of SYNC_TABLES) {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const dirty = await getDirtyRows(table, accountUserId, BATCH_LIMIT);
      if (dirty.length === 0) break;

      const results = await client.sync.push.mutate({ table, rows: dirty });
      await markRowsSynced(table, results);
      pushed += dirty.length;

      if (dirty.length < BATCH_LIMIT) break;
    }
  }
  return pushed;
}

/**
 * The cursor advances to the server's head-of-sequence *as it was when this
 * cycle started*, not to the highest seq the cycle happened to see. The
 * tables are pulled one after another, so a row written to an
 * already-pulled table while a later table is still being pulled carries a
 * seq below the cycle's high-water mark — advancing to that mark would step
 * straight over it and never fetch it again. Anything written during the
 * cycle sorts above the head read up front, so the next cycle collects it.
 */
async function pullAll(client: RemoteSyncClient): Promise<number> {
  let pulled = 0;
  const cursor = await getLastPulledSeq();
  const headSeq = await client.sync.getHeadSeq.query();

  for (const table of SYNC_TABLES) {
    let sinceSeq = cursor;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const rows = await client.sync.pull.query({ table, sinceSeq });
      if (rows.length === 0) break;

      for (const row of rows) {
        await applyIncomingRow(table, row);
        const seq = row.serverSeq as number;
        if (seq > sinceSeq) sinceSeq = seq;
      }
      pulled += rows.length;

      if (rows.length < BATCH_LIMIT) break;
    }
  }

  // Never move the cursor backwards: a head read that somehow lags the
  // cursor (a restored server snapshot, say) must not re-open a window
  // this device has already closed.
  if (headSeq > cursor) await setLastPulledSeq(headSeq);
  return pulled;
}

/**
 * Runs one full sync cycle: reconcile first-sync state if needed, push this
 * device's dirty rows, then pull whatever the account has that this device
 * doesn't. Push-before-pull means a row this device just edited always wins
 * its own round-trip instead of being immediately overwritten by a pull of
 * its own pre-push server copy.
 */
export async function runSync(
  client: RemoteSyncClient,
  accountUserId: Id,
): Promise<SyncOutcome> {
  if (!(await isSyncEnabled())) {
    return { status: "disabled" };
  }

  const firstSyncDone = await hasCompletedFirstSync();
  if (!firstSyncDone) {
    const reconciled = await reconcileFirstSync(client, accountUserId);
    if (reconciled === "needs-choice") {
      return { status: "needs-first-sync-choice", reason: "first-sync" };
    }
  } else {
    const [purgedUpToSeq, lastPulledSeq] = await Promise.all([
      client.sync.getPurgeWatermark.query(),
      getLastPulledSeq(),
    ]);
    // `lastPulledSeq > 0` is what makes this resolvable. Answering the
    // stale-cursor prompt resets the cursor to 0 so the next pull re-fetches
    // the account from scratch — but 0 is below every watermark, so without
    // this guard the very next cycle re-detects "stale" and prompts again,
    // forever. A device that hits a purge watermark could never sync again,
    // and no amount of choosing an option got it out. A cursor of 0 is not a
    // stale incremental cursor: it means a full resync is in progress, which
    // cannot miss a purged deletion the way resuming from a stale point can.
    if (lastPulledSeq > 0 && lastPulledSeq < purgedUpToSeq) {
      return { status: "needs-first-sync-choice", reason: "stale-cursor" };
    }
  }

  const pushed = await pushAll(client, accountUserId);
  const pulled = await pullAll(client);

  return { status: "synced", pushed, pulled };
}

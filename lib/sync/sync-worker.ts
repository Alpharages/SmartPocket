import { SYNC_TABLES, type Id } from "@/drizzle/schema";
import {
  accountHasAnyData,
  applyIncomingRow,
  discardLocalData,
  getDirtyRows,
  markRowsSynced,
  reownLocalData,
} from "@/server/_core/sync-engine";
import { getLocalUserId } from "@/server/_core/local-context";
import type { RemoteSyncClient } from "./remote-client";
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

export type SyncOutcome =
  | { status: "disabled" }
  | { status: "needs-first-sync-choice" }
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

  await markFirstSyncComplete();
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

async function pullAll(client: RemoteSyncClient): Promise<number> {
  let pulled = 0;
  let cursor = await getLastPulledSeq();
  let maxSeenSeq = cursor;

  for (const table of SYNC_TABLES) {
    let sinceSeq = cursor;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const rows = await client.sync.pull.query({ table, sinceSeq });
      if (rows.length === 0) break;

      for (const row of rows) {
        await applyIncomingRow(table, row);
        const seq = row.serverSeq as number;
        if (seq > maxSeenSeq) maxSeenSeq = seq;
        if (seq > sinceSeq) sinceSeq = seq;
      }
      pulled += rows.length;

      if (rows.length < BATCH_LIMIT) break;
    }
  }

  await setLastPulledSeq(maxSeenSeq);
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

  const reconciled = await reconcileFirstSync(client, accountUserId);
  if (reconciled === "needs-choice") {
    return { status: "needs-first-sync-choice" };
  }

  const pushed = await pushAll(client, accountUserId);
  const pulled = await pullAll(client);

  return { status: "synced", pushed, pulled };
}

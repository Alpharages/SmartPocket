import { beforeEach, describe, expect, it, vi } from "vitest";
import { testId } from "./helpers/ids";

const syncEngine = vi.hoisted(() => ({
  accountHasAnyData: vi.fn(),
  applyIncomingRow: vi.fn(),
  discardLocalData: vi.fn(),
  getDirtyRows: vi.fn(),
  markAllDirty: vi.fn(),
  markRowsSynced: vi.fn(),
  reownLocalData: vi.fn(),
}));
vi.mock("@/server/_core/sync-engine", () => syncEngine);

// The card-key adoption pass is expo-secure-store backed and has its own
// coverage (tests/card-key-sync.test.ts); here it is just another thing first
// sync does exactly once.
const cardKeySync = vi.hoisted(() => ({
  adoptAccountCardKeyForDevice: vi.fn(async () => null),
}));
vi.mock("@/lib/sync/card-key-sync", () => cardKeySync);

const localContext = vi.hoisted(() => ({
  getLocalUserId: vi.fn(),
  adoptAccountIdentity: vi.fn(),
}));
vi.mock("@/server/_core/local-context", () => localContext);

const syncState = vi.hoisted(() => ({
  isSyncEnabled: vi.fn(),
  hasCompletedFirstSync: vi.fn(),
  markFirstSyncComplete: vi.fn(),
  getLastPulledSeq: vi.fn(),
  setLastPulledSeq: vi.fn(),
}));
vi.mock("@/lib/sync/sync-state", () => syncState);

function fakeClient() {
  return {
    sync: {
      push: { mutate: vi.fn().mockResolvedValue([]) },
      pull: { query: vi.fn().mockResolvedValue([]) },
      accountHasData: { query: vi.fn().mockResolvedValue(false) },
      getPurgeWatermark: { query: vi.fn().mockResolvedValue(0) },
      getHeadSeq: { query: vi.fn().mockResolvedValue(0) },
    },
    data: {
      clearAll: { mutate: vi.fn().mockResolvedValue(undefined) },
    },
  };
}

const localUserId = testId(1);
const accountUserId = testId(2);

describe("runSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    syncState.isSyncEnabled.mockResolvedValue(true);
    syncState.hasCompletedFirstSync.mockResolvedValue(true);
    syncState.getLastPulledSeq.mockResolvedValue(0);
    localContext.getLocalUserId.mockResolvedValue(localUserId);
    syncEngine.getDirtyRows.mockResolvedValue([]);
  });

  it("does nothing when sync is disabled", async () => {
    syncState.isSyncEnabled.mockResolvedValue(false);
    const { runSync } = await import("@/lib/sync/sync-worker");
    const client = fakeClient();

    const outcome = await runSync(client as never, accountUserId);

    expect(outcome).toEqual({ status: "disabled" });
    expect(client.sync.push.mutate).not.toHaveBeenCalled();
    expect(client.sync.pull.query).not.toHaveBeenCalled();
  });

  it("pushes every table's dirty rows, marks them synced, then pulls and applies incoming rows", async () => {
    const { runSync } = await import("@/lib/sync/sync-worker");
    const client = fakeClient();

    const dirtyRow = { id: testId(10), name: "Groceries" };
    syncEngine.getDirtyRows.mockImplementation(async (table: string) =>
      table === "categories" ? [dirtyRow] : [],
    );
    client.sync.push.mutate.mockResolvedValue([
      { id: testId(10), serverSeq: 5 },
    ]);

    const pulledRow = { id: testId(20), serverSeq: 7 };
    client.sync.pull.query.mockImplementation(
      async ({ table }: { table: string }) =>
        table === "categories" ? [pulledRow] : [],
    );
    client.sync.getHeadSeq.query.mockResolvedValue(7);

    const outcome = await runSync(client as never, accountUserId);

    expect(outcome).toEqual({ status: "synced", pushed: 1, pulled: 1 });
    expect(client.sync.push.mutate).toHaveBeenCalledWith({
      table: "categories",
      rows: [dirtyRow],
    });
    expect(syncEngine.markRowsSynced).toHaveBeenCalledWith("categories", [
      { id: testId(10), serverSeq: 5 },
    ]);
    expect(syncEngine.applyIncomingRow).toHaveBeenCalledWith(
      "categories",
      pulledRow,
    );
    expect(syncState.setLastPulledSeq).toHaveBeenCalledWith(7);
  });

  // The cursor tracks the server's head-of-sequence as of the *start* of the
  // cycle, not the highest seq the cycle happened to see. Tables are pulled
  // one after another, so a row written to an already-pulled table while a
  // later table is still being pulled carries a seq below the cycle's
  // high-water mark — advancing to that mark would step over it forever.
  it("does not advance the cursor past rows written mid-cycle to an already-pulled table", async () => {
    const { runSync } = await import("@/lib/sync/sync-worker");
    const client = fakeClient();

    // The head as this cycle begins. The row at seq 40 below lands *after*
    // this point, in a table the cycle has already walked past.
    client.sync.getHeadSeq.query.mockResolvedValue(10);
    client.sync.pull.query.mockImplementation(
      async ({ table, sinceSeq }: { table: string; sinceSeq: number }) => {
        if (table === "categories" && sinceSeq < 10) {
          return [{ id: testId(20), serverSeq: 10 }];
        }
        // A far-later table in SYNC_TABLES order returns a much higher seq.
        if (table === "transactions" && sinceSeq < 40) {
          return [{ id: testId(21), serverSeq: 40 }];
        }
        return [];
      },
    );

    await runSync(client as never, accountUserId);

    // 40 was seen, but only 10 is safe to claim: anything the account wrote
    // to `categories` between seq 11 and 40 has not been pulled.
    expect(syncState.setLastPulledSeq).toHaveBeenCalledWith(10);
    expect(syncState.setLastPulledSeq).not.toHaveBeenCalledWith(40);
  });

  it("reports needs-first-sync-choice when both the phone and the account already hold data", async () => {
    syncState.hasCompletedFirstSync.mockResolvedValue(false);
    syncEngine.accountHasAnyData.mockResolvedValue(true); // local has data
    const { runSync } = await import("@/lib/sync/sync-worker");
    const client = fakeClient();
    client.sync.accountHasData.query.mockResolvedValue(true); // account has data too

    const outcome = await runSync(client as never, accountUserId);

    expect(outcome).toEqual({
      status: "needs-first-sync-choice",
      reason: "first-sync",
    });
    expect(syncEngine.reownLocalData).not.toHaveBeenCalled();
    expect(syncState.markFirstSyncComplete).not.toHaveBeenCalled();
    expect(client.sync.push.mutate).not.toHaveBeenCalled();
  });

  it("silently re-owns local data as the account's when only the phone has data (no ambiguity to prompt)", async () => {
    syncState.hasCompletedFirstSync.mockResolvedValue(false);
    syncEngine.accountHasAnyData.mockResolvedValue(true);
    const { runSync } = await import("@/lib/sync/sync-worker");
    const client = fakeClient();
    client.sync.accountHasData.query.mockResolvedValue(false);

    const outcome = await runSync(client as never, accountUserId);

    expect(syncEngine.reownLocalData).toHaveBeenCalledWith(
      expect.arrayContaining(["categories"]),
      localUserId,
      accountUserId,
    );
    expect(syncState.markFirstSyncComplete).toHaveBeenCalledTimes(1);
    expect(outcome.status).toBe("synced");
  });

  it("does nothing to reconcile when neither side has data yet", async () => {
    syncState.hasCompletedFirstSync.mockResolvedValue(false);
    syncEngine.accountHasAnyData.mockResolvedValue(false);
    const { runSync } = await import("@/lib/sync/sync-worker");
    const client = fakeClient();
    client.sync.accountHasData.query.mockResolvedValue(false);

    const outcome = await runSync(client as never, accountUserId);

    expect(syncEngine.reownLocalData).not.toHaveBeenCalled();
    expect(syncEngine.discardLocalData).not.toHaveBeenCalled();
    expect(syncState.markFirstSyncComplete).toHaveBeenCalledTimes(1);
    expect(outcome.status).toBe("synced");
  });

  it("paginates a push batch larger than the page size until fully drained", async () => {
    const { runSync } = await import("@/lib/sync/sync-worker");
    const client = fakeClient();

    const bigBatch = Array.from({ length: 200 }, (_, i) => ({
      id: testId(i + 1),
    }));
    syncEngine.getDirtyRows
      .mockImplementationOnce(async () => bigBatch) // categories, first page: full page
      .mockImplementationOnce(async () => []) // categories, second page: empty -> stop
      .mockImplementation(async () => []); // every other table: nothing
    client.sync.push.mutate.mockResolvedValue(
      bigBatch.map((r) => ({ id: r.id, serverSeq: 1 })),
    );
    client.sync.pull.query.mockResolvedValue([]);

    const outcome = await runSync(client as never, accountUserId);

    expect(outcome).toEqual({ status: "synced", pushed: 200, pulled: 0 });
    expect(client.sync.push.mutate).toHaveBeenCalledTimes(1);
  });

  // Answering the stale-cursor prompt resets the cursor to 0. That is below
  // every watermark, so re-checking naively re-prompts on the very next
  // cycle — a device that hit a purge watermark could never sync again, and
  // choosing an option never got it out. Caught on a real device.
  it("does not re-prompt stale-cursor once the cursor has been reset for a full resync", async () => {
    syncState.getLastPulledSeq.mockResolvedValue(0);
    const { runSync } = await import("@/lib/sync/sync-worker");
    const client = fakeClient();
    client.sync.getPurgeWatermark.query.mockResolvedValue(500);

    const outcome = await runSync(client as never, accountUserId);

    expect(outcome.status).toBe("synced");
  });

  it("reports needs-first-sync-choice with reason stale-cursor when the pull cursor is behind the purge watermark", async () => {
    syncState.getLastPulledSeq.mockResolvedValue(10);
    const { runSync } = await import("@/lib/sync/sync-worker");
    const client = fakeClient();
    client.sync.getPurgeWatermark.query.mockResolvedValue(50);

    const outcome = await runSync(client as never, accountUserId);

    expect(outcome).toEqual({
      status: "needs-first-sync-choice",
      reason: "stale-cursor",
    });
    expect(client.sync.push.mutate).not.toHaveBeenCalled();
    expect(client.sync.pull.query).not.toHaveBeenCalled();
  });

  it("proceeds normally when the pull cursor is at or ahead of the purge watermark", async () => {
    syncState.getLastPulledSeq.mockResolvedValue(50);
    const { runSync } = await import("@/lib/sync/sync-worker");
    const client = fakeClient();
    client.sync.getPurgeWatermark.query.mockResolvedValue(50);

    const outcome = await runSync(client as never, accountUserId);

    expect(outcome).toEqual({ status: "synced", pushed: 0, pulled: 0 });
  });

  it("never checks the purge watermark before the first sync has completed (reconciliation is the only gate)", async () => {
    syncState.hasCompletedFirstSync.mockResolvedValue(false);
    syncEngine.accountHasAnyData.mockResolvedValue(false);
    const { runSync } = await import("@/lib/sync/sync-worker");
    const client = fakeClient();

    await runSync(client as never, accountUserId);

    expect(client.sync.getPurgeWatermark.query).not.toHaveBeenCalled();
  });
});

describe("resolveStaleCursor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keep-account: discards this device's copy of the account's data and resets the cursor", async () => {
    const { resolveStaleCursor } = await import("@/lib/sync/sync-worker");
    const client = fakeClient();

    await resolveStaleCursor(client as never, "keep-account", accountUserId);

    expect(syncEngine.discardLocalData).toHaveBeenCalledWith(
      expect.arrayContaining(["categories"]),
      accountUserId,
    );
    expect(syncEngine.markAllDirty).not.toHaveBeenCalled();
    expect(client.data.clearAll.mutate).not.toHaveBeenCalled();
    expect(syncState.setLastPulledSeq).toHaveBeenCalledWith(0);
  });

  it("keep-phone: wipes the account's current data, marks every local row dirty again, and resets the cursor", async () => {
    const { resolveStaleCursor } = await import("@/lib/sync/sync-worker");
    const client = fakeClient();

    await resolveStaleCursor(client as never, "keep-phone", accountUserId);

    expect(client.data.clearAll.mutate).toHaveBeenCalledTimes(1);
    expect(syncEngine.markAllDirty).toHaveBeenCalledWith(
      expect.arrayContaining(["categories"]),
      accountUserId,
    );
    expect(syncEngine.discardLocalData).not.toHaveBeenCalled();
    expect(syncState.setLastPulledSeq).toHaveBeenCalledWith(0);
  });

  it("merge: touches nothing locally except resetting the cursor for a full reconciling pull", async () => {
    const { resolveStaleCursor } = await import("@/lib/sync/sync-worker");
    const client = fakeClient();

    await resolveStaleCursor(client as never, "merge", accountUserId);

    expect(client.data.clearAll.mutate).not.toHaveBeenCalled();
    expect(syncEngine.markAllDirty).not.toHaveBeenCalled();
    expect(syncEngine.discardLocalData).not.toHaveBeenCalled();
    expect(syncState.setLastPulledSeq).toHaveBeenCalledWith(0);
  });
});

describe("resolveFirstSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localContext.getLocalUserId.mockResolvedValue(localUserId);
  });

  it("keep-account: hard-discards the phone's local data and never touches the account", async () => {
    const { resolveFirstSync } = await import("@/lib/sync/sync-worker");
    const client = fakeClient();

    await resolveFirstSync(client as never, "keep-account", accountUserId);

    expect(syncEngine.discardLocalData).toHaveBeenCalledWith(
      expect.arrayContaining(["categories"]),
      localUserId,
    );
    expect(syncEngine.reownLocalData).not.toHaveBeenCalled();
    expect(client.data.clearAll.mutate).not.toHaveBeenCalled();
    expect(syncState.markFirstSyncComplete).toHaveBeenCalledTimes(1);
  });

  it("keep-phone: wipes the account's existing data first, then re-owns and keeps the phone's", async () => {
    const { resolveFirstSync } = await import("@/lib/sync/sync-worker");
    const client = fakeClient();

    await resolveFirstSync(client as never, "keep-phone", accountUserId);

    expect(client.data.clearAll.mutate).toHaveBeenCalledTimes(1);
    expect(syncEngine.reownLocalData).toHaveBeenCalledWith(
      expect.arrayContaining(["categories"]),
      localUserId,
      accountUserId,
    );
    expect(syncEngine.discardLocalData).not.toHaveBeenCalled();
  });

  it("merge: re-owns the phone's data without touching the account's existing rows", async () => {
    const { resolveFirstSync } = await import("@/lib/sync/sync-worker");
    const client = fakeClient();

    await resolveFirstSync(client as never, "merge", accountUserId);

    expect(syncEngine.reownLocalData).toHaveBeenCalledWith(
      expect.arrayContaining(["categories"]),
      localUserId,
      accountUserId,
    );
    expect(client.data.clearAll.mutate).not.toHaveBeenCalled();
    expect(syncEngine.discardLocalData).not.toHaveBeenCalled();
  });
});

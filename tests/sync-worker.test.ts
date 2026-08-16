import { beforeEach, describe, expect, it, vi } from "vitest";
import { testId } from "./helpers/ids";

const syncEngine = vi.hoisted(() => ({
  accountHasAnyData: vi.fn(),
  applyIncomingRow: vi.fn(),
  discardLocalData: vi.fn(),
  getDirtyRows: vi.fn(),
  markRowsSynced: vi.fn(),
  reownLocalData: vi.fn(),
}));
vi.mock("@/server/_core/sync-engine", () => syncEngine);

const localContext = vi.hoisted(() => ({
  getLocalUserId: vi.fn(),
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

  it("reports needs-first-sync-choice when both the phone and the account already hold data", async () => {
    syncState.hasCompletedFirstSync.mockResolvedValue(false);
    syncEngine.accountHasAnyData.mockResolvedValue(true); // local has data
    const { runSync } = await import("@/lib/sync/sync-worker");
    const client = fakeClient();
    client.sync.accountHasData.query.mockResolvedValue(true); // account has data too

    const outcome = await runSync(client as never, accountUserId);

    expect(outcome).toEqual({ status: "needs-first-sync-choice" });
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

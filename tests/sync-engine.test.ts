import { beforeEach, describe, expect, it, vi } from "vitest";
import { testId } from "./helpers/ids";
import { SYNC_TABLES } from "@/drizzle/schema";

const callDataApi = vi.hoisted(() => vi.fn());
vi.mock("@/server/_core/dataApi", () => ({
  callDataApi: (...args: unknown[]) => callDataApi(...args),
}));

describe("sync-engine push mechanics (mocked MySQL — insertId-driven block allocation)", () => {
  beforeEach(() => {
    callDataApi.mockReset();
  });

  it("allocateServerSeqBlock inserts N blank rows and returns the first assigned id", async () => {
    callDataApi.mockResolvedValueOnce({ insertId: 42, affectedRows: 3 });
    const { allocateServerSeqBlock } =
      await import("@/server/_core/sync-engine");

    const first = await allocateServerSeqBlock(3);

    expect(first).toBe(42);
    const [, opts] = callDataApi.mock.calls[0];
    expect((opts as { body: { query: string } }).body.query).toMatch(
      /INSERT INTO syncSequence \(createdAt\) VALUES \(NOW\(\)\), \(NOW\(\)\), \(NOW\(\)\)/,
    );
  });

  it("allocateServerSeqBlock is a no-op for zero rows", async () => {
    const { allocateServerSeqBlock } =
      await import("@/server/_core/sync-engine");
    expect(await allocateServerSeqBlock(0)).toBe(0);
    expect(callDataApi).not.toHaveBeenCalled();
  });

  it("allocateServerSeqBlock throws if the insert reports no insertId", async () => {
    callDataApi.mockResolvedValueOnce({ insertId: 0 });
    const { allocateServerSeqBlock } =
      await import("@/server/_core/sync-engine");
    await expect(allocateServerSeqBlock(1)).rejects.toThrow(
      /Failed to allocate a serverSeq block/,
    );
  });

  it("applyPushedRows forces userId to the caller's account, ignores the row's own dirty/serverSeq, and assigns a contiguous block", async () => {
    callDataApi
      .mockResolvedValueOnce({ insertId: 100, affectedRows: 2 }) // allocateServerSeqBlock
      .mockResolvedValueOnce(undefined) // row 1 upsert
      .mockResolvedValueOnce(undefined); // row 2 upsert

    const { applyPushedRows } = await import("@/server/_core/sync-engine");
    const rows = [
      {
        id: testId(1),
        userId: "some-forged-user-id",
        name: "Groceries",
        dirty: true,
        serverSeq: null,
      },
      {
        id: testId(2),
        userId: "some-forged-user-id",
        name: "Rent",
        dirty: true,
        serverSeq: null,
      },
    ];

    const results = await applyPushedRows(
      "categories",
      testId(9) /* the real, authenticated account id */,
      rows,
    );

    expect(results).toEqual([
      { id: testId(1), serverSeq: 100 },
      { id: testId(2), serverSeq: 101 },
    ]);

    // Row 1's insert: userId is the authenticated caller, not the forged value.
    const row1Call = callDataApi.mock.calls[1][1] as {
      body: { query: string; params: unknown[] };
    };
    expect(row1Call.body.query).toMatch(/INSERT INTO categories/);
    const columns = row1Call.body.query
      .match(/INSERT INTO categories \(([^)]+)\)/)![1]
      .split(",")
      .map((c) => c.trim());
    const userIdIndex = columns.indexOf("userId");
    const dirtyIndex = columns.indexOf("dirty");
    const serverSeqIndex = columns.indexOf("serverSeq");
    expect(row1Call.body.params[userIdIndex]).toBe(testId(9));
    expect(row1Call.body.params[dirtyIndex]).toBe(false);
    expect(row1Call.body.params[serverSeqIndex]).toBe(100);
  });

  it("applyPushedRows is a no-op for an empty batch", async () => {
    const { applyPushedRows } = await import("@/server/_core/sync-engine");
    expect(await applyPushedRows("categories", testId(1), [])).toEqual([]);
    expect(callDataApi).not.toHaveBeenCalled();
  });
});

describe("sync-engine against real SQLite (the device-side operations)", () => {
  beforeEach(async () => {
    vi.resetModules();
    callDataApi.mockReset();
    const { createNodeSqliteDriver } =
      await import("@/server/_core/sqlite-node-driver");
    const { runMigrations, createSqliteDataApi } =
      await import("@/server/_core/sqlite-engine");
    const driver = createNodeSqliteDriver();
    await runMigrations(driver);
    vi.doMock("@/server/_core/dataApi", () => ({
      callDataApi: createSqliteDataApi(driver),
    }));
  });

  it("getDirtyRows returns only this user's dirty rows, oldest first", async () => {
    const db = await import("@/server/db");
    const { getDirtyRows } = await import("@/server/_core/sync-engine");
    const userId = testId(1);
    const otherUserId = testId(2);

    const catA = await db.createCategory({
      userId,
      name: "A",
      type: "expense",
      color: "#111111",
      icon: "cart",
      isDefault: false,
    });
    await db.createCategory({
      userId: otherUserId,
      name: "Not mine",
      type: "expense",
      color: "#222222",
      icon: "cart",
      isDefault: false,
    });
    const catB = await db.createCategory({
      userId,
      name: "B",
      type: "expense",
      color: "#333333",
      icon: "cart",
      isDefault: false,
    });
    // Mark one clean — it should drop out of the dirty set.
    const clean = await db.createCategory({
      userId,
      name: "Clean",
      type: "expense",
      color: "#444444",
      icon: "cart",
      isDefault: false,
    });
    const { markRowsSynced } = await import("@/server/_core/sync-engine");
    await markRowsSynced("categories", [{ id: clean, serverSeq: 5 }]);

    const dirty = await getDirtyRows("categories", userId);
    expect(dirty.map((r) => r.id)).toEqual([catA, catB]);
  });

  it("applyIncomingRow inserts a brand-new row and clears dirty", async () => {
    const { applyIncomingRow } = await import("@/server/_core/sync-engine");
    const userId = testId(1);
    const incoming = {
      id: testId(5),
      userId,
      name: "Pulled Category",
      type: "expense",
      color: "#123456",
      icon: "cart",
      isDefault: false,
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
      updatedAt: new Date("2026-06-01T00:00:00.000Z"),
      deletedAt: null,
      dirty: false,
      serverSeq: 7,
    };

    const outcome = await applyIncomingRow("categories", incoming);
    expect(outcome).toBe("applied");

    const db = await import("@/server/db");
    const stored = await db.getCategoryById(testId(5), userId);
    expect(stored).toMatchObject({ name: "Pulled Category", serverSeq: 7 });
  });

  it("applyIncomingRow keeps a locally-newer dirty edit instead of clobbering it (last-write-wins)", async () => {
    const db = await import("@/server/db");
    const { applyIncomingRow } = await import("@/server/_core/sync-engine");
    const userId = testId(1);

    const id = await db.createCategory({
      userId,
      name: "Local Edit",
      type: "expense",
      color: "#111111",
      icon: "cart",
      isDefault: false,
    });
    const local = await db.getCategoryById(id, userId);

    const staleIncoming = {
      ...local,
      name: "Stale Remote Value",
      updatedAt: new Date(local!.updatedAt.getTime() - 60_000), // older
      dirty: false,
      serverSeq: 3,
    };

    const outcome = await applyIncomingRow("categories", staleIncoming);
    expect(outcome).toBe("skipped-local-newer");

    const stillLocal = await db.getCategoryById(id, userId);
    expect(stillLocal?.name).toBe("Local Edit");
  });

  it("applyIncomingRow overwrites when the incoming row is newer", async () => {
    const db = await import("@/server/db");
    const { applyIncomingRow } = await import("@/server/_core/sync-engine");
    const userId = testId(1);

    const id = await db.createCategory({
      userId,
      name: "Old Local Value",
      type: "expense",
      color: "#111111",
      icon: "cart",
      isDefault: false,
    });
    const local = await db.getCategoryById(id, userId);

    const newerIncoming = {
      ...local,
      name: "Newer Remote Value",
      updatedAt: new Date(local!.updatedAt.getTime() + 60_000),
      dirty: false,
      serverSeq: 9,
    };

    const outcome = await applyIncomingRow("categories", newerIncoming);
    expect(outcome).toBe("applied");

    const updated = await db.getCategoryById(id, userId);
    expect(updated?.name).toBe("Newer Remote Value");
  });

  it("reownLocalData rewrites userId and marks rows dirty across every synced table", async () => {
    const db = await import("@/server/db");
    const { reownLocalData, getDirtyRows } =
      await import("@/server/_core/sync-engine");
    const localUserId = testId(1);
    const accountUserId = testId(2);

    const catId = await db.createCategory({
      userId: localUserId,
      name: "Groceries",
      type: "expense",
      color: "#111111",
      icon: "cart",
      isDefault: false,
    });
    await db.updateCategory(catId, localUserId, {}); // no-op edit; irrelevant here
    // Clear dirty first so reown's own write is the thing we're asserting on.
    const { markRowsSynced } = await import("@/server/_core/sync-engine");
    await markRowsSynced("categories", [{ id: catId, serverSeq: 1 }]);

    await reownLocalData(SYNC_TABLES, localUserId, accountUserId);

    const underOldOwner = await db.getUserCategories(localUserId);
    expect(underOldOwner).toEqual([]);

    const dirtyForAccount = await getDirtyRows("categories", accountUserId);
    expect(dirtyForAccount.map((r) => r.id)).toEqual([catId]);
  });

  it("discardLocalData hard-deletes every row for that user across every synced table", async () => {
    const db = await import("@/server/db");
    const { discardLocalData } = await import("@/server/_core/sync-engine");
    const userId = testId(1);

    await db.createCategory({
      userId,
      name: "Groceries",
      type: "expense",
      color: "#111111",
      icon: "cart",
      isDefault: false,
    });

    await discardLocalData(SYNC_TABLES, userId);

    expect(await db.getUserCategories(userId)).toEqual([]);
  });

  it("accountHasAnyData ignores tombstoned rows and only reports live data", async () => {
    const db = await import("@/server/db");
    const { accountHasAnyData } = await import("@/server/_core/sync-engine");
    const userId = testId(1);

    expect(await accountHasAnyData(SYNC_TABLES, userId)).toBe(false);

    const catId = await db.createCategory({
      userId,
      name: "Groceries",
      type: "expense",
      color: "#111111",
      icon: "cart",
      isDefault: false,
    });
    expect(await accountHasAnyData(SYNC_TABLES, userId)).toBe(true);

    await db.deleteCategory(catId, userId);
    expect(await accountHasAnyData(SYNC_TABLES, userId)).toBe(false);
  });
});

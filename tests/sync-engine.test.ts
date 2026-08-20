import { beforeEach, describe, expect, it, vi } from "vitest";
import { testId } from "./helpers/ids";
import { SYNC_TABLES } from "@/drizzle/schema";

/**
 * The old envelope shape, rebuilt from the (sql, params) argument pair so these
 * assertions keep reading as "what statement, with what values".
 */
function bodyOf(call: unknown[]) {
  return { query: String(call[0]), params: (call[1] ?? []) as unknown[] };
}

const dbQuery = vi.hoisted(() => vi.fn());
vi.mock("@/server/_core/db-query", () => ({
  dbQuery: (...args: unknown[]) => dbQuery(...args),
}));

describe("sync-engine push mechanics (mocked MySQL — insertId-driven block allocation)", () => {
  beforeEach(() => {
    dbQuery.mockReset();
  });

  it("allocateServerSeqBlock inserts N blank rows and returns the first assigned id", async () => {
    dbQuery.mockResolvedValueOnce({ insertId: 42, affectedRows: 3 });
    const { allocateServerSeqBlock } =
      await import("@/server/_core/sync-engine");

    const first = await allocateServerSeqBlock(3);

    expect(first).toBe(42);
    const [sql] = dbQuery.mock.calls[0];
    expect(sql as string).toMatch(
      /INSERT INTO syncSequence \(createdAt\) VALUES \(NOW\(\)\), \(NOW\(\)\), \(NOW\(\)\)/,
    );
  });

  /**
   * The web client writes straight to MySQL and never pushes, so its edits
   * carry whatever `serverSeq` the row already had — behind every device's
   * cursor. Caught on real devices: a transaction deleted from the web stayed
   * alive on the phone forever, because a pull is `serverSeq > cursor`.
   */
  it("sequenceServerWrites gives server-authored rows a fresh seq and clears dirty", async () => {
    const rowId = testId(5);
    const queries: string[] = [];
    dbQuery.mockImplementation(async (rawSql: string) => {
      const sql = String(rawSql ?? "");
      queries.push(sql);
      if (sql.startsWith("SELECT id FROM transactions")) return [{ id: rowId }];
      if (sql.startsWith("SELECT id FROM")) return [];
      if (sql.includes("INSERT INTO syncSequence")) {
        return { insertId: 90, affectedRows: 1 };
      }
      return { insertId: null, affectedRows: 1 };
    });

    const { sequenceServerWrites } = await import("@/server/_core/sync-engine");
    const sequenced = await sequenceServerWrites(SYNC_TABLES, testId(1));

    expect(sequenced).toBe(1);
    const update = queries.find((q) => q.includes("SET serverSeq = ?"));
    expect(update).toContain("dirty = 0");
    // Only rows this side wrote are candidates — a row a device pushed is
    // already clean and must not be re-sequenced into a pull loop.
    expect(queries.some((q) => q.includes("dirty = 1"))).toBe(true);
  });

  it("sequenceServerWrites allocates nothing when the server has no local writes", async () => {
    dbQuery.mockResolvedValue([]);
    const { sequenceServerWrites } = await import("@/server/_core/sync-engine");

    expect(await sequenceServerWrites(SYNC_TABLES, testId(1))).toBe(0);
    expect(
      dbQuery.mock.calls.some(([, o]) =>
        String((o as never as string) ?? "").includes(
          "INSERT INTO syncSequence",
        ),
      ),
    ).toBe(false);
  });

  it("allocateServerSeqBlock is a no-op for zero rows", async () => {
    const { allocateServerSeqBlock } =
      await import("@/server/_core/sync-engine");
    expect(await allocateServerSeqBlock(0)).toBe(0);
    expect(dbQuery).not.toHaveBeenCalled();
  });

  it("allocateServerSeqBlock throws if the insert reports no insertId", async () => {
    dbQuery.mockResolvedValueOnce({ insertId: 0 });
    const { allocateServerSeqBlock } =
      await import("@/server/_core/sync-engine");
    await expect(allocateServerSeqBlock(1)).rejects.toThrow(
      /Failed to allocate a serverSeq block/,
    );
  });

  it("applyPushedRows forces userId to the caller's account, ignores the row's own dirty/serverSeq, and assigns a contiguous block", async () => {
    dbQuery
      .mockResolvedValueOnce([]) // assertRowsOwnedByCaller: no foreign rows
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
    const row1Call = bodyOf(dbQuery.mock.calls[2]);
    expect(row1Call.query).toMatch(/INSERT INTO categories/);
    const columns = row1Call.query
      .match(/INSERT INTO categories \(([^)]+)\)/)![1]
      .split(",")
      .map((c) => c.trim());
    const userIdIndex = columns.indexOf("userId");
    const dirtyIndex = columns.indexOf("dirty");
    const serverSeqIndex = columns.indexOf("serverSeq");
    expect(row1Call.params[userIdIndex]).toBe(testId(9));
    expect(row1Call.params[dirtyIndex]).toBe(false);
    expect(row1Call.params[serverSeqIndex]).toBe(100);
  });

  it("applyPushedRows is a no-op for an empty batch", async () => {
    const { applyPushedRows } = await import("@/server/_core/sync-engine");
    expect(await applyPushedRows("categories", testId(1), [])).toEqual([]);
    expect(dbQuery).not.toHaveBeenCalled();
  });
});

describe("sync-engine against real SQLite (the device-side operations)", () => {
  beforeEach(async () => {
    vi.resetModules();
    dbQuery.mockReset();
    const { createNodeSqliteDriver } =
      await import("@/server/_core/sqlite-node-driver");
    const { runMigrations, createSqliteDataApi } =
      await import("@/server/_core/sqlite-engine");
    const driver = createNodeSqliteDriver();
    await runMigrations(driver);
    vi.doMock("@/server/_core/db-query", () => ({
      dbQuery: createSqliteDataApi(driver),
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

  // A brand-new user is seeded with default categories and a "Cash" account
  // before they have entered anything. Counting those as data made every
  // fresh phone report a conflict against every account, putting the
  // first-sync prompt — and its destructive "keep this phone's data" option
  // — in front of a user with nothing to choose between.
  it("accountHasAnyData ignores the rows a new user is auto-seeded with", async () => {
    const db = await import("@/server/db");
    const { accountHasAnyData } = await import("@/server/_core/sync-engine");
    const { ensureUserSeeded } = await import("@/server/_core/user-seeding");
    const userId = testId(1);

    await ensureUserSeeded(userId);
    expect((await db.getUserCategories(userId)).length).toBeGreaterThan(0);
    expect(await accountHasAnyData(SYNC_TABLES, userId)).toBe(false);

    await db.createCategory({
      userId,
      name: "Something the user actually made",
      type: "expense",
      color: "#111111",
      icon: "cart",
      isDefault: false,
    });
    expect(await accountHasAnyData(SYNC_TABLES, userId)).toBe(true);
  });

  it("markAllDirty flags every one of this user's rows across every synced table, regardless of current state", async () => {
    const db = await import("@/server/db");
    const { markAllDirty, getDirtyRows, markRowsSynced } =
      await import("@/server/_core/sync-engine");
    const userId = testId(1);

    const catId = await db.createCategory({
      userId,
      name: "Groceries",
      type: "expense",
      color: "#111111",
      icon: "cart",
      isDefault: false,
    });
    await markRowsSynced("categories", [{ id: catId, serverSeq: 1 }]);
    expect(await getDirtyRows("categories", userId)).toEqual([]);

    await markAllDirty(SYNC_TABLES, userId);

    const dirty = await getDirtyRows("categories", userId);
    expect(dirty.map((r) => r.id)).toEqual([catId]);
  });
});

describe("tombstone purge (mocked MySQL — watermark-driven, server-only)", () => {
  beforeEach(() => {
    // The previous describe block's beforeEach left @/server/_core/db-query
    // doMock'd to a real SQLite backend. `vi.doUnmock` reverts all the way to
    // the *real* module (not just back to the top-level `vi.mock`), so
    // re-doMock the same dbQuery proxy explicitly — this block asserts
    // SQL shape against a mocked dbQuery, exactly like the "push
    // mechanics" block above, since syncPurgeWatermark, like syncSequence,
    // is server-only and never part of the device's schema.
    vi.resetModules();
    vi.doMock("@/server/_core/db-query", () => ({
      dbQuery: (...args: unknown[]) => dbQuery(...args),
    }));
    dbQuery.mockReset();
  });

  it("getPurgeWatermark returns 0 for an unseeded/missing watermark row", async () => {
    dbQuery.mockResolvedValueOnce([]);
    const { getPurgeWatermark } = await import("@/server/_core/sync-engine");
    expect(await getPurgeWatermark()).toBe(0);
  });

  it("getPurgeWatermark returns the stored value", async () => {
    dbQuery.mockResolvedValueOnce([{ purgedUpToSeq: 42 }]);
    const { getPurgeWatermark } = await import("@/server/_core/sync-engine");
    expect(await getPurgeWatermark()).toBe(42);
  });

  it("purgeOldTombstones deletes old tombstones per table and advances the watermark to the highest seq purged", async () => {
    const cutoff = new Date("2026-01-01");
    dbQuery
      .mockResolvedValueOnce([{ purgedUpToSeq: 0 }]) // getPurgeWatermark
      .mockResolvedValueOnce([
        { id: testId(1), serverSeq: 5 },
        { id: testId(2), serverSeq: 8 },
      ]) // categories candidates
      .mockResolvedValueOnce(undefined) // categories DELETE
      .mockResolvedValueOnce([]) // creditCards candidates: none
      .mockResolvedValue([]); // every remaining table: none, then the final UPDATE

    const { purgeOldTombstones } = await import("@/server/_core/sync-engine");
    const result = await purgeOldTombstones(SYNC_TABLES, cutoff);

    expect(result).toEqual({ purgedCount: 2, newWatermark: 8 });

    const deleteCall = dbQuery.mock.calls.find(([sql]) =>
      String(sql).includes("DELETE FROM categories"),
    );
    expect(deleteCall).toBeDefined();
    const watermarkUpdateCall = dbQuery.mock.calls.find(([sql]) =>
      String(sql).includes("UPDATE syncPurgeWatermark"),
    );
    expect(watermarkUpdateCall![1] as unknown[]).toEqual([8, 1, 8]);
  });

  it("purgeOldTombstones never moves the watermark backwards", async () => {
    dbQuery
      .mockResolvedValueOnce([{ purgedUpToSeq: 100 }]) // watermark already ahead
      .mockResolvedValue([]); // no candidates in any table

    const { purgeOldTombstones } = await import("@/server/_core/sync-engine");
    const result = await purgeOldTombstones(SYNC_TABLES, new Date());

    expect(result).toEqual({ purgedCount: 0, newWatermark: 100 });
    const watermarkUpdateCall = dbQuery.mock.calls.find(([sql]) =>
      String(sql).includes("UPDATE syncPurgeWatermark"),
    );
    // WHERE purgedUpToSeq < ? guards this from ever lowering the watermark,
    // even though it's still issued with the unchanged value.
    expect(watermarkUpdateCall![1] as unknown[]).toEqual([100, 1, 100]);
  });
});

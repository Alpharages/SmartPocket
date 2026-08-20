import { beforeEach, describe, expect, it, vi } from "vitest";
import { testId } from "./helpers/ids";
import type { TrpcContext } from "@/server/_core/context";

function createUserContext(userId: string): TrpcContext {
  return {
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
    user: {
      id: userId,
      openId: `open-${userId}`,
      name: "Test User",
      email: null,
      loginMethod: null,
      role: "user",
      aiEnabled: false,
    } as unknown as TrpcContext["user"],
  };
}

describe("sync router against real SQLite", () => {
  beforeEach(async () => {
    vi.resetModules();
    const { createNodeSqliteDriver } =
      await import("@/server/_core/sqlite-node-driver");
    const { runMigrations, createSqliteDataApi } =
      await import("@/server/_core/sqlite-engine");
    const driver = createNodeSqliteDriver();
    await runMigrations(driver);
    // syncSequence is a server-only (MySQL) table — never part of the
    // device's local schema — but push needs *something* auto-incrementing
    // to allocate a block from, so this test's stand-in server database
    // creates it by hand rather than via SQLITE_MIGRATIONS.
    await driver.execScript(
      "CREATE TABLE syncSequence (seq INTEGER PRIMARY KEY AUTOINCREMENT, createdAt TEXT);",
    );
    vi.doMock("@/server/_core/dataApi", () => ({
      callDataApi: createSqliteDataApi(driver),
    }));
  });

  it("pull returns only the caller's own rows above sinceSeq, not another user's", async () => {
    const db = await import("@/server/db");
    const { appRouter } = await import("@/server/routers");
    const { markRowsSynced } = await import("@/server/_core/sync-engine");
    const userId = testId(1);
    const otherUserId = testId(2);

    const mine = await db.createCategory({
      userId,
      name: "Mine",
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
    await markRowsSynced("categories", [{ id: mine, serverSeq: 5 }]);

    const caller = appRouter.createCaller(createUserContext(userId));
    const rows = await caller.sync.pull({ table: "categories", sinceSeq: 0 });

    expect(rows).toHaveLength(1);
    expect((rows[0] as { id: string }).id).toBe(mine);
  });

  it("push refuses to overwrite a row that belongs to another account", async () => {
    const db = await import("@/server/db");
    const { appRouter } = await import("@/server/routers");
    const userId = testId(1);
    const otherUserId = testId(2);

    const victimRow = await db.createCategory({
      userId: otherUserId,
      name: "Victim",
      type: "expense",
      color: "#222222",
      icon: "cart",
      isDefault: false,
    });

    const caller = appRouter.createCaller(createUserContext(userId));
    await expect(
      caller.sync.push({
        table: "categories",
        rows: [{ id: victimRow, userId, name: "Hijacked", type: "expense" }],
      }),
    ).rejects.toThrow(/another account/);

    // The victim still owns it, untouched — the guard runs before any write.
    const stillTheirs = await caller.sync.pull({
      table: "categories",
      sinceSeq: 0,
    });
    expect(stillTheirs).toHaveLength(0);
  });

  it("accountHasData reflects whether the caller's account holds any live row", async () => {
    const db = await import("@/server/db");
    const { appRouter } = await import("@/server/routers");
    const userId = testId(1);
    const caller = appRouter.createCaller(createUserContext(userId));

    expect(await caller.sync.accountHasData()).toBe(false);

    await db.createCategory({
      userId,
      name: "Groceries",
      type: "expense",
      color: "#111111",
      icon: "cart",
      isDefault: false,
    });

    expect(await caller.sync.accountHasData()).toBe(true);
  });

  it("rejects an unknown sync table at the input-validation layer", async () => {
    const { appRouter } = await import("@/server/routers");
    const caller = appRouter.createCaller(createUserContext(testId(1)));

    await expect(
      caller.sync.pull({
        table: "notARealTable" as never,
        sinceSeq: 0,
      }),
    ).rejects.toThrow();
  });
});

// Separate describe: push's serverSeq-block allocation is exercised for real
// in tests/sync-engine.test.ts (against a mocked callDataApi, since the
// SQLite test backend's insertId is deliberately always null — the on-device
// SQLite never has real auto-increment ids to hand back). This block only
// proves the *router* wires ctx.user.id and input through to applyPushedRows
// correctly, so it mocks sync-engine directly rather than exercising a real
// data store.
const syncEngine = vi.hoisted(() => ({
  applyPushedRows: vi.fn(),
  getRowsSince: vi.fn(),
  accountHasAnyData: vi.fn(),
}));

describe("sync router push wiring (mocked sync-engine)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@/server/_core/sync-engine", () => syncEngine);
    syncEngine.applyPushedRows
      .mockReset()
      .mockResolvedValue([{ id: testId(10), serverSeq: 100 }]);
  });

  it("passes the authenticated caller's id and the request body straight through", async () => {
    const { appRouter } = await import("@/server/routers");
    const userId = testId(1);
    const caller = appRouter.createCaller(createUserContext(userId));
    const rows = [{ id: testId(10), name: "Pushed A" }];

    const results = await caller.sync.push({ table: "categories", rows });

    expect(results).toEqual([{ id: testId(10), serverSeq: 100 }]);
    expect(syncEngine.applyPushedRows).toHaveBeenCalledWith(
      "categories",
      userId,
      rows,
    );
  });
});

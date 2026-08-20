import { beforeEach, describe, expect, it, vi } from "vitest";
import { testId } from "./helpers/ids";
import { isUlid } from "@shared/ulid";

const localUser = vi.hoisted(() => ({
  getLocalOpenId: vi.fn(),
}));
vi.mock("@/lib/local-user", () => localUser);

const dbMock = vi.hoisted(() => ({
  getUserByOpenId: vi.fn(),
  upsertUser: vi.fn(),
}));
vi.mock("@/server/db", () => dbMock);

const seeding = vi.hoisted(() => ({
  ensureUserSeeded: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/server/_core/user-seeding", () => seeding);

describe("createLocalContext", () => {
  beforeEach(() => {
    vi.resetModules();
    localUser.getLocalOpenId.mockReset().mockResolvedValue("local-open-id-1");
    dbMock.getUserByOpenId.mockReset();
    dbMock.upsertUser.mockReset().mockResolvedValue(undefined);
    seeding.ensureUserSeeded.mockClear();
  });

  it("creates the local user on first call when no row exists yet", async () => {
    const existingRow = { id: testId(1), openId: "local-open-id-1" };
    dbMock.getUserByOpenId
      .mockResolvedValueOnce(null) // first lookup: not found
      .mockResolvedValueOnce(existingRow); // re-fetch after upsert

    const { createLocalContext } = await import("@/server/_core/local-context");
    const ctx = await createLocalContext();

    expect(dbMock.upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({
        openId: "local-open-id-1",
        loginMethod: "local",
      }),
    );
    expect(seeding.ensureUserSeeded).toHaveBeenCalledWith(testId(1));
    expect(ctx.user).toEqual(existingRow);
    expect(ctx.req).toBeDefined();
    expect(ctx.res).toBeDefined();
  });

  it("reuses the existing row without re-creating or re-seeding on later calls", async () => {
    const existingRow = { id: testId(1), openId: "local-open-id-1" };
    dbMock.getUserByOpenId.mockResolvedValue(existingRow);

    const { createLocalContext } = await import("@/server/_core/local-context");
    await createLocalContext();
    await createLocalContext();

    expect(dbMock.getUserByOpenId).toHaveBeenCalledTimes(1);
    expect(dbMock.upsertUser).not.toHaveBeenCalled();
    expect(seeding.ensureUserSeeded).not.toHaveBeenCalled();
  });

  it("memoizes across concurrent calls instead of racing to create two rows", async () => {
    const existingRow = { id: testId(1), openId: "local-open-id-1" };
    dbMock.getUserByOpenId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingRow);

    const { createLocalContext } = await import("@/server/_core/local-context");
    const [a, b] = await Promise.all([
      createLocalContext(),
      createLocalContext(),
    ]);

    expect(a.user).toEqual(existingRow);
    expect(b.user).toEqual(existingRow);
    expect(dbMock.upsertUser).toHaveBeenCalledTimes(1);
  });
});

describe("createLocalContext against real SQLite end to end", () => {
  beforeEach(async () => {
    vi.resetModules();
    localUser.getLocalOpenId.mockReset();
    seeding.ensureUserSeeded.mockClear();
    vi.doUnmock("@/server/db");
    vi.doUnmock("@/server/_core/user-seeding");

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

  it("mints a real local user row and seeds default categories/account", async () => {
    localUser.getLocalOpenId.mockResolvedValue("device-local-open-id");

    const { createLocalContext } = await import("@/server/_core/local-context");
    const db = await import("@/server/db");

    const ctx = await createLocalContext();

    expect(ctx.user).toBeTruthy();
    expect(isUlid(ctx.user!.id)).toBe(true);
    expect(ctx.user!.openId).toBe("device-local-open-id");

    const categories = await db.getUserCategories(ctx.user!.id);
    expect(categories.length).toBeGreaterThan(0);
    const accounts = await db.getUserAccounts(ctx.user!.id);
    expect(accounts.length).toBeGreaterThan(0);
  });

  it("lets the resolved context actually call a protected procedure via createCaller", async () => {
    localUser.getLocalOpenId.mockResolvedValue("device-local-open-id-2");

    const { createLocalContext } = await import("@/server/_core/local-context");
    const { appRouter } = await import("@/server/routers");

    const ctx = await createLocalContext();
    const caller = appRouter.createCaller(ctx);

    const categories = await caller.categories.list();
    expect(categories.length).toBeGreaterThan(0);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTRPCClient as createVanillaTRPCClient } from "@trpc/client";
import { testId } from "./helpers/ids";

/**
 * The first-sync association, end to end against a real SQLite engine — not
 * against mocks. Every other sync test mocks `@/server/_core/sync-engine`
 * wholesale and asserts that `reownLocalData` was *called*; none of them
 * asserts that the app can still read its own data afterwards, which is
 * exactly the gap that let the blank-app regression through: re-owning every
 * data row to the account's id while leaving the device's `users` row on the
 * old id meant the in-process tRPC context looked up its data under an id
 * nothing owned any more.
 *
 * These run the genuine path — real router, real server/db.ts, real SQLite —
 * so the only thing that can make them pass is the association actually
 * working.
 */
const localUser = vi.hoisted(() => ({ getLocalOpenId: vi.fn() }));
vi.mock("@/lib/local-user", () => localUser);

// These tests exercise the real router against real SQLite; the card-key
// adoption pass is the one step that genuinely needs a device keychain, so it
// is stubbed out (tests/card-key-sync.test.ts covers it directly).
vi.mock("@/lib/sync/card-key-sync", () => ({
  adoptAccountCardKeyForDevice: vi.fn(async () => null),
}));

const syncState = vi.hoisted(() => ({
  isSyncEnabled: vi.fn(),
  hasCompletedFirstSync: vi.fn(),
  markFirstSyncComplete: vi.fn(),
  getLastPulledSeq: vi.fn(),
  setLastPulledSeq: vi.fn(),
}));
vi.mock("@/lib/sync/sync-state", () => syncState);

const ACCOUNT_USER_ID = testId(42);

/** A remote whose account holds nothing and accepts every push. */
function emptyRemote() {
  return {
    sync: {
      accountHasData: { query: vi.fn().mockResolvedValue(false) },
      getPurgeWatermark: { query: vi.fn().mockResolvedValue(0) },
      getHeadSeq: { query: vi.fn().mockResolvedValue(0) },
      pull: { query: vi.fn().mockResolvedValue([]) },
      push: {
        mutate: vi.fn(async ({ rows }: { rows: { id: string }[] }) =>
          rows.map((row, index) => ({ id: row.id, serverSeq: index + 1 })),
        ),
      },
    },
    data: { clearAll: { mutate: vi.fn() } },
  };
}

describe("first sync keeps the app's own data visible", () => {
  beforeEach(async () => {
    vi.resetModules();
    localUser.getLocalOpenId.mockReset().mockResolvedValue(testId(9));
    syncState.isSyncEnabled.mockReset().mockResolvedValue(true);
    syncState.hasCompletedFirstSync.mockReset().mockResolvedValue(false);
    syncState.markFirstSyncComplete.mockReset().mockResolvedValue(undefined);
    syncState.getLastPulledSeq.mockReset().mockResolvedValue(0);
    syncState.setLastPulledSeq.mockReset().mockResolvedValue(undefined);

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

  async function localClient() {
    const { createInProcessLink } = await import("@/lib/trpc.native");
    const { appRouter } = await import("@/server/routers");
    return createVanillaTRPCClient<typeof appRouter>({
      links: [createInProcessLink()],
    });
  }

  it("still lists this phone's rows after an implicit first sync re-owns them", async () => {
    const client = await localClient();
    const { runSync } = await import("@/lib/sync/sync-worker");

    const category = (await client.categories.list.query())[0];
    await client.transactions.create.mutate({
      amount: "250.00",
      type: "expense",
      categoryId: category.id,
      date: new Date(),
      description: "Groceries",
    });
    const before = await client.transactions.list.query({});

    const outcome = await runSync(emptyRemote() as never, ACCOUNT_USER_ID);
    expect(outcome.status).toBe("synced");

    const after = await client.transactions.list.query({});
    expect(after).toHaveLength(before.length);
    expect(after[0].description).toBe("Groceries");
  });

  it.each(["keep-phone", "merge"] as const)(
    "still lists this phone's rows after resolving the choice as %s",
    async (choice) => {
      const client = await localClient();
      const { resolveFirstSync } = await import("@/lib/sync/sync-worker");

      const category = (await client.categories.list.query())[0];
      await client.transactions.create.mutate({
        amount: "80.00",
        type: "expense",
        categoryId: category.id,
        date: new Date(),
        description: "Coffee",
      });

      await resolveFirstSync(emptyRemote() as never, choice, ACCOUNT_USER_ID);

      const after = await client.transactions.list.query({});
      expect(after).toHaveLength(1);
      expect(after[0].description).toBe("Coffee");
    },
  );

  it("shows rows pulled from the account after 'keep the account's data'", async () => {
    const client = await localClient();
    const { resolveFirstSync } = await import("@/lib/sync/sync-worker");
    const { applyIncomingRow } = await import("@/server/_core/sync-engine");
    const { getLocalUserId } = await import("@/server/_core/local-context");

    const category = (await client.categories.list.query())[0];
    await client.transactions.create.mutate({
      amount: "10.00",
      type: "expense",
      categoryId: category.id,
      date: new Date(),
      description: "This phone's row",
    });

    await resolveFirstSync(
      emptyRemote() as never,
      "keep-account",
      ACCOUNT_USER_ID,
    );

    // The phone's own row is gone (that was the choice) and the identity has
    // moved to the account, so a row pulled from the account is visible.
    expect(await client.transactions.list.query({})).toEqual([]);
    expect(await getLocalUserId()).toBe(ACCOUNT_USER_ID);

    await applyIncomingRow("transactions", {
      id: testId(7),
      userId: ACCOUNT_USER_ID,
      categoryId: category.id,
      amount: "99.00",
      type: "expense",
      description: "From the account",
      date: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      dirty: false,
      serverSeq: 1,
    });

    const pulled = await client.transactions.list.query({});
    expect(pulled).toHaveLength(1);
    expect(pulled[0].description).toBe("From the account");
  });
});

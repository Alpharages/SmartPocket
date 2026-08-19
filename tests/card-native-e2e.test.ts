import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTRPCClient as createVanillaTRPCClient } from "@trpc/client";
import { testId } from "./helpers/ids";

/**
 * A card written through the real in-process router into real SQLite, with
 * the real on-device key module behind it — the exact path the app takes when
 * someone adds a card offline.
 *
 * Worth its own test because the per-account key change altered the signature
 * `server/db.ts` calls (`encryptCardNumber(plain, userId)`), and the native
 * and server implementations of that signature are different files that Metro
 * swaps between. A mismatch there is invisible to a unit test of either half.
 */
const localUser = vi.hoisted(() => ({ getLocalOpenId: vi.fn() }));
vi.mock("@/lib/local-user", () => localUser);

const secureStore = vi.hoisted(() => new Map<string, string>());
vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async (k: string) => secureStore.get(k) ?? null),
  setItemAsync: vi.fn(async (k: string, v: string) => {
    secureStore.set(k, v);
  }),
  deleteItemAsync: vi.fn(async (k: string) => {
    secureStore.delete(k);
  }),
}));

// Metro resolves `./crypto` to crypto.native.ts on device; vitest does not do
// platform-extension resolution, so the swap is made explicit here.
vi.mock("@/server/_core/crypto", async () => {
  return await import("@/server/_core/crypto.native");
});

describe("adding a card offline, through the real router and real SQLite", () => {
  beforeEach(async () => {
    vi.resetModules();
    secureStore.clear();
    localUser.getLocalOpenId.mockReset().mockResolvedValue(testId(9));

    const { createNodeSqliteDriver } = await import(
      "@/server/_core/sqlite-node-driver"
    );
    const { runMigrations, createSqliteDataApi } = await import(
      "@/server/_core/sqlite-engine"
    );
    const driver = createNodeSqliteDriver();
    await runMigrations(driver);
    vi.doMock("@/server/_core/dataApi", () => ({
      callDataApi: createSqliteDataApi(driver),
    }));
  });

  it("stores the PAN encrypted and never returns it to the client", async () => {
    const { createInProcessLink } = await import("@/lib/trpc.native");
    const { appRouter } = await import("@/server/routers");
    const { callDataApi } = await import("@/server/_core/dataApi");

    const client = createVanillaTRPCClient<typeof appRouter>({
      links: [createInProcessLink()],
    });

    const created = await client.creditCards.create.mutate({
      name: "TestVisa",
      cardNumber: "4111111111111111",
      cardholderName: "Test User",
      expiryMonth: 12,
      expiryYear: 2030,
      creditLimit: "5000.00",
      cardType: "credit",
    });

    // The client only ever sees the last four.
    expect(created).toMatchObject({ cardNumberLast4: "1111" });
    expect(created).not.toHaveProperty("cardNumber");

    // At rest it is ciphertext, not the PAN.
    const rows = (await callDataApi("Database/query", {
      body: { query: "SELECT cardNumber FROM creditCards", params: [] },
    })) as Array<{ cardNumber: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].cardNumber).toMatch(/^v1:/);
    expect(rows[0].cardNumber).not.toContain("4111111111111111");

    // ...and it round-trips back through the same key the device holds.
    const { decryptCardNumber } = await import("@/server/_core/crypto.native");
    expect(await decryptCardNumber(rows[0].cardNumber)).toBe(
      "4111111111111111",
    );
  });

  it("still lists the card after a cold start, with the key read back from the keychain", async () => {
    const { createInProcessLink } = await import("@/lib/trpc.native");
    const { appRouter } = await import("@/server/routers");
    const client = createVanillaTRPCClient<typeof appRouter>({
      links: [createInProcessLink()],
    });

    await client.creditCards.create.mutate({
      name: "TestVisa",
      cardNumber: "4111111111111111",
      cardholderName: "Test User",
      expiryMonth: 12,
      expiryYear: 2030,
      creditLimit: "5000.00",
      cardType: "credit",
    });

    // Drop the in-memory key cache the way relaunching the app would; the
    // key must come back from SecureStore, not be re-minted (which would
    // leave the stored card permanently unreadable).
    const { __resetCardKeyCacheForTests } = await import(
      "@/server/_core/crypto.native"
    );
    __resetCardKeyCacheForTests();

    const listed = await client.creditCards.list.query();
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      name: "TestVisa",
      cardNumberLast4: "1111",
    });
  });
});

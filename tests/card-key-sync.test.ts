import { beforeEach, describe, expect, it, vi } from "vitest";
import { testId } from "./helpers/ids";

/**
 * The device→account card key switch (local-first-sync-plan.md blocker 3).
 *
 * The failure this guards against is quiet in a way lost rows are not: cards
 * encrypted under a device-only key push perfectly happily, land on the
 * server as ciphertext nobody holds the key for, and only surface as broken
 * when someone opens the card weeks later on another device.
 */
const store = vi.hoisted(() => new Map<string, string>());
vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async (k: string) => store.get(k) ?? null),
  setItemAsync: vi.fn(async (k: string, v: string) => {
    store.set(k, v);
  }),
  deleteItemAsync: vi.fn(async (k: string) => {
    store.delete(k);
  }),
}));

const rows = vi.hoisted(
  () => [] as Array<{ id: string; cardNumber: string; dirty: number }>,
);
vi.mock("@/server/_core/dataApi", () => ({
  callDataApi: vi.fn(
    async (_apiId: string, options?: { body?: Record<string, unknown> }) => {
      const sql = String(options?.body?.query ?? "");
      const params = (options?.body?.params ?? []) as unknown[];
      if (sql.startsWith("SELECT")) return rows.map((r) => ({ ...r }));
      if (sql.startsWith("UPDATE creditCards")) {
        const row = rows.find((r) => r.id === params[1]);
        if (row) {
          row.cardNumber = params[0] as string;
          row.dirty = 1;
        }
        return { affectedRows: 1 };
      }
      return [];
    },
  ),
}));

const ACCOUNT_KEY = Buffer.alloc(32, 3).toString("base64");
const userId = testId(1);

function fakeClient(key = ACCOUNT_KEY) {
  return { security: { getCardKey: { query: vi.fn(async () => key) } } };
}

describe("adoptAccountCardKeyForDevice", () => {
  beforeEach(async () => {
    vi.resetModules();
    store.clear();
    rows.length = 0;
  });

  it("re-encrypts a device-key card so the account can read it, and marks it dirty", async () => {
    const { encryptCardNumber, decryptCardNumber } = await import(
      "@/server/_core/crypto.native"
    );
    const deviceCiphertext = await encryptCardNumber("4111111111111111");
    rows.push({ id: testId(2), cardNumber: deviceCiphertext, dirty: 0 });

    const { adoptAccountCardKeyForDevice } = await import(
      "@/lib/sync/card-key-sync"
    );
    const result = await adoptAccountCardKeyForDevice(
      fakeClient() as never,
      userId,
    );

    expect(result).toEqual({ reencrypted: 1 });
    expect(rows[0].cardNumber).not.toBe(deviceCiphertext);
    // Clean rows had already synced under the unreadable device key — without
    // re-dirtying them the fixed ciphertext never reaches the account.
    expect(rows[0].dirty).toBe(1);
    // Still the same card, read back through the now-current account key.
    expect(await decryptCardNumber(rows[0].cardNumber)).toBe(
      "4111111111111111",
    );
  });

  it("makes the account key current, so new cards encrypt under it", async () => {
    const { adoptAccountCardKeyForDevice } = await import(
      "@/lib/sync/card-key-sync"
    );
    await adoptAccountCardKeyForDevice(fakeClient() as never, userId);

    const { encryptCardNumber } = await import("@/server/_core/crypto.native");
    const stored = await encryptCardNumber("5555555555554444");

    const { decryptWithKey } = await import("@/server/_core/card-cipher");
    expect(
      decryptWithKey(stored, new Uint8Array(Buffer.from(ACCOUNT_KEY, "base64"))),
    ).toBe("5555555555554444");
  });

  it("runs once — a second call is a no-op and never refetches the key", async () => {
    const { adoptAccountCardKeyForDevice } = await import(
      "@/lib/sync/card-key-sync"
    );
    const client = fakeClient();

    await adoptAccountCardKeyForDevice(client as never, userId);
    const second = await adoptAccountCardKeyForDevice(client as never, userId);

    expect(second).toBeNull();
    expect(client.security.getCardKey.query).toHaveBeenCalledOnce();
  });

  // Ordering is the whole design: re-encrypt first, adopt second. If the pass
  // dies partway the account key must NOT be current, so the retry starts
  // from a uniformly device-key-encrypted database.
  it("leaves the device key current when the pass fails partway", async () => {
    const { encryptCardNumber } = await import("@/server/_core/crypto.native");
    rows.push({
      id: testId(2),
      cardNumber: await encryptCardNumber("4111111111111111"),
      dirty: 0,
    });

    const failing = {
      security: {
        getCardKey: { query: vi.fn(async () => "not-valid-base64-key!!") },
      },
    };
    const { adoptAccountCardKeyForDevice } = await import(
      "@/lib/sync/card-key-sync"
    );
    await expect(
      adoptAccountCardKeyForDevice(failing as never, userId),
    ).rejects.toThrow();

    const { hasAccountCardKey } = await import("@/server/_core/crypto.native");
    expect(await hasAccountCardKey()).toBe(false);
  });
});

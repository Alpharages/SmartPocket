import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A real in-memory SecureStore, not a bare `vi.fn()` — the whole point of
 * this suite is proving the module caches and reuses the *same* generated
 * key across calls, which requires a store that actually remembers what was
 * written to it.
 */
const store = vi.hoisted(() => new Map<string, string>());

const secureStore = vi.hoisted(() => ({
  getItemAsync: vi.fn(async (key: string) => store.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    store.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    store.delete(key);
  }),
}));

vi.mock("expo-secure-store", () => secureStore);

describe("crypto.native", () => {
  beforeEach(() => {
    store.clear();
    secureStore.getItemAsync.mockClear();
    secureStore.setItemAsync.mockClear();
    vi.resetModules();
  });

  it("round-trips a PAN through encrypt/decrypt", async () => {
    const { encryptCardNumber, decryptCardNumber, isEncryptedCardNumber } =
      await import("@/server/_core/crypto.native");

    const stored = await encryptCardNumber("4111111111111111");
    expect(isEncryptedCardNumber(stored)).toBe(true);
    expect(await decryptCardNumber(stored)).toBe("4111111111111111");
  });

  it("mints a key on first use and persists it to SecureStore", async () => {
    const { encryptCardNumber } = await import("@/server/_core/crypto.native");

    expect(store.size).toBe(0);
    await encryptCardNumber("4111111111111111");
    expect(store.size).toBe(1);
    expect(secureStore.setItemAsync).toHaveBeenCalledTimes(1);
  });

  it("reuses the same key across calls instead of minting a new one each time", async () => {
    const { encryptCardNumber, decryptCardNumber } = await import(
      "@/server/_core/crypto.native"
    );

    const a = await encryptCardNumber("4111111111111111");
    const b = await encryptCardNumber("5555555555554444");

    // Only one key was ever written to SecureStore...
    expect(secureStore.setItemAsync).toHaveBeenCalledTimes(1);
    // ...and it decrypts both values, proving they were encrypted under it.
    expect(await decryptCardNumber(a)).toBe("4111111111111111");
    expect(await decryptCardNumber(b)).toBe("5555555555554444");
  });

  it("reuses the same key across a fresh module load (persisted, not process-only)", async () => {
    const first = await import("@/server/_core/crypto.native");
    const stored = await first.encryptCardNumber("4111111111111111");

    // Simulate the app restarting: reset the module registry so a fresh
    // in-memory key cache is built, but SecureStore (the `store` Map) is
    // untouched — exactly what happens across a real app relaunch.
    vi.resetModules();
    const second = await import("@/server/_core/crypto.native");

    expect(await second.decryptCardNumber(stored)).toBe("4111111111111111");
    // The second module instance read the persisted key rather than minting
    // its own — no additional write to SecureStore.
    expect(secureStore.setItemAsync).toHaveBeenCalledTimes(1);
  });

  it("does not mint two different keys when two calls race on first use", async () => {
    const { encryptCardNumber, decryptCardNumber } = await import(
      "@/server/_core/crypto.native"
    );

    const [a, b] = await Promise.all([
      encryptCardNumber("4111111111111111"),
      encryptCardNumber("5555555555554444"),
    ]);

    expect(secureStore.setItemAsync).toHaveBeenCalledTimes(1);
    expect(await decryptCardNumber(a)).toBe("4111111111111111");
    expect(await decryptCardNumber(b)).toBe("5555555555554444");
  });

  it("passes plaintext through decryptCardNumber unchanged (legacy pre-migration rows)", async () => {
    const { decryptCardNumber } = await import("@/server/_core/crypto.native");
    expect(await decryptCardNumber("4111111111111111")).toBe(
      "4111111111111111",
    );
  });

  it("is idempotent — encrypting an already-encrypted value is a no-op", async () => {
    const { encryptCardNumber } = await import("@/server/_core/crypto.native");
    const once = await encryptCardNumber("4111111111111111");
    expect(await encryptCardNumber(once)).toBe(once);
  });
});

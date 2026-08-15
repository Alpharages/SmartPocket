import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Platform } from "react-native";
import { isUlid } from "@shared/ulid";

/**
 * Real in-memory SecureStore (not a bare `vi.fn()`) — this suite exists to
 * prove the local user's openId is minted once and then reused across calls
 * and across "app restarts" (a fresh module registry, same backing store),
 * which requires a store that actually remembers what was written to it.
 * Mirrors tests/crypto.native.test.ts's harness.
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

describe("local-user", () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    store.clear();
    secureStore.getItemAsync.mockClear();
    secureStore.setItemAsync.mockClear();
    Platform.OS = "ios";
    vi.resetModules();
  });

  afterEach(() => {
    Platform.OS = originalOS;
  });

  it("mints a ULID on first use and persists it to SecureStore", async () => {
    const { getLocalOpenId } = await import("@/lib/local-user");

    expect(store.size).toBe(0);
    const openId = await getLocalOpenId();

    expect(isUlid(openId)).toBe(true);
    expect(store.size).toBe(1);
    expect(secureStore.setItemAsync).toHaveBeenCalledTimes(1);
  });

  it("reuses the same id across calls instead of minting a new one each time", async () => {
    const { getLocalOpenId } = await import("@/lib/local-user");

    const a = await getLocalOpenId();
    const b = await getLocalOpenId();

    expect(a).toBe(b);
    expect(secureStore.setItemAsync).toHaveBeenCalledTimes(1);
  });

  it("reuses the same id across a fresh module load (persisted, not process-only)", async () => {
    const first = await import("@/lib/local-user");
    const id = await first.getLocalOpenId();

    // Simulate the app restarting: reset the module registry so a fresh
    // in-memory cache is built, but SecureStore (the `store` Map) survives —
    // exactly what happens across a real app relaunch.
    vi.resetModules();
    const second = await import("@/lib/local-user");

    expect(await second.getLocalOpenId()).toBe(id);
    expect(secureStore.setItemAsync).toHaveBeenCalledTimes(1);
  });

  it("does not mint two different ids when two calls race on first use", async () => {
    const { getLocalOpenId } = await import("@/lib/local-user");

    const [a, b] = await Promise.all([getLocalOpenId(), getLocalOpenId()]);

    expect(a).toBe(b);
    expect(secureStore.setItemAsync).toHaveBeenCalledTimes(1);
  });
});

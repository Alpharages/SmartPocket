import { beforeEach, describe, expect, it, vi } from "vitest";
import { Platform } from "react-native";

const secureStore = vi.hoisted(() => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

const oauth = vi.hoisted(() => ({
  SESSION_TOKEN_KEY: "app_session_token",
}));

vi.mock("expo-secure-store", () => secureStore);
vi.mock("@/constants/oauth", () => oauth);

function createLocalStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
}

describe("auth session token web storage", () => {
  beforeEach(() => {
    Platform.OS = "web";
    secureStore.getItemAsync.mockReset();
    secureStore.setItemAsync.mockReset();
    secureStore.deleteItemAsync.mockReset();
    Object.defineProperty(globalThis, "localStorage", {
      value: createLocalStorageMock(),
      configurable: true,
      writable: true,
    });
  });

  it("stores, reads, and removes the session token from localStorage on web", async () => {
    const auth = await import("@/lib/_core/auth");

    await auth.setSessionToken("token-123");
    expect(
      (
        globalThis as typeof globalThis & {
          localStorage: { getItem(key: string): string | null };
        }
      ).localStorage.getItem(oauth.SESSION_TOKEN_KEY),
    ).toBe("token-123");
    expect(secureStore.setItemAsync).not.toHaveBeenCalled();

    await expect(auth.getSessionToken()).resolves.toBe("token-123");

    await auth.removeSessionToken();
    expect(
      (
        globalThis as typeof globalThis & {
          localStorage: { getItem(key: string): string | null };
        }
      ).localStorage.getItem(oauth.SESSION_TOKEN_KEY),
    ).toBeNull();
    expect(secureStore.deleteItemAsync).not.toHaveBeenCalled();
  });
});

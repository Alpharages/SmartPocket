import { beforeEach, describe, expect, it, vi } from "vitest";
import { Platform } from "react-native";

const secureStore = vi.hoisted(() => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

vi.mock("expo-secure-store", () => secureStore);

describe("app-lock", () => {
  beforeEach(() => {
    Platform.OS = "ios";
    secureStore.getItemAsync.mockReset();
    secureStore.setItemAsync.mockReset();
    secureStore.deleteItemAsync.mockReset();
  });

  describe("isAppLockSupported", () => {
    it("returns true on native platforms", async () => {
      const appLock = await import("@/lib/app-lock");
      expect(appLock.isAppLockSupported()).toBe(true);
    });

    it("returns false on web", async () => {
      Platform.OS = "web";
      const appLock = await import("@/lib/app-lock");
      expect(appLock.isAppLockSupported()).toBe(false);
    });
  });

  describe("setPin", () => {
    it("stores a valid 4-digit PIN", async () => {
      const appLock = await import("@/lib/app-lock");
      await appLock.setPin("1234");
      expect(secureStore.setItemAsync).toHaveBeenCalledWith(
        appLock.PIN_KEY,
        "1234",
      );
    });

    it.each(["123", "12345", "abcd", "12a4", "", "1234 "])(
      "rejects %j as not exactly 4 digits",
      async (candidate) => {
        const appLock = await import("@/lib/app-lock");
        await expect(appLock.setPin(candidate)).rejects.toThrow();
        expect(secureStore.setItemAsync).not.toHaveBeenCalled();
      },
    );
  });

  describe("verifyPin", () => {
    it("resolves true on a matching PIN (hit)", async () => {
      secureStore.getItemAsync.mockResolvedValue("1234");
      const appLock = await import("@/lib/app-lock");
      await expect(appLock.verifyPin("1234")).resolves.toBe(true);
    });

    it("resolves false on a non-matching PIN (miss)", async () => {
      secureStore.getItemAsync.mockResolvedValue("1234");
      const appLock = await import("@/lib/app-lock");
      await expect(appLock.verifyPin("0000")).resolves.toBe(false);
    });

    it("resolves false when no PIN is set", async () => {
      secureStore.getItemAsync.mockResolvedValue(null);
      const appLock = await import("@/lib/app-lock");
      await expect(appLock.verifyPin("1234")).resolves.toBe(false);
    });
  });

  describe("isPinSet", () => {
    it("resolves true when a PIN is stored", async () => {
      secureStore.getItemAsync.mockResolvedValue("1234");
      const appLock = await import("@/lib/app-lock");
      await expect(appLock.isPinSet()).resolves.toBe(true);
    });

    it("resolves false when no PIN is stored", async () => {
      secureStore.getItemAsync.mockResolvedValue(null);
      const appLock = await import("@/lib/app-lock");
      await expect(appLock.isPinSet()).resolves.toBe(false);
    });
  });

  describe("web platform (unsupported)", () => {
    beforeEach(() => {
      Platform.OS = "web";
    });

    it("isPinSet resolves null on web without touching SecureStore", async () => {
      const appLock = await import("@/lib/app-lock");
      await expect(appLock.isPinSet()).resolves.toBeNull();
      expect(secureStore.getItemAsync).not.toHaveBeenCalled();
    });

    it("verifyPin resolves null on web without touching SecureStore", async () => {
      const appLock = await import("@/lib/app-lock");
      await expect(appLock.verifyPin("1234")).resolves.toBeNull();
      expect(secureStore.getItemAsync).not.toHaveBeenCalled();
    });

    it("does not throw when setPin is called with a valid PIN on web", async () => {
      const appLock = await import("@/lib/app-lock");
      await expect(appLock.setPin("1234")).resolves.toBeUndefined();
      expect(secureStore.setItemAsync).not.toHaveBeenCalled();
    });
  });

  describe("clearAppLock", () => {
    it("removes both the PIN and biometric keys", async () => {
      const appLock = await import("@/lib/app-lock");
      await appLock.clearAppLock();
      expect(secureStore.deleteItemAsync).toHaveBeenCalledWith(appLock.PIN_KEY);
      expect(secureStore.deleteItemAsync).toHaveBeenCalledWith(
        appLock.BIOMETRIC_KEY,
      );
    });

    it("is a no-op on web", async () => {
      Platform.OS = "web";
      const appLock = await import("@/lib/app-lock");
      await appLock.clearAppLock();
      expect(secureStore.deleteItemAsync).not.toHaveBeenCalled();
    });
  });

  describe("SecureStore failures are guarded, not thrown", () => {
    it("isPinSet resolves null (not a rejection) when the read rejects", async () => {
      secureStore.getItemAsync.mockRejectedValue(new Error("Keystore error"));
      const appLock = await import("@/lib/app-lock");
      await expect(appLock.isPinSet()).resolves.toBeNull();
    });

    it("verifyPin resolves null (not a rejection) when the read rejects", async () => {
      secureStore.getItemAsync.mockRejectedValue(new Error("Keystore error"));
      const appLock = await import("@/lib/app-lock");
      await expect(appLock.verifyPin("1234")).resolves.toBeNull();
    });

    it("setPin still rejects when the write fails, but logs first", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      secureStore.setItemAsync.mockRejectedValue(new Error("Keystore error"));
      const appLock = await import("@/lib/app-lock");
      await expect(appLock.setPin("1234")).rejects.toThrow("Keystore error");
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it("clearAppLock still deletes the biometric key when deleting the PIN key rejects", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      secureStore.deleteItemAsync.mockImplementation(async (key: string) => {
        if (key === "app_lock_pin") throw new Error("Keystore error");
      });
      const appLock = await import("@/lib/app-lock");
      await expect(appLock.clearAppLock()).resolves.toBeUndefined();
      expect(secureStore.deleteItemAsync).toHaveBeenCalledWith(
        appLock.BIOMETRIC_KEY,
      );
      errorSpy.mockRestore();
    });
  });
});

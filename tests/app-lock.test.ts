import { beforeEach, describe, expect, it, vi } from "vitest";
import { Platform } from "react-native";

const secureStore = vi.hoisted(() => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

vi.mock("expo-secure-store", () => secureStore);

const localAuth = vi.hoisted(() => ({
  hasHardwareAsync: vi.fn(),
  isEnrolledAsync: vi.fn(),
  supportedAuthenticationTypesAsync: vi.fn(),
  authenticateAsync: vi.fn(),
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 },
}));

vi.mock("expo-local-authentication", () => localAuth);

describe("app-lock", () => {
  beforeEach(() => {
    Platform.OS = "ios";
    secureStore.getItemAsync.mockReset();
    secureStore.setItemAsync.mockReset();
    secureStore.deleteItemAsync.mockReset();
    localAuth.hasHardwareAsync.mockReset().mockResolvedValue(true);
    localAuth.isEnrolledAsync.mockReset().mockResolvedValue(true);
    localAuth.supportedAuthenticationTypesAsync
      .mockReset()
      .mockResolvedValue([2]); // FACIAL_RECOGNITION
    localAuth.authenticateAsync.mockReset();
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

    it("still attempts the biometric-key deletion when the PIN-key deletion rejects, then rejects", async () => {
      const appLock = await import("@/lib/app-lock");
      secureStore.deleteItemAsync.mockImplementation((key: string) =>
        key === appLock.PIN_KEY
          ? Promise.reject(new Error("pin delete failed"))
          : Promise.resolve(),
      );
      await expect(appLock.clearAppLock()).rejects.toThrow("pin delete failed");
      expect(secureStore.deleteItemAsync).toHaveBeenCalledWith(
        appLock.BIOMETRIC_KEY,
      );
    });

    it("still attempts the PIN-key deletion when the biometric-key deletion rejects, then rejects", async () => {
      const appLock = await import("@/lib/app-lock");
      secureStore.deleteItemAsync.mockImplementation((key: string) =>
        key === appLock.BIOMETRIC_KEY
          ? Promise.reject(new Error("biometric delete failed"))
          : Promise.resolve(),
      );
      await expect(appLock.clearAppLock()).rejects.toThrow(
        "biometric delete failed",
      );
      expect(secureStore.deleteItemAsync).toHaveBeenCalledWith(appLock.PIN_KEY);
    });
  });

  describe("read failures degrade to null instead of rejecting", () => {
    it("isPinSet resolves null (not a rejection) when the underlying read throws", async () => {
      secureStore.getItemAsync.mockRejectedValue(new Error("keystore error"));
      const appLock = await import("@/lib/app-lock");
      await expect(appLock.isPinSet()).resolves.toBeNull();
    });

    it("verifyPin resolves null (not a rejection) when the underlying read throws", async () => {
      secureStore.getItemAsync.mockRejectedValue(new Error("keystore error"));
      const appLock = await import("@/lib/app-lock");
      await expect(appLock.verifyPin("1234")).resolves.toBeNull();
    });
  });

  describe("write failures propagate to the caller", () => {
    it("setPin rejects when the underlying write throws, but logs first", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      secureStore.setItemAsync.mockRejectedValue(new Error("keystore error"));
      const appLock = await import("@/lib/app-lock");
      await expect(appLock.setPin("1234")).rejects.toThrow("keystore error");
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

  describe("isBiometricEnabled", () => {
    it("resolves true when the biometric key is stored", async () => {
      secureStore.getItemAsync.mockResolvedValue("true");
      const appLock = await import("@/lib/app-lock");
      await expect(appLock.isBiometricEnabled()).resolves.toBe(true);
      expect(secureStore.getItemAsync).toHaveBeenCalledWith(
        appLock.BIOMETRIC_KEY,
      );
    });

    it("resolves false when the biometric key is not stored", async () => {
      secureStore.getItemAsync.mockResolvedValue(null);
      const appLock = await import("@/lib/app-lock");
      await expect(appLock.isBiometricEnabled()).resolves.toBe(false);
    });

    it("resolves null on web without touching SecureStore", async () => {
      Platform.OS = "web";
      const appLock = await import("@/lib/app-lock");
      await expect(appLock.isBiometricEnabled()).resolves.toBeNull();
      expect(secureStore.getItemAsync).not.toHaveBeenCalled();
    });

    it("resolves null (not a rejection) when the underlying read throws", async () => {
      secureStore.getItemAsync.mockRejectedValue(new Error("keystore error"));
      const appLock = await import("@/lib/app-lock");
      await expect(appLock.isBiometricEnabled()).resolves.toBeNull();
    });
  });

  describe("setBiometricEnabled", () => {
    it("stores the biometric key when enabling", async () => {
      const appLock = await import("@/lib/app-lock");
      await appLock.setBiometricEnabled(true);
      expect(secureStore.setItemAsync).toHaveBeenCalledWith(
        appLock.BIOMETRIC_KEY,
        "true",
      );
    });

    it("deletes the biometric key when disabling", async () => {
      const appLock = await import("@/lib/app-lock");
      await appLock.setBiometricEnabled(false);
      expect(secureStore.deleteItemAsync).toHaveBeenCalledWith(
        appLock.BIOMETRIC_KEY,
      );
      expect(secureStore.setItemAsync).not.toHaveBeenCalled();
    });

    it("is a no-op on web", async () => {
      Platform.OS = "web";
      const appLock = await import("@/lib/app-lock");
      await appLock.setBiometricEnabled(true);
      expect(secureStore.setItemAsync).not.toHaveBeenCalled();
    });

    it("rejects and logs when the underlying write throws", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      secureStore.setItemAsync.mockRejectedValue(new Error("keystore error"));
      const appLock = await import("@/lib/app-lock");
      await expect(appLock.setBiometricEnabled(true)).rejects.toThrow(
        "keystore error",
      );
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

  describe("getBiometricLabel", () => {
    it('returns "Face ID" on iOS with facial recognition enrolled', async () => {
      Platform.OS = "ios";
      localAuth.supportedAuthenticationTypesAsync.mockResolvedValue([2]);
      const appLock = await import("@/lib/app-lock");
      await expect(appLock.getBiometricLabel()).resolves.toBe("Face ID");
    });

    it('returns "Touch ID" on iOS with only fingerprint enrolled', async () => {
      Platform.OS = "ios";
      localAuth.supportedAuthenticationTypesAsync.mockResolvedValue([1]);
      const appLock = await import("@/lib/app-lock");
      await expect(appLock.getBiometricLabel()).resolves.toBe("Touch ID");
    });

    it('returns "Face unlock" on Android with facial recognition enrolled', async () => {
      Platform.OS = "android";
      localAuth.supportedAuthenticationTypesAsync.mockResolvedValue([2]);
      const appLock = await import("@/lib/app-lock");
      await expect(appLock.getBiometricLabel()).resolves.toBe("Face unlock");
    });

    it('returns "Fingerprint" on Android with only fingerprint enrolled', async () => {
      Platform.OS = "android";
      localAuth.supportedAuthenticationTypesAsync.mockResolvedValue([1]);
      const appLock = await import("@/lib/app-lock");
      await expect(appLock.getBiometricLabel()).resolves.toBe("Fingerprint");
    });

    it("returns null when there is no biometric hardware", async () => {
      localAuth.hasHardwareAsync.mockResolvedValue(false);
      const appLock = await import("@/lib/app-lock");
      await expect(appLock.getBiometricLabel()).resolves.toBeNull();
      expect(
        localAuth.supportedAuthenticationTypesAsync,
      ).not.toHaveBeenCalled();
    });

    it("returns null when hardware exists but nothing is enrolled", async () => {
      localAuth.isEnrolledAsync.mockResolvedValue(false);
      const appLock = await import("@/lib/app-lock");
      await expect(appLock.getBiometricLabel()).resolves.toBeNull();
      expect(
        localAuth.supportedAuthenticationTypesAsync,
      ).not.toHaveBeenCalled();
    });

    it("returns null on web without calling expo-local-authentication", async () => {
      Platform.OS = "web";
      const appLock = await import("@/lib/app-lock");
      await expect(appLock.getBiometricLabel()).resolves.toBeNull();
      expect(localAuth.hasHardwareAsync).not.toHaveBeenCalled();
    });

    it("returns null (not a rejection) when a capability check throws", async () => {
      localAuth.hasHardwareAsync.mockRejectedValue(new Error("native error"));
      const appLock = await import("@/lib/app-lock");
      await expect(appLock.getBiometricLabel()).resolves.toBeNull();
    });
  });

  describe("authenticateWithBiometrics", () => {
    it("resolves true on a successful scan, biometric-only (no device fallback)", async () => {
      localAuth.authenticateAsync.mockResolvedValue({ success: true });
      const appLock = await import("@/lib/app-lock");
      await expect(appLock.authenticateWithBiometrics()).resolves.toBe(true);
      expect(localAuth.authenticateAsync).toHaveBeenCalledWith({
        disableDeviceFallback: true,
        cancelLabel: "Use PIN",
      });
    });

    it("resolves false on a failed or cancelled scan", async () => {
      localAuth.authenticateAsync.mockResolvedValue({ success: false });
      const appLock = await import("@/lib/app-lock");
      await expect(appLock.authenticateWithBiometrics()).resolves.toBe(false);
    });

    it("resolves false (not a rejection) when the native call throws", async () => {
      localAuth.authenticateAsync.mockRejectedValue(new Error("native error"));
      const appLock = await import("@/lib/app-lock");
      await expect(appLock.authenticateWithBiometrics()).resolves.toBe(false);
    });

    it("resolves false on web without calling expo-local-authentication", async () => {
      Platform.OS = "web";
      const appLock = await import("@/lib/app-lock");
      await expect(appLock.authenticateWithBiometrics()).resolves.toBe(false);
      expect(localAuth.authenticateAsync).not.toHaveBeenCalled();
    });
  });
});

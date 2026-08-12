import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export const PIN_KEY = "app_lock_pin";
export const BIOMETRIC_KEY = "app_lock_biometric";

const PIN_PATTERN = /^\d{4}$/;

// expo-secure-store has no web implementation — app lock is a native-only
// feature (ClickUp Epic 13: App Lock). Callers gate on this before reading
// or writing PIN state; reads resolve `null` and writes no-op on web.
export function isAppLockSupported(): boolean {
  return Platform.OS !== "web";
}

// Reads degrade to `null` on failure (mirrors lib/_core/auth.ts) so a Keystore/
// Keychain read error is distinguishable from "no PIN set" (`false`) — callers
// treat `null` as "state unknown" rather than silently reporting the lock as off.
export async function isPinSet(): Promise<boolean | null> {
  if (!isAppLockSupported()) return null;
  try {
    const stored = await SecureStore.getItemAsync(PIN_KEY);
    return stored !== null;
  } catch (error) {
    console.error("[AppLock] Failed to read PIN state:", error);
    return null;
  }
}

export async function setPin(pin: string): Promise<void> {
  if (!PIN_PATTERN.test(pin)) {
    throw new Error("PIN must be exactly 4 digits");
  }
  if (!isAppLockSupported()) return;
  try {
    await SecureStore.setItemAsync(PIN_KEY, pin);
  } catch (error) {
    console.error("[AppLock] Failed to set PIN:", error);
    throw error;
  }
}

// Reads back the raw stored PIN — `verifyPin` already does this internally
// to compare against a candidate; this exposes that same read for the
// account-sync backfill (Story 13.6 B3), which needs the actual value to
// push, not just a match/no-match result.
export async function getPin(): Promise<string | null> {
  if (!isAppLockSupported()) return null;
  try {
    return await SecureStore.getItemAsync(PIN_KEY);
  } catch (error) {
    console.error("[AppLock] Failed to read PIN:", error);
    return null;
  }
}

export async function verifyPin(pin: string): Promise<boolean | null> {
  if (!isAppLockSupported()) return null;
  try {
    const stored = await SecureStore.getItemAsync(PIN_KEY);
    return stored !== null && stored === pin;
  } catch (error) {
    console.error("[AppLock] Failed to verify PIN:", error);
    return null;
  }
}

export async function isBiometricEnabled(): Promise<boolean | null> {
  if (!isAppLockSupported()) return null;
  try {
    const stored = await SecureStore.getItemAsync(BIOMETRIC_KEY);
    return stored === "true";
  } catch (error) {
    console.error("[AppLock] Failed to read biometric preference:", error);
    return null;
  }
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  if (!isAppLockSupported()) return;
  try {
    if (enabled) {
      await SecureStore.setItemAsync(BIOMETRIC_KEY, "true");
    } else {
      await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
    }
  } catch (error) {
    console.error("[AppLock] Failed to update biometric preference:", error);
    throw error;
  }
}

export type BiometricLabel =
  | "Face ID"
  | "Touch ID"
  | "Face unlock"
  | "Fingerprint";

// Returns null when there's no hardware or nothing is enrolled — the caller
// hides the toggle rather than show a switch that would silently fail (AC2).
export async function getBiometricLabel(): Promise<BiometricLabel | null> {
  if (!isAppLockSupported()) return null;
  try {
    const [hasHardware, isEnrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    if (!hasHardware || !isEnrolled) return null;

    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const hasFacial = types.includes(
      LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
    );
    const hasFingerprint = types.includes(
      LocalAuthentication.AuthenticationType.FINGERPRINT,
    );

    if (Platform.OS === "ios") {
      if (hasFacial) return "Face ID";
      if (hasFingerprint) return "Touch ID";
      return null;
    }
    if (hasFacial) return "Face unlock";
    if (hasFingerprint) return "Fingerprint";
    return null;
  } catch (error) {
    console.error("[AppLock] Failed to read biometric capability:", error);
    return null;
  }
}

// `disableDeviceFallback: true` keeps the OS sheet biometric-only so our PIN
// pad is the single fallback path — otherwise the device passcode becomes a
// second, unmanaged way in (Story 13.4 Notes).
export async function authenticateWithBiometrics(): Promise<boolean> {
  if (!isAppLockSupported()) return false;
  try {
    const result = await LocalAuthentication.authenticateAsync({
      disableDeviceFallback: true,
      cancelLabel: "Use PIN",
    });
    return result.success;
  } catch (error) {
    console.error("[AppLock] Biometric authentication failed:", error);
    return false;
  }
}

// Deletes the PIN and biometric keys independently (Promise.allSettled) so a
// failure on one key never skips the other — a partial clear (e.g. PIN gone,
// biometric preference orphaned) is worse than a failed clear the caller can retry.
export async function clearAppLock(): Promise<void> {
  if (!isAppLockSupported()) return;
  const results = await Promise.allSettled([
    SecureStore.deleteItemAsync(PIN_KEY),
    SecureStore.deleteItemAsync(BIOMETRIC_KEY),
  ]);
  const failures = results.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (failures.length > 0) {
    for (const failure of failures) {
      console.error("[AppLock] Failed to clear app lock key:", failure.reason);
    }
    throw failures[0].reason;
  }
}

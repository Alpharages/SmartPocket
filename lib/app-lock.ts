import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export const PIN_KEY = "app_lock_pin";
export const BIOMETRIC_KEY = "app_lock_biometric";

const PIN_PATTERN = /^\d{4}$/;

// expo-secure-store has no web implementation — app lock is a native-only
// feature (see docs/epics.md Epic 13). Callers gate on this before reading
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

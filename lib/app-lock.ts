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
    console.error("[AppLock] Failed to store PIN:", error);
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

export async function clearAppLock(): Promise<void> {
  if (!isAppLockSupported()) return;
  try {
    await SecureStore.deleteItemAsync(PIN_KEY);
  } catch (error) {
    console.error("[AppLock] Failed to clear PIN:", error);
  }
  try {
    await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
  } catch (error) {
    console.error("[AppLock] Failed to clear biometric flag:", error);
  }
}

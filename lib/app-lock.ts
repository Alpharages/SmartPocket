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

export async function isPinSet(): Promise<boolean | null> {
  if (!isAppLockSupported()) return null;
  const stored = await SecureStore.getItemAsync(PIN_KEY);
  return stored !== null;
}

export async function setPin(pin: string): Promise<void> {
  if (!PIN_PATTERN.test(pin)) {
    throw new Error("PIN must be exactly 4 digits");
  }
  if (!isAppLockSupported()) return;
  await SecureStore.setItemAsync(PIN_KEY, pin);
}

export async function verifyPin(pin: string): Promise<boolean | null> {
  if (!isAppLockSupported()) return null;
  const stored = await SecureStore.getItemAsync(PIN_KEY);
  return stored !== null && stored === pin;
}

export async function clearAppLock(): Promise<void> {
  if (!isAppLockSupported()) return;
  await SecureStore.deleteItemAsync(PIN_KEY);
  await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
}

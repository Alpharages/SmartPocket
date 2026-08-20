import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * local-first-sync-plan.md phase 4: the sync worker's device-local state —
 * whether the user has turned sync on, how far the pull cursor has gotten,
 * and whether this device has already reconciled its pre-sync local data
 * with the account (the one-time first-sync choice). All device-local, all
 * independent of the signed-in session itself.
 */
const SYNC_ENABLED_KEY = "sync_enabled";
const LAST_PULLED_SEQ_KEY = "sync_last_pulled_seq";
const FIRST_SYNC_DONE_KEY = "sync_first_sync_done";

// Sync only means anything where the app is already local-first: web always
// talks straight to the server (db-query.ts, no local SQLite), so there is
// nothing for it to sync. Mirrors lib/app-lock.ts's isAppLockSupported.
export function isSyncSupported(): boolean {
  return Platform.OS !== "web";
}

type SimpleStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function webStorage(): SimpleStorage | null {
  const storage = (
    globalThis as typeof globalThis & { localStorage?: SimpleStorage }
  ).localStorage;
  return storage ?? null;
}

async function readValue(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return webStorage()?.getItem(key) ?? null;
  }
  return SecureStore.getItemAsync(key);
}

async function writeValue(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    webStorage()?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function clearValue(key: string): Promise<void> {
  if (Platform.OS === "web") {
    webStorage()?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function isSyncEnabled(): Promise<boolean> {
  return (await readValue(SYNC_ENABLED_KEY)) === "true";
}

export async function setSyncEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    await writeValue(SYNC_ENABLED_KEY, "true");
  } else {
    await clearValue(SYNC_ENABLED_KEY);
  }
}

/** The server-assigned seq this device has already pulled through. 0 means "nothing yet". */
export async function getLastPulledSeq(): Promise<number> {
  const stored = await readValue(LAST_PULLED_SEQ_KEY);
  const parsed = stored ? Number(stored) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function setLastPulledSeq(seq: number): Promise<void> {
  await writeValue(LAST_PULLED_SEQ_KEY, String(seq));
}

/** Whether this device has already reconciled its pre-sync local data with the account. */
export async function hasCompletedFirstSync(): Promise<boolean> {
  return (await readValue(FIRST_SYNC_DONE_KEY)) === "true";
}

export async function markFirstSyncComplete(): Promise<void> {
  await writeValue(FIRST_SYNC_DONE_KEY, "true");
}

/** Test-only / sign-out: resets every piece of sync state on this device. */
export async function resetSyncState(): Promise<void> {
  await Promise.all([
    clearValue(SYNC_ENABLED_KEY),
    clearValue(LAST_PULLED_SEQ_KEY),
    clearValue(FIRST_SYNC_DONE_KEY),
  ]);
}

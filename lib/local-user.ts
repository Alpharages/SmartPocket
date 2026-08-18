import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { ulid } from "@shared/ulid";

/**
 * local-first-sync-plan.md, "What must change" point 3: local reads and
 * writes must never consult the session token. The in-process tRPC link
 * (lib/trpc.native.ts) resolves every call to a **synthetic local user** — "a
 * ULID minted on first launch and held in SecureStore" — so the app is fully
 * usable before, and after, ever signing in. That local user owns every local
 * row; signing in later *associates* it with an account (phase 4's
 * first-sync choice) rather than replacing it.
 */
const LOCAL_USER_OPEN_ID_KEY = "local_user_open_id";

type SimpleStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

// Mirrors lib/_core/auth.ts's web fallback — this module is only imported
// from native code paths in practice (lib/trpc.native.ts), but degrading
// gracefully on web keeps it safe to import anywhere and easy to test.
function webStorage(): SimpleStorage | null {
  const storage = (
    globalThis as typeof globalThis & { localStorage?: SimpleStorage }
  ).localStorage;
  return storage ?? null;
}

async function readStoredOpenId(): Promise<string | null> {
  if (Platform.OS === "web") {
    return webStorage()?.getItem(LOCAL_USER_OPEN_ID_KEY) ?? null;
  }
  return SecureStore.getItemAsync(LOCAL_USER_OPEN_ID_KEY);
}

async function writeStoredOpenId(openId: string): Promise<void> {
  if (Platform.OS === "web") {
    webStorage()?.setItem(LOCAL_USER_OPEN_ID_KEY, openId);
    return;
  }
  await SecureStore.setItemAsync(LOCAL_USER_OPEN_ID_KEY, openId);
}

async function getOrCreateLocalOpenId(): Promise<string> {
  const existing = await readStoredOpenId();
  if (existing) return existing;

  const minted = ulid();
  await writeStoredOpenId(minted);
  return minted;
}

// Memoize the *promise*, not the resolved value (mirrors
// server/_core/crypto.native.ts's key cache) — two concurrent first-launch
// callers must resolve to the same id instead of racing to mint two
// different local users.
let cachedOpenId: Promise<string> | null = null;

/** Get-or-create this device's stable local-user openId. */
export function getLocalOpenId(): Promise<string> {
  cachedOpenId ??= getOrCreateLocalOpenId();
  return cachedOpenId;
}

/** Test-only: undo the in-memory memoization between cases. */
export function __resetLocalOpenIdCacheForTests(): void {
  cachedOpenId = null;
}

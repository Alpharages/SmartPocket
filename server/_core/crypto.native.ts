import * as SecureStore from "expo-secure-store";
import { randomBytes } from "@noble/ciphers/utils.js";
import {
  decryptWithKey,
  encryptWithKey,
  isEncryptedCardNumber,
  maskCardNumber,
} from "./card-cipher";
import { base64ToBytes, bytesToBase64 } from "../../shared/base64";

export { isEncryptedCardNumber, maskCardNumber };

/**
 * On-device card-number encryption. Metro picks this file over `crypto.ts`
 * for native builds, and `server/db.ts` imports `encryptCardNumber` /
 * `decryptCardNumber` without knowing which one answered — see the doc
 * comment on `card-cipher.ts` for why the algorithm itself is shared.
 *
 * Two keys can be in play, and which one is in use says exactly where the
 * device is in its life:
 *
 * - **Device key.** Minted on first use, random, never leaves the phone. This
 *   is the correct key for a local-first app that has never signed in: there
 *   is no account to derive anything from, and nothing to agree with.
 * - **Account key.** Fetched from the server at first sync
 *   (`lib/sync/card-key-sync.ts`) and cached here. Shared by every device on
 *   the account, which is what makes a card added on phone A readable on
 *   phone B — local-first-sync-plan.md blocker 3.
 *
 * The switch between them is a one-time re-encryption, not a cutover: the
 * local rows already encrypted under the device key are rewritten under the
 * account key before the account key becomes current. Both keys are held in
 * `expo-secure-store` — the OS keychain/keystore, not app storage a backup or
 * a compromised filesystem could read.
 */
const DEVICE_KEY_STORAGE_KEY = "card_encryption_key_v1";
const ACCOUNT_KEY_STORAGE_KEY = "card_encryption_account_key_v1";

let cachedKeys: Promise<{ current: Uint8Array; device: Uint8Array }> | null =
  null;

async function loadKeys(): Promise<{
  current: Uint8Array;
  device: Uint8Array;
}> {
  const storedDevice = await SecureStore.getItemAsync(DEVICE_KEY_STORAGE_KEY);
  let device: Uint8Array;
  if (storedDevice) {
    device = base64ToBytes(storedDevice);
  } else {
    device = randomBytes(32);
    await SecureStore.setItemAsync(
      DEVICE_KEY_STORAGE_KEY,
      bytesToBase64(device),
    );
  }

  const storedAccount = await SecureStore.getItemAsync(
    ACCOUNT_KEY_STORAGE_KEY,
  );
  return {
    device,
    current: storedAccount ? base64ToBytes(storedAccount) : device,
  };
}

/**
 * Memoizes the *promise*, not just the resolved keys — two encrypt/decrypt
 * calls racing on first launch (before anything has been read or written yet)
 * must not each mint and persist their own device key, which would make
 * whichever wrote to SecureStore last the only one that can decrypt anything
 * encrypted under the other.
 */
function getKeys(): Promise<{ current: Uint8Array; device: Uint8Array }> {
  cachedKeys ??= loadKeys();
  return cachedKeys;
}

export async function encryptCardNumber(
  plain: string,
  // Accepted so this file and `crypto.ts` present the identical signature to
  // server/db.ts. Unused here: the device holds one account's key at a time,
  // in the keychain rather than in a row.
  _userId?: string,
): Promise<string> {
  const { current } = await getKeys();
  return encryptWithKey(plain, current);
}

/**
 * Falls back to the device key when the current key cannot open the value —
 * a row written before this device adopted the account key. AES-GCM's auth
 * tag makes trying-and-failing safe rather than a guess: a wrong key throws,
 * it does not return plausible garbage. The re-encryption at adoption time
 * should leave nothing in this state, so this is a safety net for a pass that
 * was interrupted, not the normal path.
 */
export async function decryptCardNumber(
  stored: string,
  _userId?: string,
): Promise<string> {
  if (!isEncryptedCardNumber(stored)) return stored;

  const { current, device } = await getKeys();
  try {
    return decryptWithKey(stored, current);
  } catch (err) {
    if (current === device) throw err;
    return decryptWithKey(stored, device);
  }
}

/** True once this device has adopted an account key. */
export async function hasAccountCardKey(): Promise<boolean> {
  return (await SecureStore.getItemAsync(ACCOUNT_KEY_STORAGE_KEY)) !== null;
}

/**
 * Re-encrypts `stored` (device key) under `accountKeyBase64`. Used by the
 * one-time adoption pass before the account key becomes current.
 */
export async function reencryptUnderAccountKey(
  stored: string,
  accountKeyBase64: string,
): Promise<string> {
  const plain = await decryptCardNumber(stored);
  return encryptWithKey(plain, base64ToBytes(accountKeyBase64));
}

/**
 * Makes the account key current. Call only after every local row has been
 * re-encrypted under it — `lib/sync/card-key-sync.ts` owns that ordering,
 * because a half-converted database with the account key already current
 * would be indistinguishable from one that never converted.
 */
export async function adoptAccountCardKey(
  accountKeyBase64: string,
): Promise<void> {
  await SecureStore.setItemAsync(ACCOUNT_KEY_STORAGE_KEY, accountKeyBase64);
  cachedKeys = null;
}

/** Test-only: undo the in-memory memoization between cases. */
export function __resetCardKeyCacheForTests(): void {
  cachedKeys = null;
}

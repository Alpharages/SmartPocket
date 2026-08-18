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
 * The key source is the one thing that has to differ: the server reads
 * `CARD_ENCRYPTION_KEY` from the environment, but a phone with no network
 * and no account has no environment variable to read and no server to ask.
 * A fresh 256-bit key is minted on first use and held in
 * `expo-secure-store` — the OS keychain/keystore, not app storage a backup
 * or a compromised filesystem could read.
 *
 * This is a deliberate, documented gap versus the plan: "the key has to be
 * derived from account credentials, not generated per-device" so a card
 * encrypted on phone A stays decryptable on phone B once sync links them.
 * That derivation needs an account identity to derive *from*, which is
 * Phase 4 (sync) territory — Phase 3 ships the fully-offline app, where
 * there is no second device yet to disagree with this one. Before first
 * sync ships, existing local rows encrypted under this device-random key
 * must be re-encrypted under the account-derived key; tracked as a Phase 4
 * migration step, not solved here.
 */

const KEY_STORAGE_KEY = "card_encryption_key_v1";

let cachedKey: Promise<Uint8Array> | null = null;

async function getOrCreateEncryptionKey(): Promise<Uint8Array> {
  const stored = await SecureStore.getItemAsync(KEY_STORAGE_KEY);
  if (stored) {
    return base64ToBytes(stored);
  }

  const fresh = randomBytes(32);
  await SecureStore.setItemAsync(KEY_STORAGE_KEY, bytesToBase64(fresh));
  return fresh;
}

/**
 * Memoizes the *promise*, not just the resolved key — two encrypt/decrypt
 * calls racing on first launch (before anything has been read or written
 * yet) must not each mint and persist their own key, which would make
 * whichever wrote to SecureStore last the only one that can decrypt
 * anything encrypted under the other.
 */
function getEncryptionKey(): Promise<Uint8Array> {
  cachedKey ??= getOrCreateEncryptionKey();
  return cachedKey;
}

export async function encryptCardNumber(plain: string): Promise<string> {
  const key = await getEncryptionKey();
  return encryptWithKey(plain, key);
}

export async function decryptCardNumber(stored: string): Promise<string> {
  const key = await getEncryptionKey();
  return decryptWithKey(stored, key);
}

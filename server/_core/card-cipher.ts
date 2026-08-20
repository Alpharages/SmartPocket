import { gcm } from "@noble/ciphers/aes.js";
import { concatBytes, randomBytes } from "@noble/ciphers/utils.js";
import { bytesToBase64, base64ToBytes } from "../../shared/base64";

/**
 * AES-256-GCM for card numbers at rest — the algorithm only, no key source.
 *
 * `@noble/ciphers` (pure JS, audited, no native module) rather than Node's
 * built-in `crypto`: this needs to run identically on the server (Node) and
 * on-device (Hermes has no `crypto` module) so the same encrypted value is
 * decryptable wherever it's read, which is the whole point of a synced
 * field. `server/_core/crypto.ts` (server, env-var key) and
 * `crypto.native.ts` (device, `expo-secure-store` key) both wrap this file —
 * neither reimplements the cipher, only where the key comes from.
 */

const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const VERSION_PREFIX = "v1:";

export function isEncryptedCardNumber(stored: string): boolean {
  return stored.startsWith(VERSION_PREFIX);
}

/** Encrypt a plaintext PAN for storage. Idempotent when already encrypted. */
export function encryptWithKey(plain: string, key: Uint8Array): string {
  if (isEncryptedCardNumber(plain)) {
    return plain;
  }

  const iv = randomBytes(IV_LENGTH);
  // noble's gcm() returns ciphertext with the 16-byte auth tag appended —
  // one opaque blob, unlike Node's `getAuthTag()` split. Stored as two
  // base64 segments (iv, ciphertext+tag) rather than Node's crypto.ts three
  // (iv, authTag, ciphertext).
  const ciphertextAndTag = gcm(key, iv).encrypt(
    new TextEncoder().encode(plain),
  );

  return `${VERSION_PREFIX}${bytesToBase64(iv)}:${bytesToBase64(ciphertextAndTag)}`;
}

/**
 * Decrypt a stored card number. Legacy plaintext rows (pre-migration) pass
 * through unchanged.
 *
 * Accepts both this module's two-segment format (`iv:ciphertext+tag`) and
 * the older Node-`crypto`-based three-segment format
 * (`iv:authTag:ciphertext`, from before this codebase moved to `@noble/
 * ciphers`) — any card encrypted before this change must stay decryptable
 * without a re-encryption pass. The two formats are reconciled by
 * reassembling the legacy layout's separate tag and ciphertext into the
 * single concatenated blob `@noble/ciphers` expects.
 */
export function decryptWithKey(stored: string, key: Uint8Array): string {
  if (!isEncryptedCardNumber(stored)) {
    return stored;
  }

  const payload = stored.slice(VERSION_PREFIX.length);
  const parts = payload.split(":");

  let iv: Uint8Array;
  let ciphertextAndTag: Uint8Array;

  if (parts.length === 2) {
    const [ivB64, combinedB64] = parts;
    iv = base64ToBytes(ivB64);
    ciphertextAndTag = base64ToBytes(combinedB64);
  } else if (parts.length === 3) {
    const [ivB64, authTagB64, ciphertextB64] = parts;
    iv = base64ToBytes(ivB64);
    const authTag = base64ToBytes(authTagB64);
    const ciphertext = base64ToBytes(ciphertextB64);
    if (authTag.length !== TAG_LENGTH) {
      throw new Error("Invalid encrypted card number format");
    }
    ciphertextAndTag = concatBytes(ciphertext, authTag);
  } else {
    throw new Error("Invalid encrypted card number format");
  }

  const plainBytes = gcm(key, iv).decrypt(ciphertextAndTag);
  return new TextDecoder().decode(plainBytes);
}

/** Return only the last four digits of a plaintext PAN for API/UI responses. */
export function maskCardNumber(plain: string): string {
  const trimmed = plain.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.slice(-4);
}

import { ENV } from "./env";
import {
  decryptWithKey,
  encryptWithKey,
  isEncryptedCardNumber,
  maskCardNumber,
} from "./card-cipher";
import { base64ToBytes, hexToBytes } from "../../shared/base64";

export { isEncryptedCardNumber, maskCardNumber };

function parseEncryptionKey(raw: string): Uint8Array {
  if (!raw) {
    throw new Error(
      "CARD_ENCRYPTION_KEY is not set — card numbers cannot be encrypted at rest",
    );
  }

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return hexToBytes(raw);
  }

  const decoded = base64ToBytes(raw);
  if (decoded.length === 32) {
    return decoded;
  }

  throw new Error(
    "CARD_ENCRYPTION_KEY must be 32 bytes (64-char hex or base64 encoding 32 bytes)",
  );
}

function getEncryptionKey(): Uint8Array {
  return parseEncryptionKey(ENV.cardEncryptionKey);
}

/**
 * Encrypt a plaintext PAN for storage. Idempotent when already encrypted.
 *
 * Async to match `crypto.native.ts`'s signature — the device build resolves
 * its key from `expo-secure-store`, which has no synchronous read API, so
 * both platforms present the same `Promise`-returning shape and every call
 * site in `server/db.ts` awaits either one unmodified. The server's own key
 * lookup (an env var) is synchronous; wrapping it in `Promise.resolve` here
 * costs nothing.
 */
export async function encryptCardNumber(plain: string): Promise<string> {
  return encryptWithKey(plain, getEncryptionKey());
}

/**
 * Decrypt a stored card number. Legacy plaintext rows (pre-migration) pass
 * through unchanged. See `encryptCardNumber` for why this is async.
 */
export async function decryptCardNumber(stored: string): Promise<string> {
  return decryptWithKey(stored, getEncryptionKey());
}

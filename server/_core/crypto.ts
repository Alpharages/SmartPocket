import { ENV } from "./env";
import {
  decryptWithKey,
  encryptWithKey,
  isEncryptedCardNumber,
  maskCardNumber,
} from "./card-cipher";
import { getOrCreateAccountCardKey } from "./card-key";
import { base64ToBytes, hexToBytes } from "../../shared/base64";
import type { Id } from "../../drizzle/schema";

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

/**
 * The pre-per-account global key. Decrypt-only now: every row written from
 * here on uses the account key, but rows written before
 * `drizzle/0015_user_card_key.sql` are still sitting in the database
 * encrypted under this one. Keep `CARD_ENCRYPTION_KEY` set until you are
 * confident none remain — a re-encryption happens naturally on the next write
 * to each card, so the set shrinks on its own.
 */
export function parseLegacyCardKey(): Uint8Array | null {
  try {
    return parseEncryptionKey(ENV.cardEncryptionKey);
  } catch {
    return null;
  }
}

/**
 * Encrypt a plaintext PAN for storage. Idempotent when already encrypted.
 *
 * Takes `userId` because the key is per-account (see `card-key.ts`) — this is
 * what lets the same ciphertext be read by the server and by every device on
 * the account, which is the whole point of a synced field. `crypto.native.ts`
 * presents the identical signature so `server/db.ts` runs unmodified against
 * whichever one Metro picked.
 */
export async function encryptCardNumber(
  plain: string,
  userId: Id,
): Promise<string> {
  return encryptWithKey(plain, await getOrCreateAccountCardKey(userId));
}

/**
 * Decrypt a stored card number. Legacy plaintext rows (pre-migration) pass
 * through unchanged. See `encryptCardNumber` for why this takes a `userId`.
 *
 * Falls back to the global env key when the account key cannot open the
 * value: a row written before the per-account key existed is still encrypted
 * under the old one, and there is no marker in the ciphertext to distinguish
 * the two — trying and failing is the only way to tell. AES-GCM's auth tag
 * makes that safe rather than a guess: a wrong key throws, it does not return
 * plausible garbage.
 */
export async function decryptCardNumber(
  stored: string,
  userId: Id,
): Promise<string> {
  if (!isEncryptedCardNumber(stored)) return stored;

  try {
    return decryptWithKey(stored, await getOrCreateAccountCardKey(userId));
  } catch (err) {
    const legacy = parseLegacyCardKey();
    if (!legacy) throw err;
    return decryptWithKey(stored, legacy);
  }
}

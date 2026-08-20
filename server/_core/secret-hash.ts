import { scryptAsync } from "@noble/hashes/scrypt.js";
import { randomBytes } from "@noble/hashes/utils.js";
import { equalBytes } from "@noble/ciphers/utils.js";
import { bytesToBase64, base64ToBytes } from "../../shared/base64";

/**
 * Salted scrypt hashing for any secret the server stores but must never be
 * able to read back — the App Lock PIN (`pin-crypto.ts`) and the account
 * password (`password.ts`).
 *
 * Extracted rather than duplicated: the two differ only in what counts as a
 * valid input, and a second hand-written copy of a hashing routine is exactly
 * the thing that quietly drifts — one gets a parameter bump, the other does
 * not, and nobody notices until the weaker one is the one that leaks.
 *
 * `@noble/hashes` (pure JS, audited, no native module) rather than Node's
 * built-in `crypto`: `server/routers.ts` also runs in-process against the
 * on-device database (local-first-sync-plan.md phase 3) and Hermes has no
 * `crypto` module to import. `scryptAsync`, not the sync variant, so the CPU
 * cost never blocks the single JS thread — on the server that thread is
 * serving every other request meanwhile; on-device it is the thread the UI
 * renders on.
 */

const VERSION_PREFIX = "scrypt:v1:";
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/**
 * Node's `scrypt` default cost parameters (N=2^14, r=8, p=1) — kept identical
 * so a hash produced before this codebase moved off Node's built-in `crypto`
 * still verifies exactly the same way after.
 */
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1, dkLen: KEY_LENGTH };

export function isSecretHash(stored: string): boolean {
  return stored.startsWith(VERSION_PREFIX);
}

/** `scrypt:v1:<saltB64>:<hashB64>`. Callers validate the secret's shape first. */
export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const hash = await scryptAsync(secret, salt, SCRYPT_OPTS);
  return `${VERSION_PREFIX}${bytesToBase64(salt)}:${bytesToBase64(hash)}`;
}

/** Constant-time compare against a stored hash. Never throws; fails closed. */
export async function verifySecretHash(
  secret: string,
  stored: string,
): Promise<boolean> {
  if (!isSecretHash(stored)) return false;

  const parts = stored.slice(VERSION_PREFIX.length).split(":");
  if (parts.length !== 2) return false;

  const [saltB64, hashB64] = parts;
  const salt = base64ToBytes(saltB64);
  const expected = base64ToBytes(hashB64);
  // Fail closed rather than silently comparing at a shorter, attacker-influenced
  // length — a truncated or corrupted stored hash must never verify.
  if (expected.length !== KEY_LENGTH) return false;

  const actual = await scryptAsync(secret, salt, {
    ...SCRYPT_OPTS,
    dkLen: expected.length,
  });
  return equalBytes(actual, expected);
}

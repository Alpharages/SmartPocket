import { hashSecret, verifySecretHash } from "./secret-hash";

/**
 * Account password hashing and the login brute-force gate.
 *
 * Hashing itself is `secret-hash.ts`, shared with the App Lock PIN. What this
 * module owns is everything specific to a password being the thing that gets
 * you an account in the first place: what counts as acceptable, how a wrong
 * one is throttled, and how a login on a *non-existent* account is made to
 * look identical to one on a real account.
 */

export const PASSWORD_MIN_LENGTH = 10;

/**
 * scrypt's cost is the point, which also makes an over-long password a free
 * CPU-exhaustion lever for an unauthenticated caller — the hash runs before
 * anything has proved who they are. 200 is far past any real passphrase.
 */
export const PASSWORD_MAX_LENGTH = 200;

export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${PASSWORD_MAX_LENGTH} characters`;
  }
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);
  return hashSecret(password);
}

export function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  return verifySecretHash(password, stored);
}

/**
 * A real scrypt hash of a throwaway value, used when the submitted email
 * matches no account.
 *
 * Returning early on "no such user" makes the two cases trivially
 * distinguishable by response time — scrypt is deliberately slow, so a hit
 * takes ~100ms and a miss would take ~0. That difference turns the login
 * endpoint into an account-enumeration oracle: an attacker learns which of a
 * leaked email list are registered here without guessing a single password.
 * Burning one equivalent hash on the miss path costs nothing real and removes
 * the signal.
 */
const ABSENT_USER_HASH_PROMISE = hashSecret("no-such-account");

export async function burnVerificationTime(password: string): Promise<void> {
  await verifySecretHash(password, await ABSENT_USER_HASH_PROMISE);
}

// ============================================================================
// Login throttle
//
// Keyed by email rather than by user row, because the whole point is to also
// cover attempts against addresses that have no row — that is what an
// enumeration or credential-stuffing run looks like. In-memory and therefore
// per-process: one API container is the current deployment, and a throttle
// that resets on restart is still worth far more than none.
//
// ponytail: single-process counter, move to a shared store if the API is ever
// run as more than one replica.
// ============================================================================

export const MAX_LOGIN_ATTEMPTS = 8;
export const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;

type Attempt = { count: number; firstAt: number };
const attempts = new Map<string, Attempt>();

/**
 * Drops every window that has already expired. Runs off the read side, which
 * every login hits, so the map needs no timer of its own and never grows past
 * the number of addresses tried inside one lockout window.
 */
function evictExpired(now: number): void {
  for (const [key, attempt] of attempts) {
    if (now - attempt.firstAt >= LOGIN_LOCKOUT_MS) attempts.delete(key);
  }
}

function key(email: string): string {
  return email.trim().toLowerCase();
}

export function isLoginLocked(email: string, now: number): boolean {
  evictExpired(now);
  const attempt = attempts.get(key(email));
  return attempt !== undefined && attempt.count >= MAX_LOGIN_ATTEMPTS;
}

export function recordFailedLogin(email: string, now: number): void {
  const k = key(email);
  const existing = attempts.get(k);
  if (!existing || now - existing.firstAt >= LOGIN_LOCKOUT_MS) {
    attempts.set(k, { count: 1, firstAt: now });
    return;
  }
  existing.count += 1;
}

export function clearLoginAttempts(email: string): void {
  attempts.delete(key(email));
}

/** Test-only: the counter is process-lifetime state, so tests must reset it between cases. */
export function __resetLoginThrottleForTests(): void {
  attempts.clear();
}

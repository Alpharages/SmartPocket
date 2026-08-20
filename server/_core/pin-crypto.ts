import { hashSecret, verifySecretHash } from "./secret-hash";
import type { Id } from "../../drizzle/schema";

const PIN_PATTERN = /^\d{4}$/;

/**
 * A 4-digit PIN is only 10,000 possibilities — scrypt slows down an offline
 * guess against a leaked hash, but server-side rate limiting (below) is what
 * actually makes the secret meaningful over the wire (ClickUp 86eyeq72c AC).
 *
 * The hashing itself lives in `secret-hash.ts`, shared with the account
 * password; see that file for why it is scrypt-over-@noble rather than Node
 * crypto. All this layer adds is the shape rule: anything that is not exactly
 * four digits is not a PIN and must never reach the hasher.
 */
export async function hashPin(pin: string): Promise<string> {
  if (!PIN_PATTERN.test(pin)) {
    throw new Error("PIN must be exactly 4 digits");
  }
  return hashSecret(pin);
}

/** Constant-time compare a submitted PIN against a stored hash. Never throws. */
export async function verifyPinHash(
  pin: string,
  stored: string,
): Promise<boolean> {
  if (!PIN_PATTERN.test(pin)) return false;
  return verifySecretHash(pin, stored);
}

// ============================================================================
// Server-side rate limiting (86eyeq72c AC: "PIN attempts are rate-limited
// server-side (a 4-digit secret is 10,000 possibilities — throttling is the
// only thing making it meaningful over the wire)")
//
// The actual increment/lockout state transition is performed as a single
// atomic SQL UPDATE (server/db.ts: resetExpiredPinLockout / recordFailedPinAttempt)
// guarded by a WHERE clause, not computed in JS then written back — a
// read-then-write in application code is a TOCTOU race under concurrent
// requests (round-2 review B1). `isPinLocked` below is a pure read-side
// predicate only, applied to a state already fetched from the DB.
// ============================================================================

export const MAX_PIN_ATTEMPTS = 5;
export const PIN_LOCKOUT_MS = 15 * 60 * 1000;

export interface PinAttemptState {
  failedAttempts: number;
  lockedUntil: Date | null;
}

export function isPinLocked(state: PinAttemptState, now: Date): boolean {
  return (
    state.lockedUntil !== null && state.lockedUntil.getTime() > now.getTime()
  );
}

// ============================================================================
// setPin throttle (round-2 review N3): `setPin` has no failed-attempt gate to
// piggyback on (it's not a guess, it's a write), but a session holder could
// still spam it to force a scrypt hash on every request. This is a cheap,
// single-process, in-memory cooldown — not a distributed rate limiter — good
// enough to blunt that without adding schema or infra for a non-guessing endpoint.
// ============================================================================

const SET_PIN_MIN_INTERVAL_MS = 2000;
const lastSetPinAt = new Map<Id, number>();

/**
 * Evicts every entry outside the throttle window. Called from the read side
 * (checked on every `setPin`) rather than on a timer, so the map never
 * needs its own scheduled cleanup — it just never grows past the number of
 * users who changed their PIN within the last `SET_PIN_MIN_INTERVAL_MS`
 * (round-2 review R7 — was unbounded, one entry per user forever).
 */
function evictExpiredSetPinEntries(now: number): void {
  for (const [userId, at] of lastSetPinAt) {
    if (now - at >= SET_PIN_MIN_INTERVAL_MS) lastSetPinAt.delete(userId);
  }
}

export function isSetPinThrottled(userId: Id, now: number): boolean {
  evictExpiredSetPinEntries(now);
  const last = lastSetPinAt.get(userId);
  return last !== undefined && now - last < SET_PIN_MIN_INTERVAL_MS;
}

export function recordSetPinAttempt(userId: Id, now: number): void {
  lastSetPinAt.set(userId, now);
}

/** Test-only: the throttle map is process-lifetime state, so tests must reset it between cases. */
export function __resetSetPinThrottleForTests(): void {
  lastSetPinAt.clear();
}

/** Test-only: verifies eviction actually shrinks the map (round-2 review R7), not just that expired entries are ignored. */
export function __setPinThrottleSizeForTests(): number {
  return lastSetPinAt.size;
}

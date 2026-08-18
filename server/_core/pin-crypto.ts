import { scryptAsync } from "@noble/hashes/scrypt.js";
import { randomBytes } from "@noble/hashes/utils.js";
import { equalBytes } from "@noble/ciphers/utils.js";
import { bytesToBase64, base64ToBytes } from "../../shared/base64";
import type { Id } from "../../drizzle/schema";

const VERSION_PREFIX = "scrypt:v1:";
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const PIN_PATTERN = /^\d{4}$/;

/**
 * Node's `scrypt` default cost parameters (N=2^14, r=8, p=1) — kept
 * identical so a hash produced before this module moved off Node's built-in
 * `crypto` verifies exactly the same way after.
 */
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1, dkLen: KEY_LENGTH };

/**
 * A 4-digit PIN is only 10,000 possibilities — scrypt slows down an offline
 * guess against a leaked hash, but server-side rate limiting (below) is what
 * actually makes the secret meaningful over the wire (ClickUp 86eyeq72c AC).
 *
 * `@noble/hashes` (pure JS, audited, no native module) rather than Node's
 * built-in `crypto`: `server/routers.ts`'s `securityRouter` needs to run
 * in-process against the on-device database (Phase 3 of the local-first
 * plan), and Hermes has no `crypto` module to import. This is the same
 * reason `server/_core/crypto.ts` (card encryption) moved off Node crypto —
 * see that file's doc comment for the fuller rationale. Uses the async
 * `scryptAsync` (not the sync `scrypt`) so the CPU cost never blocks the
 * single JS thread — on the server that thread serves every other request
 * meanwhile; on-device it's the thread the UI renders on.
 */
export async function hashPin(pin: string): Promise<string> {
  if (!PIN_PATTERN.test(pin)) {
    throw new Error("PIN must be exactly 4 digits");
  }
  const salt = randomBytes(SALT_LENGTH);
  const hash = await scryptAsync(pin, salt, SCRYPT_OPTS);
  return `${VERSION_PREFIX}${bytesToBase64(salt)}:${bytesToBase64(hash)}`;
}

/** Constant-time compare a submitted PIN against a stored hash. Never throws. */
export async function verifyPinHash(
  pin: string,
  stored: string,
): Promise<boolean> {
  if (!PIN_PATTERN.test(pin)) return false;
  if (!stored.startsWith(VERSION_PREFIX)) return false;

  const parts = stored.slice(VERSION_PREFIX.length).split(":");
  if (parts.length !== 2) return false;

  const [saltB64, hashB64] = parts;
  const salt = base64ToBytes(saltB64);
  const expected = base64ToBytes(hashB64);
  // Fail closed rather than silently comparing at a shorter, attacker-influenced
  // length — a truncated/corrupted stored hash must never verify (round-2 review N5).
  if (expected.length !== KEY_LENGTH) return false;

  const actual = await scryptAsync(pin, salt, {
    ...SCRYPT_OPTS,
    dkLen: expected.length,
  });
  return equalBytes(actual, expected);
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

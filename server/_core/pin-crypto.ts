import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const VERSION_PREFIX = "scrypt:v1:";
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const PIN_PATTERN = /^\d{4}$/;

/**
 * A 4-digit PIN is only 10,000 possibilities — scrypt slows down an offline
 * guess against a leaked hash, but server-side rate limiting (below) is what
 * actually makes the secret meaningful over the wire (ClickUp 86eyeq72c AC).
 *
 * Uses the async `scrypt` (not `scryptSync`) so the ~60-100ms CPU cost runs on
 * libuv's threadpool instead of blocking the single Node event loop — a
 * synchronous hash on every request would let one client stall the whole API
 * (round-2 review N3).
 */
export async function hashPin(pin: string): Promise<string> {
  if (!PIN_PATTERN.test(pin)) {
    throw new Error("PIN must be exactly 4 digits");
  }
  const salt = randomBytes(SALT_LENGTH);
  const hash = await scryptAsync(pin, salt, KEY_LENGTH);
  return `${VERSION_PREFIX}${salt.toString("base64")}:${hash.toString("base64")}`;
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
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  // Fail closed rather than silently comparing at a shorter, attacker-influenced
  // length — a truncated/corrupted stored hash must never verify (round-2 review N5).
  if (expected.length !== KEY_LENGTH) return false;

  const actual = await scryptAsync(pin, salt, expected.length);
  return timingSafeEqual(actual, expected);
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
const lastSetPinAt = new Map<number, number>();

export function isSetPinThrottled(userId: number, now: number): boolean {
  const last = lastSetPinAt.get(userId);
  return last !== undefined && now - last < SET_PIN_MIN_INTERVAL_MS;
}

export function recordSetPinAttempt(userId: number, now: number): void {
  lastSetPinAt.set(userId, now);
}

/** Test-only: the throttle map is process-lifetime state, so tests must reset it between cases. */
export function __resetSetPinThrottleForTests(): void {
  lastSetPinAt.clear();
}

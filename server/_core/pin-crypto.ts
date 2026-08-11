import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const VERSION_PREFIX = "scrypt:v1:";
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const PIN_PATTERN = /^\d{4}$/;

/**
 * A 4-digit PIN is only 10,000 possibilities — scrypt slows down an offline
 * guess against a leaked hash, but server-side rate limiting (below) is what
 * actually makes the secret meaningful over the wire (ClickUp 86eyeq72c AC).
 */
export function hashPin(pin: string): string {
  if (!PIN_PATTERN.test(pin)) {
    throw new Error("PIN must be exactly 4 digits");
  }
  const salt = randomBytes(SALT_LENGTH);
  const hash = scryptSync(pin, salt, KEY_LENGTH);
  return `${VERSION_PREFIX}${salt.toString("base64")}:${hash.toString("base64")}`;
}

/** Constant-time compare a submitted PIN against a stored hash. Never throws. */
export function verifyPinHash(pin: string, stored: string): boolean {
  if (!PIN_PATTERN.test(pin)) return false;
  if (!stored.startsWith(VERSION_PREFIX)) return false;

  const parts = stored.slice(VERSION_PREFIX.length).split(":");
  if (parts.length !== 2) return false;

  const [saltB64, hashB64] = parts;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  if (expected.length === 0) return false;

  const actual = scryptSync(pin, salt, expected.length);
  return timingSafeEqual(actual, expected);
}

// ============================================================================
// Server-side rate limiting (86eyeq72c AC: "PIN attempts are rate-limited
// server-side (a 4-digit secret is 10,000 possibilities — throttling is the
// only thing making it meaningful over the wire)")
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

/** Pure: computes the next attempt state after a failed verification. Takes `now` explicitly for testability. */
export function recordFailedAttempt(
  state: PinAttemptState,
  now: Date,
): PinAttemptState {
  const failedAttempts = state.failedAttempts + 1;
  const lockedUntil =
    failedAttempts >= MAX_PIN_ATTEMPTS
      ? new Date(now.getTime() + PIN_LOCKOUT_MS)
      : null;
  return { failedAttempts, lockedUntil };
}

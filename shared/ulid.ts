/**
 * ULID — the client-generated primary key for every synced row.
 *
 * Multi-device sync makes client-side ID generation non-negotiable: two phones
 * editing offline both reach for the next autoincrement value and collide on
 * push. A ULID is picked over UUIDv4 because it sorts lexicographically by
 * creation time, so `ORDER BY id` is a creation order, index writes stay at the
 * right-hand edge of the B-tree, and `id DESC` tiebreakers in existing queries
 * keep meaning what they meant under autoincrement.
 *
 * Layout (Crockford base32, 26 chars): 10 chars of millisecond timestamp
 * followed by 16 chars of randomness.
 */

/** Crockford's base32 — excludes I, L, O and U so a ULID can't be misread. */
const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ENCODING_LEN = ENCODING.length;
const TIME_LEN = 10;
const RANDOM_LEN = 16;

export const ULID_LENGTH = TIME_LEN + RANDOM_LEN;

/** Largest timestamp representable in 10 base32 chars — 10889-08-02. */
export const ULID_MAX_TIME = 281474976710655;

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export function isUlid(value: unknown): value is string {
  return typeof value === "string" && ULID_PATTERN.test(value);
}

/**
 * Fills `bytes` with random values.
 *
 * Hermes has no `crypto` global of its own, so this degrades to `Math.random`
 * on a bare React Native runtime. That is deliberately acceptable *here* and
 * nowhere else: the monotonic factory below guarantees uniqueness within a
 * device by incrementing the random component whenever two IDs are minted in
 * the same millisecond, so collision-resistance across devices is the only
 * property resting on this — and 80 bits of even a weak PRNG, partitioned by
 * millisecond, is far past the point where a birthday collision is plausible
 * for a personal expense tracker. No ULID is ever used as a secret.
 */
function fillRandom(bytes: Uint8Array): Uint8Array {
  const webCrypto = (
    globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }
  ).crypto;
  if (typeof webCrypto?.getRandomValues === "function") {
    webCrypto.getRandomValues(bytes);
    return bytes;
  }
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

function encodeTime(now: number): string {
  if (!Number.isInteger(now) || now < 0) {
    throw new Error("ULID timestamp must be a non-negative integer");
  }
  if (now > ULID_MAX_TIME) {
    throw new Error("ULID timestamp exceeds the 48-bit range");
  }

  let out = "";
  let remaining = now;
  for (let i = 0; i < TIME_LEN; i++) {
    const mod = remaining % ENCODING_LEN;
    out = ENCODING[mod] + out;
    remaining = (remaining - mod) / ENCODING_LEN;
  }
  return out;
}

function encodeRandom(): string {
  // One byte per character, reduced into the 32-symbol alphabet. Taking the low
  // 5 bits (rather than a modulo of the full byte) keeps the distribution flat.
  const bytes = fillRandom(new Uint8Array(RANDOM_LEN));
  let out = "";
  for (let i = 0; i < RANDOM_LEN; i++) {
    out += ENCODING[bytes[i] & 0x1f];
  }
  return out;
}

/**
 * Increments a base32 string by one, carrying leftwards.
 *
 * Returns `null` when every character is already the maximum symbol, which is
 * the signal that this millisecond's random space is exhausted — a caller that
 * has minted 32^16 IDs inside one millisecond has bigger problems, but the
 * factory falls back to fresh randomness rather than returning a duplicate.
 */
export function incrementBase32(value: string): string | null {
  const chars = value.split("");
  // Validated up front rather than as the carry reaches each character: a
  // corrupt symbol to the left of the increment point is still corrupt, and
  // silently returning a value built on it would hide the bug.
  for (const char of chars) {
    if (ENCODING.indexOf(char) === -1) {
      throw new Error(`Invalid base32 character: ${char}`);
    }
  }
  for (let i = chars.length - 1; i >= 0; i--) {
    const index = ENCODING.indexOf(chars[i]);
    if (index < ENCODING_LEN - 1) {
      chars[i] = ENCODING[index + 1];
      return chars.join("");
    }
    chars[i] = ENCODING[0];
  }
  return null;
}

/**
 * Builds a monotonic ULID generator.
 *
 * Two rows created in the same millisecond must still sort in insert order —
 * `ORDER BY date DESC, id DESC` in the transfers query depends on it, and a
 * bulk CSV import creates hundreds of rows inside a single tick. Within one
 * millisecond the random component is incremented rather than redrawn, which
 * makes the sequence strictly increasing.
 *
 * A clock that jumps backwards (NTP correction, user changing the date) would
 * otherwise mint IDs that sort before existing rows; the last-seen timestamp is
 * held and reused so the sequence never goes backwards.
 */
export function monotonicUlidFactory(
  now: () => number = () => Date.now(),
): () => string {
  let lastTime = -1;
  let lastRandom = "";

  return function ulid(): string {
    const time = now();

    if (time <= lastTime && lastRandom !== "") {
      const next = incrementBase32(lastRandom);
      if (next !== null) {
        lastRandom = next;
        return encodeTime(lastTime) + lastRandom;
      }
      // Random space exhausted for this millisecond — step the timestamp
      // forward instead of colliding. Still monotonic, still in the future
      // by at most a millisecond.
      lastTime += 1;
      lastRandom = encodeRandom();
      return encodeTime(lastTime) + lastRandom;
    }

    lastTime = time;
    lastRandom = encodeRandom();
    return encodeTime(time) + lastRandom;
  };
}

/** The process-wide generator. Every `INSERT` in `server/db.ts` mints ids here. */
export const ulid = monotonicUlidFactory();

/** Milliseconds since epoch encoded in a ULID's timestamp prefix. */
export function ulidTime(id: string): number {
  if (!isUlid(id)) {
    throw new Error(`Not a ULID: ${id}`);
  }
  let time = 0;
  for (let i = 0; i < TIME_LEN; i++) {
    time = time * ENCODING_LEN + ENCODING.indexOf(id[i]);
  }
  return time;
}

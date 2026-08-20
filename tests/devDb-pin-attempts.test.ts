import { ulid } from "@shared/ulid";
import type { Id } from "@/drizzle/schema";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { devQuery } from "@/server/_core/devDb";

// Exercises server/db.ts's ACTUAL query-building functions routed through the
// real (in-memory, but MySQL-semantics-faithful) devDb executor — not a
// hand-copied SQL string — so a regression in either the SQL text or its
// column order is genuinely caught here (round-2 review R1/R3). Mocking
// dbQuery to delegate to devQuery, rather than asserting query strings
// the way tests/security-pin.test.ts does, is what makes this catch R1: a
// mocked-string assertion can't see that MySQL evaluates SET assignments
// left to right. A real MySQL instance isn't reliably available in this
// sandbox; this is the next-best thing.

vi.mock("@/server/_core/db-query", () => ({
  dbQuery: (sql: string, params: unknown[] = []) => devQuery(sql, params),
}));

const { getUserPinState, recordFailedPinAttempt, resetExpiredPinLockout } =
  await import("@/server/db");

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

async function insertUser(): Promise<Id> {
  // The id travels with the row now — server/db.ts mints it client-side, so the
  // shim is exercised the same way the real writes exercise it.
  const id = ulid();
  await devQuery(
    "INSERT INTO users (id, openId, name, email, loginMethod) VALUES (?, ?, ?, ?, ?)",
    [id, "pin-attempt-test-user", "Test User", "test@example.com", "password"],
  );
  return id;
}

describe("devDb — SELECT with an explicit column list (round-2 review R3)", () => {
  it("getUserPinState projects only the requested columns", async () => {
    const userId = await insertUser();
    const state = await getUserPinState(userId);
    expect(state).toEqual({
      pinHash: null,
      pinFailedAttempts: 0,
      pinLockedUntil: null,
    });
  });
});

describe("server/db.ts recordFailedPinAttempt via devDb — left-to-right SET semantics (round-2 review R1/R3)", () => {
  beforeEach(() => {
    // devDb's store is module-level singleton state; each test uses its own
    // inserted user row so cases don't interfere.
  });

  it("locks out on the 5th consecutive failure, not the 4th — the exact off-by-one R1 found", async () => {
    const userId = await insertUser();
    const now = new Date("2026-01-01T00:00:00Z");

    for (let attempt = 1; attempt <= 4; attempt++) {
      const result = await recordFailedPinAttempt(userId, {
        maxAttempts: MAX_ATTEMPTS,
        lockedUntilIfTripped: new Date(now.getTime() + LOCKOUT_MS),
        now,
      });
      expect(result.counted).toBe(true);
      const state = await getUserPinState(userId);
      expect(state.pinFailedAttempts).toBe(attempt);
      // Must NOT be locked yet — this is exactly what R1 got wrong (locked at 4).
      expect(state.pinLockedUntil).toBeNull();
    }

    const fifth = await recordFailedPinAttempt(userId, {
      maxAttempts: MAX_ATTEMPTS,
      lockedUntilIfTripped: new Date(now.getTime() + LOCKOUT_MS),
      now,
    });
    expect(fifth.counted).toBe(true);
    const stateAfterFifth = await getUserPinState(userId);
    expect(stateAfterFifth.pinFailedAttempts).toBe(5);
    expect(stateAfterFifth.pinLockedUntil).not.toBeNull();
  });

  it("excludes an already-locked row via the WHERE guard (counted: false)", async () => {
    const userId = await insertUser();
    const now = new Date("2026-01-01T00:00:00Z");

    for (let i = 0; i < 5; i++) {
      await recordFailedPinAttempt(userId, {
        maxAttempts: MAX_ATTEMPTS,
        lockedUntilIfTripped: new Date(now.getTime() + LOCKOUT_MS),
        now,
      });
    }
    const locked = await getUserPinState(userId);
    expect(locked.pinLockedUntil).not.toBeNull();

    const sixth = await recordFailedPinAttempt(userId, {
      maxAttempts: MAX_ATTEMPTS,
      lockedUntilIfTripped: new Date(now.getTime() + LOCKOUT_MS),
      now,
    });
    expect(sixth.counted).toBe(false);
    const stateAfterSixth = await getUserPinState(userId);
    expect(stateAfterSixth.pinFailedAttempts).toBe(5);
  });

  it("resetExpiredPinLockout clears attempt state once the lockout has passed", async () => {
    const userId = await insertUser();
    const past = new Date("2026-01-01T00:00:00Z");

    for (let i = 0; i < 5; i++) {
      await recordFailedPinAttempt(userId, {
        maxAttempts: MAX_ATTEMPTS,
        lockedUntilIfTripped: new Date(past.getTime() + LOCKOUT_MS),
        now: past,
      });
    }
    const locked = await getUserPinState(userId);
    expect(locked.pinLockedUntil).not.toBeNull();

    const later = new Date(past.getTime() + LOCKOUT_MS + 1000);
    await resetExpiredPinLockout(userId, later);

    const reset = await getUserPinState(userId);
    expect(reset.pinFailedAttempts).toBe(0);
    expect(reset.pinLockedUntil).toBeNull();
  });

  it("resetExpiredPinLockout is a no-op while the lockout is still active", async () => {
    const userId = await insertUser();
    const now = new Date("2026-01-01T00:00:00Z");

    for (let i = 0; i < 5; i++) {
      await recordFailedPinAttempt(userId, {
        maxAttempts: MAX_ATTEMPTS,
        lockedUntilIfTripped: new Date(now.getTime() + LOCKOUT_MS),
        now,
      });
    }

    const stillLocked = new Date(now.getTime() + 1000);
    await resetExpiredPinLockout(userId, stillLocked);

    const state = await getUserPinState(userId);
    expect(state.pinFailedAttempts).toBe(5);
    expect(state.pinLockedUntil).not.toBeNull();
  });
});

describe("devDb — NOW() in a SET clause", () => {
  // MySQL evaluates NOW() natively and the SQLite engine rewrites it to a
  // bound parameter, so a statement assigning it is correct on both. devDb
  // understood NOW() only in a WHERE clause, which made `SET updatedAt =
  // NOW()` throw in local development alone — and `touchLastSignedIn`'s
  // caller treats its write as best-effort, so the failure surfaced as a log
  // line and a timestamp that silently never moved.
  it("assigns the current time rather than throwing", async () => {
    const id = ulid() as Id;
    const before = new Date("2020-01-01T00:00:00Z");
    await devQuery(
      "INSERT INTO users (id, openId, name, email, loginMethod, lastSignedIn) VALUES (?, ?, ?, ?, ?, ?)",
      [id, `open-${id}`, "NOW test", "now@example.com", "password", before],
    );

    await devQuery("UPDATE users SET lastSignedIn = NOW() WHERE id = ?", [id]);

    const rows = (await devQuery(
      "SELECT lastSignedIn FROM users WHERE id = ?",
      [id],
    )) as { lastSignedIn: Date }[];
    expect(rows[0].lastSignedIn.getTime()).toBeGreaterThan(before.getTime());
  });
});

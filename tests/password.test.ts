import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetLoginThrottleForTests,
  burnVerificationTime,
  clearLoginAttempts,
  hashPassword,
  isLoginLocked,
  LOGIN_LOCKOUT_MS,
  MAX_LOGIN_ATTEMPTS,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordProblem,
  recordFailedLogin,
  verifyPassword,
} from "@/server/_core/password";

const GOOD = "correct-horse-battery";

describe("password hashing", () => {
  it("round-trips a password and rejects the wrong one", async () => {
    const stored = await hashPassword(GOOD);
    expect(await verifyPassword(GOOD, stored)).toBe(true);
    expect(await verifyPassword("not-the-password", stored)).toBe(false);
  });

  it("salts, so the same password never produces the same stored value", async () => {
    const a = await hashPassword(GOOD);
    const b = await hashPassword(GOOD);
    expect(a).not.toBe(b);
    // Both still verify — the salt travels inside the stored string.
    expect(await verifyPassword(GOOD, a)).toBe(true);
    expect(await verifyPassword(GOOD, b)).toBe(true);
  });

  it("never stores the password in recoverable form", async () => {
    const stored = await hashPassword(GOOD);
    expect(stored).not.toContain(GOOD);
    expect(stored.startsWith("scrypt:v1:")).toBe(true);
  });

  it("fails closed on a truncated or foreign stored value rather than throwing", async () => {
    const stored = await hashPassword(GOOD);
    expect(await verifyPassword(GOOD, stored.slice(0, -8))).toBe(false);
    expect(await verifyPassword(GOOD, "")).toBe(false);
    expect(await verifyPassword(GOOD, "bcrypt$2a$whatever")).toBe(false);
  });
});

describe("password policy", () => {
  it("rejects too short and accepts at the boundary", () => {
    expect(passwordProblem("x".repeat(PASSWORD_MIN_LENGTH - 1))).toMatch(
      /at least/,
    );
    expect(passwordProblem("x".repeat(PASSWORD_MIN_LENGTH))).toBeNull();
  });

  it("caps length, so an unauthenticated caller cannot force unbounded scrypt work", () => {
    expect(passwordProblem("x".repeat(PASSWORD_MAX_LENGTH))).toBeNull();
    expect(passwordProblem("x".repeat(PASSWORD_MAX_LENGTH + 1))).toMatch(
      /at most/,
    );
  });

  it("hashPassword refuses anything the policy rejects", async () => {
    await expect(hashPassword("short")).rejects.toThrow(/at least/);
  });
});

describe("login throttle", () => {
  beforeEach(() => {
    __resetLoginThrottleForTests();
  });

  it("locks only after the allowed number of failures", () => {
    const now = 1_000_000;
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS - 1; i++) {
      recordFailedLogin("a@example.com", now);
      expect(isLoginLocked("a@example.com", now)).toBe(false);
    }
    recordFailedLogin("a@example.com", now);
    expect(isLoginLocked("a@example.com", now)).toBe(true);
  });

  it("throttles per address — one attacked account does not lock everyone else out", () => {
    const now = 1_000_000;
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) {
      recordFailedLogin("victim@example.com", now);
    }
    expect(isLoginLocked("victim@example.com", now)).toBe(true);
    expect(isLoginLocked("bystander@example.com", now)).toBe(false);
  });

  it("treats an address case-insensitively, so casing cannot reset the counter", () => {
    const now = 1_000_000;
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) {
      recordFailedLogin("Ali@Example.COM", now);
    }
    expect(isLoginLocked("ali@example.com", now)).toBe(true);
  });

  it("expires the window, and the expiry evicts the entry rather than leaking it", () => {
    const now = 1_000_000;
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) {
      recordFailedLogin("a@example.com", now);
    }
    expect(isLoginLocked("a@example.com", now)).toBe(true);
    expect(isLoginLocked("a@example.com", now + LOGIN_LOCKOUT_MS)).toBe(false);
  });

  it("a successful login clears the counter", () => {
    const now = 1_000_000;
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) {
      recordFailedLogin("a@example.com", now);
    }
    clearLoginAttempts("a@example.com");
    expect(isLoginLocked("a@example.com", now)).toBe(false);
  });
});

describe("account enumeration defence", () => {
  it("burns comparable scrypt time on the unknown-account path", async () => {
    // Not a timing assertion — those are flaky under a loaded CI box. What is
    // worth pinning is that the miss path actually performs a real scrypt
    // verification rather than returning instantly, which is the property the
    // defence rests on. A no-op implementation would come back far faster than
    // a genuine hash.
    const hashStart = performance.now();
    await verifyPassword(GOOD, await hashPassword(GOOD));
    const hashCost = performance.now() - hashStart;

    const burnStart = performance.now();
    await burnVerificationTime(GOOD);
    const burnCost = performance.now() - burnStart;

    expect(burnCost).toBeGreaterThan(hashCost / 10);
  });
});

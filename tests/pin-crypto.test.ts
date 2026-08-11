import { describe, expect, it } from "vitest";
import {
  hashPin,
  verifyPinHash,
  isPinLocked,
  recordFailedAttempt,
  MAX_PIN_ATTEMPTS,
  PIN_LOCKOUT_MS,
} from "@/server/_core/pin-crypto";

describe("hashPin / verifyPinHash", () => {
  it("round-trips a correct PIN", () => {
    const stored = hashPin("1234");
    expect(verifyPinHash("1234", stored)).toBe(true);
  });

  it("rejects a wrong PIN", () => {
    const stored = hashPin("1234");
    expect(verifyPinHash("4321", stored)).toBe(false);
  });

  it("never stores the plaintext PIN in the hash string", () => {
    const stored = hashPin("1234");
    expect(stored).not.toContain("1234");
  });

  it("produces a different hash for the same PIN (unique salt)", () => {
    const a = hashPin("1234");
    const b = hashPin("1234");
    expect(a).not.toBe(b);
  });

  it("throws for a non-4-digit PIN", () => {
    expect(() => hashPin("123")).toThrow(/4 digits/);
    expect(() => hashPin("12345")).toThrow(/4 digits/);
    expect(() => hashPin("abcd")).toThrow(/4 digits/);
  });

  it("verifyPinHash returns false (not throw) for malformed stored hashes", () => {
    expect(verifyPinHash("1234", "not-a-real-hash")).toBe(false);
    expect(verifyPinHash("1234", "")).toBe(false);
  });

  it("verifyPinHash returns false for a non-4-digit submitted PIN", () => {
    const stored = hashPin("1234");
    expect(verifyPinHash("12", stored)).toBe(false);
  });
});

describe("isPinLocked", () => {
  const now = new Date("2026-01-01T00:00:00Z");

  it("is not locked when lockedUntil is null", () => {
    expect(isPinLocked({ failedAttempts: 0, lockedUntil: null }, now)).toBe(
      false,
    );
  });

  it("is locked when lockedUntil is in the future", () => {
    const future = new Date(now.getTime() + 1000);
    expect(isPinLocked({ failedAttempts: 5, lockedUntil: future }, now)).toBe(
      true,
    );
  });

  it("is not locked when lockedUntil is in the past", () => {
    const past = new Date(now.getTime() - 1000);
    expect(isPinLocked({ failedAttempts: 5, lockedUntil: past }, now)).toBe(
      false,
    );
  });
});

describe("recordFailedAttempt", () => {
  const now = new Date("2026-01-01T00:00:00Z");

  it("increments failedAttempts without locking below the threshold", () => {
    const next = recordFailedAttempt(
      { failedAttempts: 0, lockedUntil: null },
      now,
    );
    expect(next.failedAttempts).toBe(1);
    expect(next.lockedUntil).toBeNull();
  });

  it("locks out once failedAttempts reaches MAX_PIN_ATTEMPTS", () => {
    const next = recordFailedAttempt(
      { failedAttempts: MAX_PIN_ATTEMPTS - 1, lockedUntil: null },
      now,
    );
    expect(next.failedAttempts).toBe(MAX_PIN_ATTEMPTS);
    expect(next.lockedUntil).toEqual(new Date(now.getTime() + PIN_LOCKOUT_MS));
  });
});

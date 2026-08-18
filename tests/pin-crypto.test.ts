import { beforeEach, describe, expect, it } from "vitest";
import {
  hashPin,
  verifyPinHash,
  isPinLocked,
  isSetPinThrottled,
  recordSetPinAttempt,
  MAX_PIN_ATTEMPTS,
  __resetSetPinThrottleForTests,
  __setPinThrottleSizeForTests,
} from "@/server/_core/pin-crypto";
import { testId } from "./helpers/ids";

describe("hashPin / verifyPinHash", () => {
  it("round-trips a correct PIN", async () => {
    const stored = await hashPin("1234");
    await expect(verifyPinHash("1234", stored)).resolves.toBe(true);
  });

  it("rejects a wrong PIN", async () => {
    const stored = await hashPin("1234");
    await expect(verifyPinHash("4321", stored)).resolves.toBe(false);
  });

  it("never stores the plaintext PIN in the hash string", async () => {
    const stored = await hashPin("1234");
    expect(stored).not.toContain("1234");
  });

  it("produces a different hash for the same PIN (unique salt)", async () => {
    const a = await hashPin("1234");
    const b = await hashPin("1234");
    expect(a).not.toBe(b);
  });

  it("throws for a non-4-digit PIN", async () => {
    await expect(hashPin("123")).rejects.toThrow(/4 digits/);
    await expect(hashPin("12345")).rejects.toThrow(/4 digits/);
    await expect(hashPin("abcd")).rejects.toThrow(/4 digits/);
  });

  it("verifyPinHash resolves false (not throw/reject) for malformed stored hashes", async () => {
    await expect(verifyPinHash("1234", "not-a-real-hash")).resolves.toBe(false);
    await expect(verifyPinHash("1234", "")).resolves.toBe(false);
  });

  it("verifyPinHash resolves false for a non-4-digit submitted PIN", async () => {
    const stored = await hashPin("1234");
    await expect(verifyPinHash("12", stored)).resolves.toBe(false);
  });

  it("fails closed on a truncated/corrupted stored hash instead of comparing short (N5)", async () => {
    const stored = await hashPin("1234");
    const [prefix, saltB64] = stored.split(":");
    const truncated = `${prefix}:${saltB64}:AAAA`;
    await expect(verifyPinHash("1234", truncated)).resolves.toBe(false);
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
    expect(
      isPinLocked(
        { failedAttempts: MAX_PIN_ATTEMPTS, lockedUntil: future },
        now,
      ),
    ).toBe(true);
  });

  it("is not locked when lockedUntil is in the past", () => {
    const past = new Date(now.getTime() - 1000);
    expect(
      isPinLocked({ failedAttempts: MAX_PIN_ATTEMPTS, lockedUntil: past }, now),
    ).toBe(false);
  });
});

describe("setPin throttle eviction (round-2 review R7)", () => {
  beforeEach(() => {
    __resetSetPinThrottleForTests();
  });

  it("evicts an expired entry instead of retaining it forever", () => {
    recordSetPinAttempt(testId(1), 0);
    expect(__setPinThrottleSizeForTests()).toBe(1);

    // Any later call to isSetPinThrottled evicts expired entries first.
    isSetPinThrottled(testId(2), 10_000);
    expect(__setPinThrottleSizeForTests()).toBe(0);
  });

  it("does not evict an entry still inside the throttle window", () => {
    recordSetPinAttempt(testId(1), 0);
    isSetPinThrottled(testId(2), 500);
    expect(__setPinThrottleSizeForTests()).toBe(1);
  });
});

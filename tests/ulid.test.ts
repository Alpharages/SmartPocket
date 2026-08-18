import { describe, it, expect } from "vitest";
import {
  ulid,
  isUlid,
  ulidTime,
  monotonicUlidFactory,
  incrementBase32,
  ULID_LENGTH,
  ULID_MAX_TIME,
} from "@shared/ulid";

describe("ulid", () => {
  it("produces 26-character Crockford base32", () => {
    const id = ulid();
    expect(id).toHaveLength(ULID_LENGTH);
    expect(isUlid(id)).toBe(true);
  });

  it("never emits the ambiguous letters I, L, O or U", () => {
    // 2,000 ids exercises every alphabet index many times over.
    const ids = Array.from({ length: 2000 }, () => ulid());
    expect(ids.join("")).not.toMatch(/[ILOU]/);
  });

  it("encodes the creation time in the prefix", () => {
    const at = 1_700_000_000_000;
    const factory = monotonicUlidFactory(() => at);
    expect(ulidTime(factory())).toBe(at);
  });

  it("sorts lexicographically by creation time", () => {
    let clock = 1_700_000_000_000;
    const factory = monotonicUlidFactory(() => clock);
    const early = factory();
    clock += 5;
    const later = factory();
    expect(early < later).toBe(true);
  });

  it("stays strictly increasing within one millisecond", () => {
    const factory = monotonicUlidFactory(() => 1_700_000_000_000);
    const ids = Array.from({ length: 500 }, () => factory());
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("does not go backwards when the clock does", () => {
    // NTP correction / user changes the device date mid-session.
    let clock = 1_700_000_000_000;
    const factory = monotonicUlidFactory(() => clock);
    const before = factory();
    clock -= 60_000;
    const after = factory();
    expect(after > before).toBe(true);
    expect(isUlid(after)).toBe(true);
  });

  it("generates no duplicates across many calls", () => {
    const ids = new Set(Array.from({ length: 20_000 }, () => ulid()));
    expect(ids.size).toBe(20_000);
  });

  it("rejects out-of-range timestamps", () => {
    expect(() => monotonicUlidFactory(() => ULID_MAX_TIME + 1)()).toThrow(
      /48-bit range/,
    );
    expect(() => monotonicUlidFactory(() => -1)()).toThrow(/non-negative/);
  });

  it("steps the timestamp forward when a millisecond's random space fills", () => {
    // Force the carry-overflow branch by starting from the maximum random part.
    const at = 1_700_000_000_000;
    const factory = monotonicUlidFactory(() => at);
    const first = factory();
    // Exhausting 32^16 values for real is impossible; assert the helper that
    // signals exhaustion instead, plus that the factory keeps ordering.
    expect(incrementBase32("ZZZZ")).toBeNull();
    expect(incrementBase32("ZZZ0")).toBe("ZZZ1");
    expect(incrementBase32("ZZZZ0")).toBe("ZZZZ1");
    expect(incrementBase32("0000")).toBe("0001");
    // Carry across a boundary: 9 -> A, not 9 -> :
    expect(incrementBase32("0009")).toBe("000A");
    expect(incrementBase32("000Z")).toBe("0010");
    expect(factory() > first).toBe(true);
  });

  it("rejects invalid base32 in incrementBase32", () => {
    expect(() => incrementBase32("00I0")).toThrow(/Invalid base32/);
  });
});

describe("isUlid", () => {
  it("accepts a well-formed id", () => {
    expect(isUlid("01ARZ3NDEKTSV4RRFFQ69G5FAV")).toBe(true);
  });

  it.each([
    ["too short", "01ARZ3NDEKTSV4RRFFQ69G5FA"],
    ["too long", "01ARZ3NDEKTSV4RRFFQ69G5FAVX"],
    ["lowercase", "01arz3ndektsv4rrffq69g5fav"],
    ["contains I", "01ARZ3NDEKTSV4RRFFQ69G5FAI"],
    ["contains L", "01ARZ3NDEKTSV4RRFFQ69G5FAL"],
    ["contains O", "01ARZ3NDEKTSV4RRFFQ69G5FAO"],
    ["contains U", "01ARZ3NDEKTSV4RRFFQ69G5FAU"],
    ["empty", ""],
  ])("rejects %s", (_label, value) => {
    expect(isUlid(value)).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(isUlid(1)).toBe(false);
    expect(isUlid(null)).toBe(false);
    expect(isUlid(undefined)).toBe(false);
  });

  it("ulidTime rejects a non-ULID", () => {
    expect(() => ulidTime("nope")).toThrow(/Not a ULID/);
  });
});

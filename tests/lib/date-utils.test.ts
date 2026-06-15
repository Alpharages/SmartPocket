import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getStartOfWeek } from "@/lib/date-utils";

describe("getStartOfWeek", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns Sunday midnight when first day is Sunday (default)", () => {
    // Wednesday 2026-06-10
    vi.setSystemTime(new Date(2026, 5, 10, 15, 30, 0));

    const start = getStartOfWeek(new Date(), 0);

    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(5);
    expect(start.getDate()).toBe(7); // Sunday
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    expect(start.getMilliseconds()).toBe(0);
  });

  it("returns Monday midnight when first day is Monday", () => {
    // Wednesday 2026-06-10
    vi.setSystemTime(new Date(2026, 5, 10, 9, 0, 0));

    const start = getStartOfWeek(new Date(), 1);

    expect(start.getDate()).toBe(8); // Monday
    expect(start.getDay()).toBe(1);
  });

  it("excludes prior Sunday when week starts Monday (AC3 boundary)", () => {
    // Monday 2026-06-08
    vi.setSystemTime(new Date(2026, 5, 8, 12, 0, 0));

    const start = getStartOfWeek(new Date(), 1);
    const sundayBefore = new Date(2026, 5, 7, 23, 30, 0);

    expect(sundayBefore < start).toBe(true);
    expect(new Date(2026, 5, 8, 0, 0, 0) >= start).toBe(true);
  });

  it("handles Saturday as first day of week", () => {
    // Wednesday 2026-06-10
    vi.setSystemTime(new Date(2026, 5, 10, 12, 0, 0));

    const start = getStartOfWeek(new Date(), 6);

    expect(start.getDay()).toBe(6); // Saturday
    expect(start.getDate()).toBe(6);
  });

  it("handles week boundary across month/year change", () => {
    // Thursday 2026-01-01
    vi.setSystemTime(new Date(2026, 0, 1, 10, 0, 0));

    const start = getStartOfWeek(new Date(), 1);

    expect(start.getFullYear()).toBe(2025);
    expect(start.getMonth()).toBe(11);
    expect(start.getDate()).toBe(29); // Monday Dec 29 2025
  });

  it("does not mutate the input date", () => {
    vi.setSystemTime(new Date(2026, 5, 10, 12, 0, 0));
    const input = new Date(2026, 5, 10, 18, 45, 30);
    const snapshot = input.getTime();

    getStartOfWeek(input, 0);

    expect(input.getTime()).toBe(snapshot);
  });

  it("uses local calendar days (no UTC shift at local midnight)", () => {
    // Late evening on week-start day — still same local calendar day
    const evening = new Date(2026, 5, 7, 23, 30, 0); // Sunday
    const start = getStartOfWeek(evening, 0);

    expect(start.getDate()).toBe(7);
    expect(evening >= start).toBe(true);
  });

  it("matches legacy Sunday behavior when firstDay is 0", () => {
    vi.setSystemTime(new Date(2026, 5, 10, 12, 0, 0));
    const now = new Date();
    const legacy = new Date(now);
    legacy.setDate(legacy.getDate() - legacy.getDay());
    legacy.setHours(0, 0, 0, 0);

    const start = getStartOfWeek(now, 0);

    expect(start.getTime()).toBe(legacy.getTime());
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatIsoDate, getStartOfWeek } from "@/lib/date-utils";

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

describe("formatIsoDate", () => {
  it("formats a date as YYYY-MM-DD using local calendar (AC3)", () => {
    const d = new Date(2026, 5, 16, 10, 0, 0); // 2026-06-16
    expect(formatIsoDate(d)).toBe("2026-06-16");
  });

  it("pads single-digit month and day with leading zero", () => {
    const d = new Date(2026, 0, 5, 0, 0, 0); // 2026-01-05
    expect(formatIsoDate(d)).toBe("2026-01-05");
  });

  it("handles December 31", () => {
    const d = new Date(2025, 11, 31, 23, 59, 59);
    expect(formatIsoDate(d)).toBe("2025-12-31");
  });

  it("uses local date, not UTC (not affected by time-of-day in local zone)", () => {
    const d = new Date(2026, 5, 16, 23, 59, 59); // local June 16 at 23:59
    expect(formatIsoDate(d)).toBe("2026-06-16");
  });

  it("handles year boundaries correctly (Jan 1)", () => {
    const d = new Date(2027, 0, 1, 0, 0, 0);
    expect(formatIsoDate(d)).toBe("2027-01-01");
  });
});

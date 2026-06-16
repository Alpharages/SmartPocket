import { describe, expect, it } from "vitest";

import {
  computeBudgetPercent,
  getMonthBoundaries,
  getWeekBoundaries,
} from "@/lib/budget-period";

describe("getMonthBoundaries", () => {
  it("returns first and last instant of the current month", () => {
    const now = new Date(2026, 5, 15, 12, 0, 0);
    const { monthStart, monthEnd } = getMonthBoundaries(now);

    expect(monthStart).toEqual(new Date(2026, 5, 1));
    expect(monthEnd).toEqual(new Date(2026, 6, 0, 23, 59, 59, 999));
  });
});

describe("getWeekBoundaries", () => {
  it("uses Monday as week start by default", () => {
    const wednesday = new Date(2026, 5, 17, 15, 0, 0);
    const { weekStart, weekEnd } = getWeekBoundaries(wednesday);

    expect(weekStart).toEqual(new Date(2026, 5, 15, 0, 0, 0, 0));
    expect(weekEnd).toEqual(new Date(2026, 5, 21, 23, 59, 59, 999));
  });

  it("honors first-day-of-week setting (Sunday)", () => {
    const wednesday = new Date(2026, 5, 17, 15, 0, 0);
    const { weekStart, weekEnd } = getWeekBoundaries(wednesday, 0);

    expect(weekStart).toEqual(new Date(2026, 5, 14, 0, 0, 0, 0));
    expect(weekEnd).toEqual(new Date(2026, 5, 20, 23, 59, 59, 999));
  });
});

describe("computeBudgetPercent", () => {
  it("returns ratio clamped at zero for negative spent", () => {
    expect(computeBudgetPercent("-5.00", "100.00")).toBe(0);
  });

  it("allows percent above 100%", () => {
    expect(computeBudgetPercent("150.00", "100.00")).toBe(1.5);
  });

  it("returns null for zero limit (no divide-by-zero)", () => {
    expect(computeBudgetPercent("50.00", "0.00")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import {
  computeMonthEndForecastState,
  projectMonthEndExpense,
} from "@/lib/forecast";

describe("computeMonthEndForecastState", () => {
  it("hides the forecast when not viewing the current month", () => {
    const result = computeMonthEndForecastState({
      isCurrentMonth: false,
      totalExpense: 300,
      anchorDate: new Date(2026, 5, 10),
    });

    expect(result.visible).toBe(false);
    expect(result.forecast).toBeNull();
  });

  it("shows the forecast when viewing the current month", () => {
    const result = computeMonthEndForecastState({
      isCurrentMonth: true,
      totalExpense: 300,
      anchorDate: new Date(2026, 5, 10),
    });

    expect(result.visible).toBe(true);
    expect(result.forecast?.projected).toBe(900);
  });
});

describe("projectMonthEndExpense", () => {
  it("projects mid-month spend at run-rate", () => {
    const result = projectMonthEndExpense({
      totalExpense: 300,
      date: new Date(2026, 5, 10),
    });

    expect(result.daysInMonth).toBe(30);
    expect(result.daysElapsed).toBe(10);
    expect(result.projected).toBe(900);
  });

  it("clamps daysElapsed to 1 on the first day of the month", () => {
    const result = projectMonthEndExpense({
      totalExpense: 50,
      date: new Date(2026, 5, 1),
    });

    expect(result.daysElapsed).toBe(1);
    expect(result.projected).toBe(50 * 30);
  });

  it("returns zero projection when spend is zero", () => {
    const result = projectMonthEndExpense({
      totalExpense: 0,
      date: new Date(2026, 5, 15),
    });

    expect(result.projected).toBe(0);
    expect(Number.isFinite(result.projected)).toBe(true);
  });

  it("returns actual total when the month is complete", () => {
    const result = projectMonthEndExpense({
      totalExpense: 420,
      date: new Date(2026, 5, 30),
    });

    expect(result.daysElapsed).toBe(30);
    expect(result.projected).toBe(420);
  });

  it("uses 28 days for February 2026", () => {
    const result = projectMonthEndExpense({
      totalExpense: 280,
      date: new Date(2026, 1, 14),
    });

    expect(result.daysInMonth).toBe(28);
    expect(result.daysElapsed).toBe(14);
    expect(result.projected).toBe(560);
  });

  it("uses 29 days for leap-year February 2028", () => {
    const result = projectMonthEndExpense({
      totalExpense: 290,
      date: new Date(2028, 1, 29),
    });

    expect(result.daysInMonth).toBe(29);
    expect(result.projected).toBe(290);
  });

  it("guards against non-finite totals", () => {
    const result = projectMonthEndExpense({
      totalExpense: Number.NaN,
      date: new Date(2026, 5, 10),
    });

    expect(result.projected).toBe(0);
    expect(Number.isFinite(result.projected)).toBe(true);
  });
});

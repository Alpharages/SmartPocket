import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testId } from "../helpers/ids";
import {
  calculateRemainingBalance,
  formatLoanCounterparty,
  formatLoanSchedule,
  formatNextDueLabel,
  isLoanOverdue,
  parseLoanRouteId,
  parseMoneyAmount,
} from "@/lib/loan-detail";

describe("parseLoanRouteId", () => {
  it("returns the segment when it is a well-formed ULID", () => {
    expect(parseLoanRouteId(testId(42))).toBe(testId(42));
    expect(parseLoanRouteId("01ARZ3NDEKTSV4RRFFQ69G5FAV")).toBe(
      "01ARZ3NDEKTSV4RRFFQ69G5FAV",
    );
  });

  it("takes the first segment when the router hands back an array", () => {
    expect(parseLoanRouteId([testId(42), testId(43)])).toBe(testId(42));
  });

  it("returns null for anything that is not a ULID", () => {
    expect(parseLoanRouteId("abc")).toBeNull();
    // A leftover deep link from before the id migration.
    expect(parseLoanRouteId("42")).toBeNull();
    expect(parseLoanRouteId("0")).toBeNull();
    expect(parseLoanRouteId("-1")).toBeNull();
    expect(parseLoanRouteId(undefined)).toBeNull();
    expect(parseLoanRouteId("01ARZ3NDEKTSV4RRFFQ69G5FAL")).toBeNull();
  });
});

describe("formatLoanCounterparty", () => {
  it("returns trimmed counterparty", () => {
    expect(formatLoanCounterparty("  Alex  ")).toBe("Alex");
  });

  it("falls back when empty or whitespace", () => {
    expect(formatLoanCounterparty(null)).toBe("No counterparty");
    expect(formatLoanCounterparty("   ")).toBe("No counterparty");
  });
});

describe("formatLoanSchedule", () => {
  it("describes installment-count schedules", () => {
    expect(
      formatLoanSchedule({
        periodicity: "monthly",
        installmentCount: 12,
        endDate: null,
        rate: "5.00",
      }),
    ).toBe("Monthly, 12 installments");
  });

  it("describes end-date schedules", () => {
    expect(
      formatLoanSchedule({
        periodicity: "weekly",
        installmentCount: null,
        endDate: new Date("2026-12-01T00:00:00.000Z"),
        rate: null,
      }),
    ).toMatch(/Weekly, until /);
  });

  it("handles no recurring schedule", () => {
    expect(
      formatLoanSchedule({
        periodicity: "none",
        installmentCount: null,
        endDate: null,
        rate: null,
      }),
    ).toBe("No recurring schedule");
  });
});

describe("calculateRemainingBalance", () => {
  it("subtracts repayments from principal", () => {
    expect(
      calculateRemainingBalance("1000.00", [
        { amount: "400.00" },
        { amount: "100.00" },
      ]),
    ).toBe("500.00");
  });

  it("returns principal when there are no repayments", () => {
    expect(calculateRemainingBalance("250.50", [])).toBe("250.50");
  });

  it("does not go below zero", () => {
    expect(calculateRemainingBalance("100.00", [{ amount: "150.00" }])).toBe(
      "0.00",
    );
  });
});

describe("parseMoneyAmount", () => {
  it("parses decimal strings", () => {
    expect(parseMoneyAmount("250.75")).toBe(250.75);
  });

  it("returns 0 for invalid values", () => {
    expect(parseMoneyAmount("abc")).toBe(0);
  });
});

describe("isLoanOverdue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns true when next due date is before today", () => {
    expect(isLoanOverdue(new Date("2026-06-01T00:00:00.000Z"), "active")).toBe(
      true,
    );
  });

  it("returns false for settled loans", () => {
    expect(isLoanOverdue(new Date("2020-01-01T00:00:00.000Z"), "settled")).toBe(
      false,
    );
  });

  it("returns false when due date is today or future", () => {
    expect(isLoanOverdue(new Date("2026-06-15T00:00:00.000Z"), "active")).toBe(
      false,
    );
    expect(isLoanOverdue(new Date("2026-07-01T00:00:00.000Z"), "active")).toBe(
      false,
    );
  });
});

describe("formatNextDueLabel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("marks overdue dates in the label", () => {
    const result = formatNextDueLabel(
      new Date("2026-06-01T00:00:00.000Z"),
      "active",
    );
    expect(result.overdue).toBe(true);
    expect(result.label).toMatch(/^Overdue — /);
  });

  it("returns settled label for settled loans", () => {
    expect(formatNextDueLabel(new Date(), "settled")).toEqual({
      label: "Settled",
      overdue: false,
    });
  });
});

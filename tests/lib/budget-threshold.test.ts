import { describe, expect, it } from "vitest";

import {
  BUDGET_NEAR_THRESHOLD,
  BUDGET_OVER_THRESHOLD,
  budgetPercent,
  budgetThresholdState,
} from "@/lib/budget-threshold";

describe("budgetPercent", () => {
  it("computes spent/limit ratio from decimal strings", () => {
    expect(budgetPercent("79", "100")).toBe(0.79);
    expect(budgetPercent("150", "100")).toBe(1.5);
  });

  it("returns 0 for zero or negative limit (no divide-by-zero)", () => {
    expect(budgetPercent("50", "0")).toBe(0);
    expect(budgetPercent("50", "0.00")).toBe(0);
    expect(budgetPercent("50", "-10")).toBe(0);
  });

  it("treats non-numeric spent as 0", () => {
    expect(budgetPercent("abc", "100")).toBe(0);
  });

  it("clamps negative spent to 0 ratio contribution", () => {
    expect(budgetPercent("-5", "100")).toBe(0);
  });
});

describe("budgetThresholdState", () => {
  it("maps AC1 state branches for all listed pairs", () => {
    expect(budgetThresholdState(79, 100)).toBe("ok");
    expect(budgetThresholdState(80, 100)).toBe("near");
    expect(budgetThresholdState(99.99, 100)).toBe("near");
    expect(budgetThresholdState(100, 100)).toBe("over");
    expect(budgetThresholdState(150, 100)).toBe("over");
  });

  it("maps utilization branches per AC1", () => {
    expect(budgetThresholdState(79, 100)).toBe("ok");
    expect(budgetThresholdState(80, 100)).toBe("near");
    expect(budgetThresholdState(99.99, 100)).toBe("near");
    expect(budgetThresholdState(100, 100)).toBe("over");
    expect(budgetThresholdState(150, 100)).toBe("over");
  });

  it("treats zero spent as ok", () => {
    expect(budgetThresholdState(0, 100)).toBe("ok");
    expect(budgetThresholdState("0.00", "100.00")).toBe("ok");
  });

  it("treats zero limit as ok with percent 0", () => {
    expect(budgetThresholdState("50.00", "0.00")).toBe("ok");
    expect(budgetPercent("50.00", "0.00")).toBe(0);
  });

  it("uses inclusive boundary thresholds", () => {
    expect(BUDGET_NEAR_THRESHOLD).toBe(0.8);
    expect(BUDGET_OVER_THRESHOLD).toBe(1.0);
    expect(budgetThresholdState(80, 100)).toBe("near");
    expect(budgetThresholdState(100, 100)).toBe("over");
  });
});

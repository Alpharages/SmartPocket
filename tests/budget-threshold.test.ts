import { describe, expect, it } from "vitest";

import {
  BUDGET_NEAR_THRESHOLD,
  BUDGET_OVER_THRESHOLD,
  budgetPercent,
  budgetThresholdState,
} from "../lib/budget-threshold";

describe("budgetPercent", () => {
  it("computes a normal ratio for number and string inputs", () => {
    expect(budgetPercent(50, 100)).toBe(0.5);
    expect(budgetPercent("79", "100")).toBe(0.79);
  });

  it("returns 0 for zero or negative limit", () => {
    expect(budgetPercent(50, 0)).toBe(0);
    expect(budgetPercent("50", "-10")).toBe(0);
  });

  it("treats non-numeric string inputs as 0", () => {
    expect(budgetPercent("abc", 100)).toBe(0);
    expect(budgetPercent(50, "def")).toBe(0);
  });

  it("clamps negative spent to 0", () => {
    expect(budgetPercent(-5, 100)).toBe(0);
    expect(budgetPercent("-5", "100")).toBe(0);
  });
});

describe("budgetThresholdState", () => {
  it("returns ok below the near threshold", () => {
    expect(budgetThresholdState(79, 100)).toBe("ok");
    expect(budgetThresholdState("79", "100")).toBe("ok");
  });

  it("returns near at the exact near boundary", () => {
    expect(BUDGET_NEAR_THRESHOLD).toBe(0.8);
    expect(budgetThresholdState(80, 100)).toBe("near");
    expect(budgetThresholdState("80", "100")).toBe("near");
  });

  it("returns over at the exact over boundary and above it", () => {
    expect(BUDGET_OVER_THRESHOLD).toBe(1);
    expect(budgetThresholdState(100, 100)).toBe("over");
    expect(budgetThresholdState("100", "100")).toBe("over");
    expect(budgetThresholdState(150, 100)).toBe("over");
  });
});

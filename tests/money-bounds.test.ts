import { describe, expect, it } from "vitest";

import {
  MAX_MONEY_AMOUNT,
  isValidMoneyString,
  isWithinMoneyRange,
} from "@shared/money";
import { isPositiveBudgetAmount } from "@/lib/budget-validation";
import { isPositiveMoney } from "@/lib/loan-form-validation";
import { isValidRepaymentAmount } from "@/lib/repayment-form-validation";
import { validateRecurringForm } from "@/lib/recurring-form-validation";
import { testId, syncColumns } from "./helpers/ids";

// SP-D18: the money regex was duplicated across seven client validators and
// seven server schemas with no upper bound, so a 15-digit amount passed every
// check on its way to a `decimal(12,2)` column.
describe("money upper bound (SP-D18)", () => {
  const FIFTEEN_DIGITS = "123456789012345";

  it("rejects an amount that cannot fit decimal(12,2)", () => {
    expect(isValidMoneyString(FIFTEEN_DIGITS)).toBe(false);
    expect(isWithinMoneyRange(FIFTEEN_DIGITS)).toBe(false);
  });

  it("accepts the largest storable amount", () => {
    expect(isValidMoneyString(String(MAX_MONEY_AMOUNT))).toBe(true);
  });

  it("still rejects malformed amounts", () => {
    expect(isValidMoneyString("12.345")).toBe(false);
    expect(isValidMoneyString("-5")).toBe(false);
    expect(isValidMoneyString("abc")).toBe(false);
  });

  it("applies the bound through every form validator", () => {
    expect(isPositiveBudgetAmount(FIFTEEN_DIGITS)).toBe(false);
    expect(isPositiveMoney(FIFTEEN_DIGITS)).toBe(false);
    expect(isValidRepaymentAmount(FIFTEEN_DIGITS)).toBe(false);
    expect(
      validateRecurringForm({
        type: "expense",
        amount: FIFTEEN_DIGITS,
        categoryId: testId(1),
        creditCardId: null,
        description: "",
        frequency: "monthly",
        interval: 1,
        endCondition: "never",
        occurrenceCount: "",
        startDate: new Date("2026-01-01"),
        endDate: null,
      }).amount,
    ).toBeTruthy();
  });
});

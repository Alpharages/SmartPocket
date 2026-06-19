import { describe, expect, it } from "vitest";
import {
  canSubmitRepayment,
  isValidRepaymentAmount,
  repaymentAmountError,
} from "@/lib/repayment-form-validation";

describe("repayment form validation", () => {
  it("accepts positive money amounts", () => {
    expect(isValidRepaymentAmount("12.50")).toBe(true);
    expect(isValidRepaymentAmount("0")).toBe(false);
    expect(isValidRepaymentAmount("abc")).toBe(false);
    expect(isValidRepaymentAmount("1.234")).toBe(false);
  });

  it("blocks amounts above remaining balance", () => {
    expect(canSubmitRepayment("200.00", "100.00")).toBe(false);
    expect(canSubmitRepayment("100.00", "100.00")).toBe(true);
    expect(repaymentAmountError("150", "100.00")).toBe(
      "Repayment cannot exceed remaining balance",
    );
  });
});

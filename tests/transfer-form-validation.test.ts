import { describe, expect, it } from "vitest";

import {
  createDefaultTransferForm,
  isTransferFormValid,
  validateTransferForm,
  type TransferFormValues,
} from "@/lib/transfer-form-validation";

describe("transfer-form-validation", () => {
  const valid: TransferFormValues = {
    fromAccountId: 1,
    toAccountId: 2,
    amount: "50.00",
    description: "",
    date: "2026-06-19",
  };

  it("accepts a valid transfer form", () => {
    expect(isTransferFormValid(valid)).toBe(true);
    expect(validateTransferForm(valid)).toEqual([]);
  });

  it("rejects same source and destination (AC3)", () => {
    const values = { ...valid, toAccountId: 1 };
    expect(isTransferFormValid(values)).toBe(false);
    expect(validateTransferForm(values)).toContainEqual({
      field: "toAccountId",
      message: "Destination must differ from source",
    });
  });

  it("rejects non-positive amounts (AC4)", () => {
    for (const amount of ["0", "-5", "", "abc", "12.345"]) {
      const values = { ...valid, amount };
      expect(isTransferFormValid(values)).toBe(false);
      expect(validateTransferForm(values).some((e) => e.field === "amount")).toBe(
        true,
      );
    }
  });

  it("accepts decimal(12,2) boundary amounts", () => {
    const values = { ...valid, amount: "9999999999.99" };
    expect(isTransferFormValid(values)).toBe(true);
  });

  it("defaults date to today in createDefaultTransferForm", () => {
    const form = createDefaultTransferForm();
    expect(form.fromAccountId).toBeNull();
    expect(form.toAccountId).toBeNull();
    expect(form.amount).toBe("");
    expect(form.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

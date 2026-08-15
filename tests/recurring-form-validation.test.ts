import { describe, expect, it } from "vitest";
import {
  formatDateInput,
  isRecurringFormValid,
  parseDateInput,
  validateRecurringForm,
  type RecurringFormValues,
} from "@/lib/recurring-form-validation";
import { testId, syncColumns } from "./helpers/ids";

const startDate = new Date(2026, 5, 17);

const validBase: RecurringFormValues = {
  type: "expense",
  amount: "50.00",
  categoryId: testId(1),
  creditCardId: null,
  description: "",
  frequency: "monthly",
  interval: 1,
  endCondition: "never",
  occurrenceCount: "",
  startDate,
  endDate: null,
};

describe("validateRecurringForm", () => {
  it("accepts a valid never-ending rule", () => {
    expect(validateRecurringForm(validBase)).toEqual({});
    expect(isRecurringFormValid(validBase)).toBe(true);
  });

  it("rejects invalid amount with three decimal places", () => {
    const errors = validateRecurringForm({ ...validBase, amount: "1.999" });
    expect(errors.amount).toBeTruthy();
    expect(isRecurringFormValid({ ...validBase, amount: "1.999" })).toBe(false);
  });

  it("rejects interval 0", () => {
    const errors = validateRecurringForm({ ...validBase, interval: 0 });
    expect(errors.interval).toBeTruthy();
  });

  it("requires occurrenceCount when endCondition is count", () => {
    const errors = validateRecurringForm({
      ...validBase,
      endCondition: "count",
      occurrenceCount: "",
    });
    expect(errors.occurrenceCount).toBeTruthy();
  });

  it("rejects endDate on or before startDate", () => {
    const errors = validateRecurringForm({
      ...validBase,
      endCondition: "endDate",
      endDate: startDate,
    });
    expect(errors.endDate).toBeTruthy();
  });

  it("accepts count endCondition with occurrenceCount >= 1", () => {
    const values = {
      ...validBase,
      endCondition: "count" as const,
      occurrenceCount: "3",
    };
    expect(validateRecurringForm(values)).toEqual({});
  });

  it("forbids endDate when endCondition is never", () => {
    const errors = validateRecurringForm({
      ...validBase,
      endDate: new Date(2026, 11, 31),
    });
    expect(errors.endDate).toBeTruthy();
  });
});

describe("parseDateInput / formatDateInput", () => {
  it("round-trips a valid calendar date", () => {
    const parsed = parseDateInput("2026-06-17");
    expect(parsed).not.toBeNull();
    expect(formatDateInput(parsed!)).toBe("2026-06-17");
  });

  it("rejects invalid dates", () => {
    expect(parseDateInput("2026-02-30")).toBeNull();
    expect(parseDateInput("not-a-date")).toBeNull();
  });
});

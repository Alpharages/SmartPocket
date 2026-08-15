// SP-D18: shape *and* upper bound — the bare regex accepted a 15-digit
// amount that no money column can hold.
import {
  MAX_MONEY_MESSAGE,
  MONEY_PATTERN,
  isWithinMoneyRange,
} from "@shared/money";
import type { Id } from "@/drizzle/schema";
export type RecurringEndCondition = "count" | "endDate" | "never";

export type RecurringFrequency = "daily" | "weekly" | "monthly" | "yearly";

export type RecurringFormValues = {
  type: "income" | "expense";
  amount: string;
  categoryId: Id | null;
  creditCardId: Id | null;
  description: string;
  frequency: RecurringFrequency;
  interval: number;
  endCondition: RecurringEndCondition;
  occurrenceCount: string;
  startDate: Date;
  endDate: Date | null;
};

export type RecurringFormField = keyof RecurringFormValues;

export type RecurringFormErrors = Partial<Record<RecurringFormField, string>>;

/** Parse YYYY-MM-DD into a local start-of-day Date, or null if invalid. */
export function parseDateInput(value: string): Date | null {
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function formatDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Client validation mirroring recurringTransactionSchema refine rules (Story 7.1). */
export function validateRecurringForm(
  values: RecurringFormValues,
): RecurringFormErrors {
  const errors: RecurringFormErrors = {};

  const trimmedAmount = values.amount.trim();
  if (!trimmedAmount || !MONEY_PATTERN.test(trimmedAmount)) {
    errors.amount = "Enter a valid amount (up to 2 decimal places)";
  } else if (!isWithinMoneyRange(trimmedAmount)) {
    errors.amount = MAX_MONEY_MESSAGE;
  }

  if (values.categoryId == null) {
    errors.categoryId = "Select a category";
  }

  if (!Number.isInteger(values.interval) || values.interval < 1) {
    errors.interval = "Interval must be at least 1";
  }

  if (values.endCondition === "count") {
    const count = parseInt(values.occurrenceCount, 10);
    if (!Number.isInteger(count) || count < 1) {
      errors.occurrenceCount = "Enter at least 1 occurrence";
    }
    if (values.endDate != null) {
      errors.endDate = "Remove end date when using occurrence count";
    }
  }

  if (values.endCondition === "endDate") {
    if (values.endDate == null || values.endDate <= values.startDate) {
      errors.endDate = "End date must be after start date";
    }
    if (values.occurrenceCount.trim() !== "") {
      errors.occurrenceCount = "Remove occurrence count when using end date";
    }
  }

  if (values.endCondition === "never") {
    if (values.endDate != null) {
      errors.endDate = "Remove end date for a never-ending rule";
    }
    if (values.occurrenceCount.trim() !== "") {
      errors.occurrenceCount =
        "Remove occurrence count for a never-ending rule";
    }
  }

  return errors;
}

export function isRecurringFormValid(values: RecurringFormValues): boolean {
  return Object.keys(validateRecurringForm(values)).length === 0;
}

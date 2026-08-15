// SP-D18: shape *and* upper bound — the bare regex accepted a 15-digit
// amount that no money column can hold.
import { isValidMoneyString } from "@shared/money";
import { formatDateInput, parseDateInput } from "./recurring-form-validation";
import type { Id } from "@/drizzle/schema";

export type TransferFormValues = {
  fromAccountId: Id | null;
  toAccountId: Id | null;
  amount: string;
  description: string;
  date: string;
};

export type TransferFormFieldError = {
  field: keyof TransferFormValues;
  message: string;
};

export function createDefaultTransferForm(): TransferFormValues {
  return {
    fromAccountId: null,
    toAccountId: null,
    amount: "",
    description: "",
    date: formatDateInput(new Date()),
  };
}

export function isPositiveMoney(value: string): boolean {
  const trimmed = value.trim();
  if (!isValidMoneyString(trimmed)) return false;
  return Number(trimmed) > 0;
}

export function validateTransferForm(
  values: TransferFormValues,
): TransferFormFieldError[] {
  const errors: TransferFormFieldError[] = [];

  if (values.fromAccountId == null) {
    errors.push({ field: "fromAccountId", message: "Select a source account" });
  }
  if (values.toAccountId == null) {
    errors.push({
      field: "toAccountId",
      message: "Select a destination account",
    });
  }
  if (
    values.fromAccountId != null &&
    values.toAccountId != null &&
    values.fromAccountId === values.toAccountId
  ) {
    errors.push({
      field: "toAccountId",
      message: "Destination must differ from source",
    });
  }
  if (!isPositiveMoney(values.amount)) {
    errors.push({
      field: "amount",
      message: "Enter a positive amount with up to 2 decimal places",
    });
  }
  if (!parseDateInput(values.date)) {
    errors.push({ field: "date", message: "Enter a valid date" });
  }

  return errors;
}

export function isTransferFormValid(values: TransferFormValues): boolean {
  return validateTransferForm(values).length === 0;
}

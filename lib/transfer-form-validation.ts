import { formatDateInput, parseDateInput } from "./recurring-form-validation";

export type TransferFormValues = {
  fromAccountId: number | null;
  toAccountId: number | null;
  amount: string;
  description: string;
  date: string;
};

export type TransferFormFieldError = {
  field: keyof TransferFormValues;
  message: string;
};

const MONEY_REGEX = /^\d+(\.\d{1,2})?$/;

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
  if (!MONEY_REGEX.test(trimmed)) return false;
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

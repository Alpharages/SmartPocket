import { formatDateInput, parseDateInput } from "./recurring-form-validation";

export type LoanDirection = "lend" | "borrow";
export type LoanPeriodicity = "weekly" | "monthly" | "yearly" | "none";
export type LoanScheduleMode = "count" | "endDate";

export type LoanFormValues = {
  direction: LoanDirection | "";
  counterparty: string;
  principal: string;
  rate: string;
  periodicity: LoanPeriodicity | "";
  scheduleMode: LoanScheduleMode;
  installmentCount: string;
  endDate: string;
  nextDueDate: string;
};

export type LoanFormMode = "create" | "edit";

export type LoanFormFieldError = {
  field: keyof LoanFormValues | "schedule";
  message: string;
};

const MONEY_REGEX = /^\d+(\.\d{1,2})?$/;

/** Sensible defaults so Save is reachable once principal is entered. */
export function createDefaultLoanForm(): LoanFormValues {
  const nextDue = new Date();
  nextDue.setMonth(nextDue.getMonth() + 1);
  return {
    direction: "lend",
    counterparty: "",
    principal: "",
    rate: "",
    periodicity: "monthly",
    scheduleMode: "count",
    installmentCount: "12",
    endDate: "",
    nextDueDate: formatDateInput(nextDue),
  };
}

export function isPositiveMoney(value: string): boolean {
  const trimmed = value.trim();
  if (!MONEY_REGEX.test(trimmed)) return false;
  return Number(trimmed) > 0;
}

export function isNonNegativeOptionalMoney(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (!MONEY_REGEX.test(trimmed)) return false;
  return Number(trimmed) >= 0;
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Shared schedule rules mirrored by loanSchema on the server. */
export function isValidLoanSchedule(
  periodicity: LoanPeriodicity | "",
  scheduleMode: LoanScheduleMode,
  installmentCount: string,
  endDate: string,
): boolean {
  if (!periodicity) return false;
  if (periodicity === "none") return true;

  if (scheduleMode === "count") {
    const count = parseInt(installmentCount.trim(), 10);
    return Number.isInteger(count) && count > 0;
  }

  const parsed = parseDateInput(endDate);
  if (!parsed) return false;
  return parsed > startOfToday();
}

/** Shared validation for create + edit loan forms (parity with loanSchema). */
export function isLoanFormValid(
  values: LoanFormValues,
  _mode: LoanFormMode,
): boolean {
  if (!values.direction) return false;
  if (!isPositiveMoney(values.principal)) return false;
  if (!isNonNegativeOptionalMoney(values.rate)) return false;
  if (
    !isValidLoanSchedule(
      values.periodicity,
      values.scheduleMode,
      values.installmentCount,
      values.endDate,
    )
  ) {
    return false;
  }

  const nextDue = parseDateInput(values.nextDueDate);
  if (!nextDue) return false;

  return true;
}

/** Human-readable reasons Save stays disabled — shown inline in the form. */
export function getLoanFormErrors(
  values: LoanFormValues,
  _mode: LoanFormMode = "create",
): LoanFormFieldError[] {
  const errors: LoanFormFieldError[] = [];

  if (!values.direction) {
    errors.push({ field: "direction", message: "Choose lend or borrow" });
  }
  if (!isPositiveMoney(values.principal)) {
    errors.push({
      field: "principal",
      message: "Enter a valid principal greater than zero",
    });
  }
  if (!isNonNegativeOptionalMoney(values.rate)) {
    errors.push({
      field: "rate",
      message: "Rate must be a number with up to 2 decimal places",
    });
  }
  if (!values.periodicity) {
    errors.push({ field: "periodicity", message: "Choose a schedule" });
  } else if (values.periodicity !== "none") {
    if (values.scheduleMode === "count") {
      const count = parseInt(values.installmentCount.trim(), 10);
      if (!Number.isInteger(count) || count <= 0) {
        errors.push({
          field: "installmentCount",
          message: "Enter the number of installments",
        });
      }
    } else {
      const parsed = parseDateInput(values.endDate);
      if (!parsed) {
        errors.push({
          field: "endDate",
          message: "Enter schedule end date as YYYY-MM-DD",
        });
      } else if (parsed <= startOfToday()) {
        errors.push({
          field: "endDate",
          message: "Schedule end date must be in the future",
        });
      }
    }
  }
  if (!parseDateInput(values.nextDueDate)) {
    errors.push({
      field: "nextDueDate",
      message: "Enter next due date as YYYY-MM-DD",
    });
  }

  return errors;
}

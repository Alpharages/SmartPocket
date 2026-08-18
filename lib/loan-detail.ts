import type { Id } from "@/drizzle/schema";
import { isUlid } from "@shared/ulid";
import type { Loan } from "./expense-context";

type LoanScheduleFields = Pick<
  Loan,
  "periodicity" | "installmentCount" | "endDate" | "rate"
>;

/**
 * Parse a route param into a loan id, or `null` when the segment is not a
 * well-formed ULID.
 *
 * Returned `null` rather than the old `NaN` sentinel: `NaN` only worked because
 * ids were numbers, and every caller had to remember `Number.isNaN` — a plain
 * `if (!id)` would have silently accepted it. `null` makes the invalid case
 * impossible to use by accident.
 */
export function parseLoanRouteId(id: string | string[] | undefined): Id | null {
  const raw = Array.isArray(id) ? id[0] : id;
  return isUlid(raw) ? raw : null;
}

export function formatLoanCounterparty(
  counterparty: string | null | undefined,
): string {
  const trimmed = counterparty?.trim();
  return trimmed || "No counterparty";
}

export function formatLoanDirection(direction: Loan["direction"]): string {
  return direction === "lend" ? "Lent" : "Borrowed";
}

function formatDisplayDate(date: Date): string {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return "—";
  return value.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatLoanSchedule(loan: LoanScheduleFields): string {
  if (loan.periodicity === "none") {
    return "No recurring schedule";
  }

  const period =
    loan.periodicity.charAt(0).toUpperCase() + loan.periodicity.slice(1);

  if (loan.installmentCount != null && loan.installmentCount > 0) {
    return `${period}, ${loan.installmentCount} installments`;
  }

  if (loan.endDate) {
    return `${period}, until ${formatDisplayDate(loan.endDate)}`;
  }

  return period;
}

/** Client fallback when only principal + repayments are available. */
export function calculateRemainingBalance(
  principal: string,
  repayments: { amount: string }[],
): string {
  const totalRepaid = repayments.reduce(
    (sum, repayment) => sum + parseMoneyAmount(repayment.amount),
    0,
  );
  const remaining = parseMoneyAmount(principal) - totalRepaid;
  return Math.max(0, remaining).toFixed(2);
}

export function parseMoneyAmount(value: string): number {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function isLoanOverdue(
  nextDueDate: Date | null | undefined,
  status: Loan["status"] = "active",
): boolean {
  if (status === "settled" || !nextDueDate) return false;

  const due = nextDueDate instanceof Date ? nextDueDate : new Date(nextDueDate);
  if (Number.isNaN(due.getTime())) return false;

  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  return dueDay < startOfToday();
}

export function formatNextDueLabel(
  nextDueDate: Date | null | undefined,
  status: Loan["status"] = "active",
): { label: string; overdue: boolean } {
  if (status === "settled") {
    return { label: "Settled", overdue: false };
  }

  if (!nextDueDate) {
    return { label: "No due date", overdue: false };
  }

  const due = nextDueDate instanceof Date ? nextDueDate : new Date(nextDueDate);
  if (Number.isNaN(due.getTime())) {
    return { label: "—", overdue: false };
  }

  const overdue = isLoanOverdue(nextDueDate, status);
  const formatted = formatDisplayDate(due);

  return {
    label: overdue ? `Overdue — ${formatted}` : formatted,
    overdue,
  };
}

export function formatRepaymentDate(date: Date): string {
  return formatDisplayDate(date);
}

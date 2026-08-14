// SP-D18: shape *and* upper bound — the bare regex accepted a 15-digit
// amount that no money column can hold.
import {
  MAX_MONEY_MESSAGE,
  MONEY_PATTERN,
  isValidMoneyString,
  isWithinMoneyRange,
} from "@shared/money";

export function isValidRepaymentAmount(amount: string): boolean {
  const trimmed = amount.trim();
  return isValidMoneyString(trimmed) && Number(trimmed) > 0;
}

export function canSubmitRepayment(
  amount: string,
  remainingBalance: string,
): boolean {
  if (!isValidRepaymentAmount(amount)) {
    return false;
  }
  return Number(amount.trim()) <= Number(remainingBalance);
}

export function repaymentAmountError(
  amount: string,
  remainingBalance: string,
): string | null {
  const trimmed = amount.trim();
  if (!trimmed) {
    return null;
  }
  if (!MONEY_PATTERN.test(trimmed)) {
    return "Enter a valid amount (up to 2 decimal places)";
  }
  if (!isWithinMoneyRange(trimmed)) {
    return MAX_MONEY_MESSAGE;
  }
  if (Number(trimmed) <= 0) {
    return "Amount must be greater than zero";
  }
  if (Number(trimmed) > Number(remainingBalance)) {
    return "Repayment cannot exceed remaining balance";
  }
  return null;
}

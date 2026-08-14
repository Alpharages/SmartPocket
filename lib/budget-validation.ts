// SP-D18: shape *and* upper bound — the bare regex accepted a 15-digit
// amount that no money column can hold.
import { isValidMoneyString } from "@shared/money";
export function isPositiveBudgetAmount(value: string): boolean {
  if (!isValidMoneyString(value)) {
    return false;
  }
  return Number(value) > 0;
}

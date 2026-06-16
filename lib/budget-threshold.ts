export type BudgetThresholdState = "ok" | "near" | "over";

export const BUDGET_NEAR_THRESHOLD = 0.8;
export const BUDGET_OVER_THRESHOLD = 1.0;

/** Ratio of spent to limit; 0 when limit is non-positive (no divide-by-zero). */
export function budgetPercent(
  spent: string | number,
  limit: string | number,
): number {
  const s = typeof spent === "string" ? parseFloat(spent) : spent;
  const l = typeof limit === "string" ? parseFloat(limit) : limit;
  if (!l || l <= 0 || Number.isNaN(l)) return 0;
  return Math.max(0, (Number.isNaN(s) ? 0 : s) / l);
}

export function budgetThresholdState(
  spent: string | number,
  limit: string | number,
): BudgetThresholdState {
  const pct = budgetPercent(spent, limit);
  if (pct >= BUDGET_OVER_THRESHOLD) return "over";
  if (pct >= BUDGET_NEAR_THRESHOLD) return "near";
  return "ok";
}

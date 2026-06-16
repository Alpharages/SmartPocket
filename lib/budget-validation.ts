export function isPositiveBudgetAmount(value: string): boolean {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    return false;
  }
  return Number(value) > 0;
}

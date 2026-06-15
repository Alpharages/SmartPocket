import type { Transaction } from "./expense-context";

/** Sum decimal string amounts for linked card transactions (client-side total). */
export function sumCardTransactionTotal(
  transactions: Pick<Transaction, "amount">[],
): number {
  return transactions.reduce((sum, txn) => {
    const parsed = parseFloat(txn.amount);
    return sum + (Number.isFinite(parsed) ? parsed : 0);
  }, 0);
}

/** Parse a route param into a positive card id, or NaN when invalid. */
export function parseCardRouteId(id: string | string[] | undefined): number {
  const raw = Array.isArray(id) ? id[0] : id;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
    return Number.NaN;
  }
  return parsed;
}

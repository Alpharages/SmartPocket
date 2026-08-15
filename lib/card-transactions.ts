import type { Id } from "@/drizzle/schema";
import { isUlid } from "@shared/ulid";
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

/**
 * Parse a route param into a card id, or `null` when the segment is not a
 * well-formed ULID.
 *
 * Returned `null` rather than the old `NaN` sentinel: `NaN` only worked because
 * ids were numbers, and every caller had to remember `Number.isNaN` — a plain
 * `if (!id)` would have silently accepted it. `null` makes the invalid case
 * impossible to use by accident.
 */
export function parseCardRouteId(
  id: string | string[] | undefined,
): Id | null {
  const raw = Array.isArray(id) ? id[0] : id;
  return isUlid(raw) ? raw : null;
}

/**
 * Money validation shared by the client forms and the tRPC input schemas.
 *
 * SP-D18: `^\d+(\.\d{1,2})?$` was pasted into seven client validators and
 * seven server schemas, and none of them had an upper bound — a 15-digit
 * amount passed every check on the way to a `decimal(12,2)` column, which
 * cannot hold it. The bound is the column's own capacity, so client and server
 * reject the same values for the same reason.
 */

/** Shape only: digits with at most two decimal places, no sign. */
export const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

/**
 * Largest storable amount. Every money column in the schema is
 * `decimal(12,2)` — ten integer digits plus two decimals.
 */
export const MAX_MONEY_AMOUNT = 9_999_999_999.99;

export const MAX_MONEY_MESSAGE = "Amount is too large";

/** Is this a well-formed amount that also fits the column? */
export function isValidMoneyString(value: string): boolean {
  const trimmed = value.trim();
  if (!MONEY_PATTERN.test(trimmed)) return false;
  return Number(trimmed) <= MAX_MONEY_AMOUNT;
}

/** Is this amount within range? Assumes the shape already matched. */
export function isWithinMoneyRange(value: string): boolean {
  return Number(value.trim()) <= MAX_MONEY_AMOUNT;
}

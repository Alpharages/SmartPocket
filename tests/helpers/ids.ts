import type { Id } from "@/drizzle/schema";
import { ULID_LENGTH } from "@shared/ulid";

/**
 * A deterministic, readable ULID for fixtures.
 *
 * Tests were written against autoincrement ids, so their fixtures read
 * `userId: 42` and their assertions compare against `1`. Swapping those for
 * real generated ULIDs would make every fixture opaque and every failure
 * message unreadable. `testId(42)` instead zero-pads to a well-formed 26-char
 * Crockford base32 string — decimal digits are already in the alphabet — so the
 * id passes `isUlid` and the router's `idSchema`, while still showing which
 * fixture it is at a glance.
 *
 * Ordering is preserved for same-width numbers, which matters for the handful
 * of assertions that depend on `ORDER BY id`.
 */
export function testId(n: number): Id {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`testId expects a non-negative integer, got ${n}`);
  }
  return String(n).padStart(ULID_LENGTH, "0");
}

/**
 * The sync columns every data row carries. Spread into a row fixture so adding
 * a future sync column does not mean editing a hundred literals.
 *
 * Defaults describe a row that is in step with the server: not deleted, not
 * awaiting a push. Override per test when exercising the sync paths.
 */
export function syncColumns(
  overrides: Partial<{
    deletedAt: Date | null;
    dirty: boolean;
    serverSeq: number | null;
  }> = {},
) {
  return {
    deletedAt: null,
    dirty: false,
    serverSeq: null,
    ...overrides,
  };
}

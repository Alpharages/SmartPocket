import { beforeEach, describe, expect, it, vi } from "vitest";
import { testId } from "./helpers/ids";

const callDataApi = vi.fn();

vi.mock("@/server/_core/dataApi", () => ({
  callDataApi: (...args: unknown[]) => callDataApi(...args),
}));

// The table list `deleteAllUserData` walks, in the FK-safe order server/db.ts
// wipes them (children before the parents they reference).
const TOMBSTONED_TABLES = [
  "recurringTransactions",
  "repayments",
  "loans",
  "budgets",
  "monthlySummaries",
  "transactions",
  "transfers",
  "accounts",
  "creditCards",
  "categories",
];

describe("deleteAllUserData", () => {
  beforeEach(() => {
    callDataApi.mockReset();
    callDataApi.mockResolvedValue(undefined);
    vi.resetModules();
  });

  it("tombstones every synced table, then clears the account-linked PIN, scoped by userId", async () => {
    const { deleteAllUserData } = await import("@/server/db");

    await deleteAllUserData(testId(42));

    // Ten tombstoning UPDATEs (soft delete, not DELETE — a hard delete could
    // never propagate to another device) plus the PIN clear.
    expect(callDataApi).toHaveBeenCalledTimes(TOMBSTONED_TABLES.length + 1);

    const queries = callDataApi.mock.calls.map(
      (call) =>
        (call[1] as { body: { query: string; params: unknown[] } }).body,
    );

    TOMBSTONED_TABLES.forEach((table, index) => {
      expect(queries[index].query).toContain(
        `UPDATE ${table} SET deletedAt = ?, updatedAt = ?, dirty = 1 WHERE userId = ? AND deletedAt IS NULL`,
      );
      // Both timestamps come from the same stamp, so they're equal — and
      // identical to every other table's stamp in this one wipe.
      const [deletedAt, updatedAt, userId] = queries[index].params;
      expect(deletedAt).toBeInstanceOf(Date);
      expect(deletedAt).toEqual(updatedAt);
      expect(userId).toBe(testId(42));
    });

    // N7: clearing all data must also drop the account-linked PIN state —
    // otherwise a wiped account keeps a stale hash and lockout.
    const pinClear = queries[TOMBSTONED_TABLES.length];
    expect(pinClear.query).toMatch(
      /UPDATE users SET pinHash = \?, pinFailedAttempts = \?, pinLockedUntil = \? WHERE id = \?/,
    );
    expect(pinClear.params).toEqual([null, 0, null, testId(42)]);
  });

  it("propagates errors from the data API", async () => {
    callDataApi.mockRejectedValueOnce(new Error("db unavailable"));
    const { deleteAllUserData } = await import("@/server/db");

    await expect(deleteAllUserData(testId(1))).rejects.toThrow(
      "db unavailable",
    );
  });
});

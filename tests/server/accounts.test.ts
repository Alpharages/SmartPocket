import { beforeEach, describe, expect, it, vi } from "vitest";
import { testId, syncColumns } from "../helpers/ids";

const dbQuery = vi.fn();

vi.mock("@/server/_core/db-query", () => ({
  dbQuery: (...args: unknown[]) => dbQuery(...args),
}));

describe("account db helpers", () => {
  beforeEach(() => {
    dbQuery.mockReset();
    vi.resetModules();
  });

  it("counts transactions scoped by userId and accountId", async () => {
    dbQuery.mockResolvedValueOnce([{ txCount: 4 }]);
    const { getAccountTransactionCount } = await import("@/server/db");

    await expect(
      getAccountTransactionCount(testId(7), testId(42)),
    ).resolves.toBe(4);

    expect(dbQuery).toHaveBeenCalledWith("Database/query", {
      body: {
        query:
          "SELECT COUNT(*) as txCount FROM transactions WHERE userId = ? AND accountId = ? AND deletedAt IS NULL",
        params: [testId(42), testId(7)],
      },
    });
  });

  it("propagates transaction count query failures", async () => {
    dbQuery.mockRejectedValueOnce(new Error("database unavailable"));
    const { getAccountTransactionCount } = await import("@/server/db");

    await expect(
      getAccountTransactionCount(testId(1), testId(1)),
    ).rejects.toThrow("database unavailable");
  });

  it("reassigns transactions with user-scoped predicates", async () => {
    dbQuery.mockResolvedValueOnce(undefined);
    const { reassignAccountTransactions } = await import("@/server/db");

    await reassignAccountTransactions(testId(3), testId(9), testId(42));

    expect(dbQuery).toHaveBeenCalledWith("Database/query", {
      body: {
        query: expect.stringContaining(
          "UPDATE transactions SET accountId = ?, updatedAt = ?, dirty = 1 WHERE userId = ? AND accountId = ?",
        ),
        params: [testId(9), expect.any(Date), testId(42), testId(3)],
      },
    });
  });

  it("rejects reassign-and-delete when source and target are the same account", async () => {
    const { reassignAndDeleteAccount } = await import("@/server/db");

    await expect(
      reassignAndDeleteAccount(testId(5), testId(5), testId(1)),
    ).rejects.toThrow("Cannot reassign to the same account");
    expect(dbQuery).not.toHaveBeenCalled();
  });

  it("derives per-account balances from user transactions", async () => {
    dbQuery.mockResolvedValueOnce([
      { id: testId(1), accountId: testId(1), type: "income", amount: "100.00" },
      { id: testId(2), accountId: testId(1), type: "expense", amount: "40.00" },
      { id: testId(3), accountId: testId(2), type: "income", amount: "25.00" },
      { id: testId(4), accountId: null, type: "income", amount: "999.00" },
    ]);
    const { getAccountBalances } = await import("@/server/db");

    await expect(getAccountBalances(testId(42))).resolves.toEqual({
      [testId(1)]: 60,
      [testId(2)]: 25,
    });

    expect(dbQuery).toHaveBeenCalledWith("Database/query", {
      body: {
        query:
          "SELECT id, accountId, type, amount FROM transactions WHERE userId = ? AND deletedAt IS NULL",
        params: [testId(42)],
      },
    });
  });

  it("propagates a query failure instead of reporting empty balances", async () => {
    // SP-014: this used to resolve to {}, so a database outage was
    // indistinguishable from an account with no activity — the UI showed a
    // friendly empty state over a real failure.
    dbQuery.mockRejectedValueOnce(new Error("database unavailable"));
    const { getAccountBalances } = await import("@/server/db");

    await expect(getAccountBalances(testId(1))).rejects.toThrow(
      "database unavailable",
    );
  });
});

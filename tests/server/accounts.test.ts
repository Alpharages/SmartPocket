import { beforeEach, describe, expect, it, vi } from "vitest";

const callDataApi = vi.fn();

vi.mock("@/server/_core/dataApi", () => ({
  callDataApi: (...args: unknown[]) => callDataApi(...args),
}));

describe("account db helpers", () => {
  beforeEach(() => {
    callDataApi.mockReset();
    vi.resetModules();
  });

  it("counts transactions scoped by userId and accountId", async () => {
    callDataApi.mockResolvedValueOnce([{ txCount: 4 }]);
    const { getAccountTransactionCount } = await import("@/server/db");

    await expect(getAccountTransactionCount(7, 42)).resolves.toBe(4);

    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: {
        query:
          "SELECT COUNT(*) as txCount FROM transactions WHERE userId = ? AND accountId = ?",
        params: [42, 7],
      },
    });
  });

  it("propagates transaction count query failures", async () => {
    callDataApi.mockRejectedValueOnce(new Error("database unavailable"));
    const { getAccountTransactionCount } = await import("@/server/db");

    await expect(getAccountTransactionCount(1, 1)).rejects.toThrow(
      "database unavailable",
    );
  });

  it("reassigns transactions with user-scoped predicates", async () => {
    callDataApi.mockResolvedValueOnce(undefined);
    const { reassignAccountTransactions } = await import("@/server/db");

    await reassignAccountTransactions(3, 9, 42);

    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: {
        query:
          "UPDATE transactions SET accountId = ? WHERE userId = ? AND accountId = ?",
        params: [9, 42, 3],
      },
    });
  });

  it("rejects reassign-and-delete when source and target are the same account", async () => {
    const { reassignAndDeleteAccount } = await import("@/server/db");

    await expect(reassignAndDeleteAccount(5, 5, 1)).rejects.toThrow(
      "Cannot reassign to the same account",
    );
    expect(callDataApi).not.toHaveBeenCalled();
  });

  it("derives per-account balances from user transactions", async () => {
    callDataApi.mockResolvedValueOnce([
      { id: 1, accountId: 1, type: "income", amount: "100.00" },
      { id: 2, accountId: 1, type: "expense", amount: "40.00" },
      { id: 3, accountId: 2, type: "income", amount: "25.00" },
      { id: 4, accountId: null, type: "income", amount: "999.00" },
    ]);
    const { getAccountBalances } = await import("@/server/db");

    await expect(getAccountBalances(42)).resolves.toEqual({
      1: 60,
      2: 25,
    });

    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: {
        query:
          "SELECT id, accountId, type, amount FROM transactions WHERE userId = ?",
        params: [42],
      },
    });
  });

  it("returns empty balances when the query fails", async () => {
    callDataApi.mockRejectedValueOnce(new Error("database unavailable"));
    const { getAccountBalances } = await import("@/server/db");

    await expect(getAccountBalances(1)).resolves.toEqual({});
  });
});

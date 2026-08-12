import { beforeEach, describe, expect, it, vi } from "vitest";

const callDataApi = vi.fn();

vi.mock("@/server/_core/dataApi", () => ({
  callDataApi: (...args: unknown[]) => callDataApi(...args),
}));

describe("deleteAllUserData", () => {
  beforeEach(() => {
    callDataApi.mockReset();
    callDataApi.mockResolvedValue(undefined);
    vi.resetModules();
  });

  it("deletes recurring transactions, transactions, accounts, credit cards, and categories in FK-safe order scoped by userId", async () => {
    const { deleteAllUserData } = await import("@/server/db");

    await deleteAllUserData(42);

    expect(callDataApi).toHaveBeenCalledTimes(7);

    const queries = callDataApi.mock.calls.map(
      (call) =>
        (call[1] as { body: { query: string; params: unknown[] } }).body,
    );

    expect(queries[0].query).toMatch(
      /DELETE FROM recurringTransactions WHERE userId = \?/,
    );
    expect(queries[0].params).toEqual([42]);

    expect(queries[1].query).toMatch(
      /DELETE FROM transactions WHERE userId = \?/,
    );
    expect(queries[1].params).toEqual([42]);

    expect(queries[2].query).toMatch(/DELETE FROM transfers WHERE userId = \?/);
    expect(queries[2].params).toEqual([42]);

    expect(queries[3].query).toMatch(/DELETE FROM accounts WHERE userId = \?/);
    expect(queries[3].params).toEqual([42]);

    expect(queries[4].query).toMatch(
      /DELETE FROM creditCards WHERE userId = \?/,
    );
    expect(queries[4].params).toEqual([42]);

    expect(queries[5].query).toMatch(
      /DELETE FROM categories WHERE userId = \?/,
    );
    expect(queries[5].params).toEqual([42]);

    // N7: clearing all data must also drop the account-linked PIN state —
    // otherwise a wiped account keeps a stale hash and lockout.
    expect(queries[6].query).toMatch(
      /UPDATE users SET pinHash = \?, pinFailedAttempts = \?, pinLockedUntil = \? WHERE id = \?/,
    );
    expect(queries[6].params).toEqual([null, 0, null, 42]);
  });

  it("propagates errors from the data API", async () => {
    callDataApi.mockRejectedValueOnce(new Error("db unavailable"));
    const { deleteAllUserData } = await import("@/server/db");

    await expect(deleteAllUserData(1)).rejects.toThrow("db unavailable");
  });
});

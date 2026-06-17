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

  it("deletes recurring transactions, transactions, credit cards, and categories in FK-safe order scoped by userId", async () => {
    const { deleteAllUserData } = await import("@/server/db");

    await deleteAllUserData(42);

    expect(callDataApi).toHaveBeenCalledTimes(4);

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

    expect(queries[2].query).toMatch(
      /DELETE FROM creditCards WHERE userId = \?/,
    );
    expect(queries[2].params).toEqual([42]);

    expect(queries[3].query).toMatch(
      /DELETE FROM categories WHERE userId = \?/,
    );
    expect(queries[3].params).toEqual([42]);
  });

  it("propagates errors from the data API", async () => {
    callDataApi.mockRejectedValueOnce(new Error("db unavailable"));
    const { deleteAllUserData } = await import("@/server/db");

    await expect(deleteAllUserData(1)).rejects.toThrow("db unavailable");
  });
});

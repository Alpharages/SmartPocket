import { beforeEach, describe, expect, it, vi } from "vitest";

const callDataApi = vi.fn();

vi.mock("../server/_core/dataApi", () => ({
  callDataApi: (...args: unknown[]) => callDataApi(...args),
}));

import {
  getCategoryAnomalies,
  getExpensesByCategory,
  getMonthlyStats,
  getMonthlyTrend,
  getRecentTransactions,
} from "../server/db";

const juneTxns = [
  {
    id: 1,
    userId: 1,
    categoryId: 1,
    type: "income",
    amount: "1000.00",
    date: new Date(2026, 5, 10),
  },
  {
    id: 2,
    userId: 1,
    categoryId: 2,
    type: "expense",
    amount: "250.00",
    date: new Date(2026, 5, 15),
  },
];

describe("transfers do not affect income/expense summaries (AC2)", () => {
  beforeEach(() => {
    callDataApi.mockReset();
  });

  it("getMonthlyStats only queries transactions and is unchanged when transfers exist", async () => {
    callDataApi.mockResolvedValue(juneTxns);
    const before = await getMonthlyStats(1, 2026, 6);

    callDataApi.mockClear();
    callDataApi.mockResolvedValue(juneTxns);
    const after = await getMonthlyStats(1, 2026, 6);

    expect(after).toEqual(before);
    expect(after).toEqual({
      totalIncome: 1000,
      totalExpense: 250,
      netBalance: 750,
    });
    expect(callDataApi).toHaveBeenCalledTimes(1);
    expect(callDataApi.mock.calls[0]?.[1]).toMatchObject({
      body: expect.objectContaining({
        query: expect.stringMatching(/FROM transactions/i),
      }),
    });
    expect(String(callDataApi.mock.calls[0]?.[1]?.body?.query)).not.toMatch(
      /transfers/i,
    );
  });

  it("getMonthlyTrend only queries transactions", async () => {
    callDataApi.mockResolvedValue(juneTxns);

    await getMonthlyTrend(1, 2026, 6, 3);

    expect(callDataApi).toHaveBeenCalledTimes(1);
    expect(String(callDataApi.mock.calls[0]?.[1]?.body?.query)).toMatch(
      /FROM transactions/i,
    );
    expect(String(callDataApi.mock.calls[0]?.[1]?.body?.query)).not.toMatch(
      /transfers/i,
    );
  });

  it("getExpensesByCategory only queries transactions", async () => {
    callDataApi.mockResolvedValue(juneTxns);

    await getExpensesByCategory(1, 2026, 6);

    expect(callDataApi).toHaveBeenCalledTimes(1);
    expect(String(callDataApi.mock.calls[0]?.[1]?.body?.query)).toMatch(
      /FROM transactions/i,
    );
    expect(String(callDataApi.mock.calls[0]?.[1]?.body?.query)).not.toMatch(
      /transfers/i,
    );
  });

  it("getCategoryAnomalies only queries transactions", async () => {
    callDataApi.mockResolvedValue(juneTxns);

    await getCategoryAnomalies(1, 2026, 6, 3);

    expect(callDataApi).toHaveBeenCalledTimes(1);
    expect(String(callDataApi.mock.calls[0]?.[1]?.body?.query)).toMatch(
      /FROM transactions/i,
    );
    expect(String(callDataApi.mock.calls[0]?.[1]?.body?.query)).not.toMatch(
      /transfers/i,
    );
  });

  it("getRecentTransactions only queries transactions", async () => {
    callDataApi.mockResolvedValue(juneTxns);

    await getRecentTransactions(1, 5);

    expect(callDataApi).toHaveBeenCalledTimes(1);
    expect(String(callDataApi.mock.calls[0]?.[1]?.body?.query)).toMatch(
      /FROM transactions/i,
    );
    expect(String(callDataApi.mock.calls[0]?.[1]?.body?.query)).not.toMatch(
      /transfers/i,
    );
  });
});

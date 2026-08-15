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
import { testId, syncColumns } from "./helpers/ids";

const juneTxns = [
  {
    id: testId(1),
    userId: testId(1),
    categoryId: testId(1),
    type: "income",
    amount: "1000.00",
    date: new Date(2026, 5, 10),
  },
  {
    id: testId(2),
    userId: testId(1),
    categoryId: testId(2),
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
    const before = await getMonthlyStats(testId(1), 2026, 6);

    callDataApi.mockClear();
    callDataApi.mockResolvedValue(juneTxns);
    const after = await getMonthlyStats(testId(1), 2026, 6);

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

    await getMonthlyTrend(testId(1), 2026, 6, 3);

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

    await getExpensesByCategory(testId(1), 2026, 6);

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

    await getCategoryAnomalies(testId(1), 2026, 6, 3);

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

    await getRecentTransactions(testId(1), 5);

    expect(callDataApi).toHaveBeenCalledTimes(1);
    expect(String(callDataApi.mock.calls[0]?.[1]?.body?.query)).toMatch(
      /FROM transactions/i,
    );
    expect(String(callDataApi.mock.calls[0]?.[1]?.body?.query)).not.toMatch(
      /transfers/i,
    );
  });
});

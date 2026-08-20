import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The old envelope shape, rebuilt from the (sql, params) argument pair so these
 * assertions keep reading as "what statement, with what values".
 */
function bodyOf(call: unknown[]) {
  return { query: String(call[0]), params: (call[1] ?? []) as unknown[] };
}

const dbQuery = vi.fn();

vi.mock("../server/_core/db-query", () => ({
  dbQuery: (...args: unknown[]) => dbQuery(...args),
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
    dbQuery.mockReset();
  });

  it("getMonthlyStats only queries transactions and is unchanged when transfers exist", async () => {
    dbQuery.mockResolvedValue(juneTxns);
    const before = await getMonthlyStats(testId(1), 2026, 6);

    dbQuery.mockClear();
    dbQuery.mockResolvedValue(juneTxns);
    const after = await getMonthlyStats(testId(1), 2026, 6);

    expect(after).toEqual(before);
    expect(after).toEqual({
      totalIncome: 1000,
      totalExpense: 250,
      netBalance: 750,
    });
    expect(dbQuery).toHaveBeenCalledTimes(1);
    expect(bodyOf(dbQuery.mock.calls[0])).toMatchObject(
      expect.objectContaining({
        query: expect.stringMatching(/FROM transactions/i),
      }),
    );
    expect(String(dbQuery.mock.calls[0]?.[0])).not.toMatch(/transfers/i);
  });

  it("getMonthlyTrend only queries transactions", async () => {
    dbQuery.mockResolvedValue(juneTxns);

    await getMonthlyTrend(testId(1), 2026, 6, 3);

    expect(dbQuery).toHaveBeenCalledTimes(1);
    expect(String(dbQuery.mock.calls[0]?.[0])).toMatch(/FROM transactions/i);
    expect(String(dbQuery.mock.calls[0]?.[0])).not.toMatch(/transfers/i);
  });

  it("getExpensesByCategory only queries transactions", async () => {
    dbQuery.mockResolvedValue(juneTxns);

    await getExpensesByCategory(testId(1), 2026, 6);

    expect(dbQuery).toHaveBeenCalledTimes(1);
    expect(String(dbQuery.mock.calls[0]?.[0])).toMatch(/FROM transactions/i);
    expect(String(dbQuery.mock.calls[0]?.[0])).not.toMatch(/transfers/i);
  });

  it("getCategoryAnomalies only queries transactions", async () => {
    dbQuery.mockResolvedValue(juneTxns);

    await getCategoryAnomalies(testId(1), 2026, 6, 3);

    expect(dbQuery).toHaveBeenCalledTimes(1);
    expect(String(dbQuery.mock.calls[0]?.[0])).toMatch(/FROM transactions/i);
    expect(String(dbQuery.mock.calls[0]?.[0])).not.toMatch(/transfers/i);
  });

  it("getRecentTransactions only queries transactions", async () => {
    dbQuery.mockResolvedValue(juneTxns);

    await getRecentTransactions(testId(1), 5);

    expect(dbQuery).toHaveBeenCalledTimes(1);
    expect(String(dbQuery.mock.calls[0]?.[0])).toMatch(/FROM transactions/i);
    expect(String(dbQuery.mock.calls[0]?.[0])).not.toMatch(/transfers/i);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const dbQuery = vi.fn();

vi.mock("../server/_core/db-query", () => ({
  dbQuery: (...args: unknown[]) => dbQuery(...args),
}));

import { getMonthlyTrend } from "../server/db";
import { testId } from "./helpers/ids";

describe("getMonthlyTrend", () => {
  beforeEach(() => {
    dbQuery.mockReset();
  });

  it("returns zero-filled months oldest to newest for the anchor window", async () => {
    dbQuery.mockResolvedValue([]);

    const trend = await getMonthlyTrend(testId(1), 2026, 6, 6);

    expect(trend).toHaveLength(6);
    expect(trend[0]).toEqual({
      year: 2026,
      month: 1,
      totalIncome: 0,
      totalExpense: 0,
      netBalance: 0,
    });
    expect(trend[5]).toEqual({
      year: 2026,
      month: 6,
      totalIncome: 0,
      totalExpense: 0,
      netBalance: 0,
    });
  });

  it("sums income, expense, and net per month", async () => {
    dbQuery.mockResolvedValue([
      {
        type: "income",
        amount: "1000",
        date: new Date(2026, 0, 15),
      },
      {
        type: "expense",
        amount: "400",
        date: new Date(2026, 0, 20),
      },
      {
        type: "income",
        amount: "500",
        date: new Date(2026, 1, 5),
      },
      {
        type: "expense",
        amount: "200",
        date: new Date(2026, 1, 10),
      },
    ]);

    const trend = await getMonthlyTrend(testId(1), 2026, 2, 2);

    expect(trend).toEqual([
      {
        year: 2026,
        month: 1,
        totalIncome: 1000,
        totalExpense: 400,
        netBalance: 600,
      },
      {
        year: 2026,
        month: 2,
        totalIncome: 500,
        totalExpense: 200,
        netBalance: 300,
      },
    ]);
  });

  it("crosses year boundaries when the window reaches into the prior year", async () => {
    dbQuery.mockResolvedValue([
      {
        type: "expense",
        amount: "150",
        date: new Date(2025, 10, 10),
      },
    ]);

    const trend = await getMonthlyTrend(testId(1), 2026, 2, 6);

    expect(trend.map((m) => `${m.year}-${m.month}`)).toEqual([
      "2025-9",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-1",
      "2026-2",
    ]);
    expect(trend[2]).toMatchObject({
      year: 2025,
      month: 11,
      totalExpense: 150,
      netBalance: -150,
    });
  });

  it("propagates a query failure instead of reporting no history", async () => {
    // SP-014: silently returning [] rendered "No spending history".
    dbQuery.mockRejectedValue(new Error("db down"));

    await expect(getMonthlyTrend(testId(1), 2026, 6, 6)).rejects.toThrow(
      "db down",
    );
  });

  it("scopes the query to the user and date window", async () => {
    dbQuery.mockResolvedValue([]);

    await getMonthlyTrend(testId(42), 2026, 6, 6);

    expect(dbQuery).toHaveBeenCalledWith(
      "SELECT * FROM transactions WHERE userId = ? AND date >= ? AND date <= ? AND deletedAt IS NULL",
      [testId(42), new Date(2026, 0, 1), new Date(2026, 6, 0, 23, 59, 59)],
    );
  });
});

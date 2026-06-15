import { beforeEach, describe, expect, it, vi } from "vitest";

const callDataApi = vi.fn();

vi.mock("../server/_core/dataApi", () => ({
  callDataApi: (...args: unknown[]) => callDataApi(...args),
}));

import { getMonthlyTrend } from "../server/db";

describe("getMonthlyTrend", () => {
  beforeEach(() => {
    callDataApi.mockReset();
  });

  it("returns zero-filled months oldest to newest for the anchor window", async () => {
    callDataApi.mockResolvedValue([]);

    const trend = await getMonthlyTrend(1, 2026, 6, 6);

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
    callDataApi.mockResolvedValue([
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

    const trend = await getMonthlyTrend(1, 2026, 2, 2);

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
    callDataApi.mockResolvedValue([
      {
        type: "expense",
        amount: "150",
        date: new Date(2025, 10, 10),
      },
    ]);

    const trend = await getMonthlyTrend(1, 2026, 2, 6);

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

  it("returns an empty array when the query fails", async () => {
    callDataApi.mockRejectedValue(new Error("db down"));

    await expect(getMonthlyTrend(1, 2026, 6, 6)).resolves.toEqual([]);
  });

  it("scopes the query to the user and date window", async () => {
    callDataApi.mockResolvedValue([]);

    await getMonthlyTrend(42, 2026, 6, 6);

    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: {
        query:
          "SELECT * FROM transactions WHERE userId = ? AND date >= ? AND date <= ?",
        params: [42, new Date(2026, 0, 1), new Date(2026, 6, 0, 23, 59, 59)],
      },
    });
  });
});

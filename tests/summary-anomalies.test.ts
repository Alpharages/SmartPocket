import type { Id } from "@/drizzle/schema";
import { beforeEach, describe, expect, it, vi } from "vitest";

const callDataApi = vi.fn();

vi.mock("../server/_core/dataApi", () => ({
  callDataApi: (...args: unknown[]) => callDataApi(...args),
}));

import { getCategoryAnomalies } from "../server/db";
import { testId } from "./helpers/ids";

const DINING = testId(1);
const GROCERIES = testId(2);
const NEW_CAT = testId(3);

function expense(
  categoryId: Id,
  amount: string,
  date: Date,
): Record<string, unknown> {
  return { type: "expense", categoryId, amount, date };
}

describe("getCategoryAnomalies", () => {
  beforeEach(() => {
    callDataApi.mockReset();
  });

  it("flags a category when current spend exceeds mean * threshold (AC1)", async () => {
    callDataApi.mockResolvedValue([
      expense(DINING, "100", new Date(2026, 0, 10)),
      expense(DINING, "100", new Date(2026, 1, 10)),
      expense(DINING, "100", new Date(2026, 2, 10)),
      expense(DINING, "300", new Date(2026, 3, 10)),
    ]);

    const result = await getCategoryAnomalies(testId(1), 2026, 4, 3);

    const dining = result.find((r) => r.categoryId === DINING);
    expect(dining).toMatchObject({
      current: 300,
      mean: 100,
      isAnomaly: true,
    });
    expect(dining?.deltaPct).toBeCloseTo(200, 0);
  });

  it("does not flag brand-new categories with no prior history (AC3)", async () => {
    callDataApi.mockResolvedValue([
      expense(NEW_CAT, "250", new Date(2026, 3, 10)),
    ]);

    const result = await getCategoryAnomalies(testId(1), 2026, 4, 3);

    const row = result.find((r) => r.categoryId === NEW_CAT);
    expect(row?.isAnomaly).toBe(false);
  });

  it("does not flag when only one prior month of history exists", async () => {
    callDataApi.mockResolvedValue([
      expense(DINING, "50", new Date(2026, 2, 10)),
      expense(DINING, "500", new Date(2026, 3, 10)),
    ]);

    const result = await getCategoryAnomalies(testId(1), 2026, 4, 3);

    expect(result.find((r) => r.categoryId === DINING)?.isAnomaly).toBe(false);
  });

  it("does not flag at exactly the threshold boundary", async () => {
    callDataApi.mockResolvedValue([
      expense(DINING, "100", new Date(2026, 0, 10)),
      expense(DINING, "100", new Date(2026, 1, 10)),
      expense(DINING, "150", new Date(2026, 3, 10)),
    ]);

    const result = await getCategoryAnomalies(testId(1), 2026, 4, 3, 1.5);

    expect(result.find((r) => r.categoryId === DINING)?.isAnomaly).toBe(false);
  });

  it("does not flag categories that dropped below their recent mean", async () => {
    callDataApi.mockResolvedValue([
      expense(GROCERIES, "200", new Date(2026, 0, 10)),
      expense(GROCERIES, "200", new Date(2026, 1, 10)),
      expense(GROCERIES, "50", new Date(2026, 3, 10)),
    ]);

    const result = await getCategoryAnomalies(testId(1), 2026, 4, 3);

    expect(result.find((r) => r.categoryId === GROCERIES)?.isAnomaly).toBe(
      false,
    );
  });

  it("crosses year boundaries in the lookback window", async () => {
    callDataApi.mockResolvedValue([
      expense(DINING, "100", new Date(2025, 10, 10)),
      expense(DINING, "100", new Date(2025, 11, 10)),
      expense(DINING, "100", new Date(2026, 0, 10)),
      expense(DINING, "300", new Date(2026, 1, 10)),
    ]);

    const result = await getCategoryAnomalies(testId(1), 2026, 2, 3);

    expect(result.find((r) => r.categoryId === DINING)?.isAnomaly).toBe(true);
  });

  it("propagates a query failure instead of reporting no anomalies", async () => {
    // SP-014: silently returning [] made an outage look like clean spending.
    callDataApi.mockRejectedValue(new Error("db down"));

    await expect(getCategoryAnomalies(testId(1), 2026, 4)).rejects.toThrow(
      "db down",
    );
  });

  it("scopes the query to the user and date window", async () => {
    callDataApi.mockResolvedValue([]);

    await getCategoryAnomalies(testId(42), 2026, 6, 3);

    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: {
        query:
          "SELECT * FROM transactions WHERE userId = ? AND type = 'expense' AND date >= ? AND date <= ? AND deletedAt IS NULL",
        params: [
          testId(42),
          new Date(2026, 2, 1),
          new Date(2026, 6, 0, 23, 59, 59),
        ],
      },
    });
  });
});

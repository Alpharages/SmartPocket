import { beforeEach, describe, expect, it, vi } from "vitest";
import { testId, syncColumns } from "./helpers/ids";

const dbMock = vi.hoisted(() => ({
  getDueRecurringTransactions: vi.fn(),
  createTransaction: vi.fn(),
  advanceRecurringTransaction: vi.fn(),
}));

vi.mock("@/server/db", () => dbMock);

const baseRule = {
  id: testId(10),
  userId: testId(1),
  categoryId: testId(2),
  creditCardId: null,
  type: "expense" as const,
  amount: "50.00",
  description: "Rent",
  frequency: "daily" as const,
  interval: 1,
  occurrenceCount: null,
  endDate: null,
  lastRunDate: null,
  generatedCount: 0,
  isActive: true,
};

describe("recurrenceGenerator", () => {
  beforeEach(() => {
    dbMock.getDueRecurringTransactions.mockReset();
    dbMock.createTransaction.mockReset();
    dbMock.advanceRecurringTransaction.mockReset();
    dbMock.createTransaction.mockResolvedValue(1);
    dbMock.advanceRecurringTransaction.mockResolvedValue(undefined);
  });

  it("computes end-of-month monthly recurrence safely", async () => {
    const { computeNextRunDate } =
      await import("@/server/_core/recurrenceGenerator");
    const jan31 = new Date(Date.UTC(2026, 0, 31, 10, 0, 0));
    const feb = computeNextRunDate(jan31, "monthly", 1);
    expect(feb.toISOString()).toBe("2026-02-28T10:00:00.000Z");
  });

  it("creates one transaction for one due occurrence", async () => {
    const { generateDueTransactions } =
      await import("@/server/_core/recurrenceGenerator");
    dbMock.getDueRecurringTransactions.mockResolvedValue([
      {
        ...baseRule,
        endCondition: "never",
        nextRunDate: new Date("2026-06-16T00:00:00.000Z"),
      },
    ]);

    const result = await generateDueTransactions(
      new Date("2026-06-16T23:59:59.000Z"),
    );
    expect(result).toEqual({ processedRules: 1, createdCount: 1 });
    expect(dbMock.createTransaction).toHaveBeenCalledTimes(1);
    expect(dbMock.advanceRecurringTransaction).toHaveBeenCalledTimes(1);
  });

  it("does not double-create on a second run with the same now", async () => {
    const { generateDueTransactions } =
      await import("@/server/_core/recurrenceGenerator");
    const now = new Date("2026-06-16T23:59:59.000Z");
    let nextRunDate = new Date("2026-06-16T00:00:00.000Z");

    dbMock.getDueRecurringTransactions.mockImplementation(async () =>
      nextRunDate <= now
        ? [
            {
              ...baseRule,
              endCondition: "never",
              nextRunDate,
            },
          ]
        : [],
    );
    dbMock.advanceRecurringTransaction.mockImplementation(
      async (_id, updates) => {
        nextRunDate = updates.nextRunDate as Date;
      },
    );

    const first = await generateDueTransactions(now);
    const second = await generateDueTransactions(now);

    expect(first).toEqual({ processedRules: 1, createdCount: 1 });
    expect(second).toEqual({ processedRules: 0, createdCount: 0 });
    expect(dbMock.createTransaction).toHaveBeenCalledTimes(1);
  });

  it("backfills missed periods and deactivates count-based recurrences", async () => {
    const { generateDueTransactions } =
      await import("@/server/_core/recurrenceGenerator");
    dbMock.getDueRecurringTransactions.mockResolvedValue([
      {
        ...baseRule,
        id: testId(12),
        amount: "10.00",
        description: "Coffee",
        endCondition: "count",
        occurrenceCount: 3,
        nextRunDate: new Date("2026-06-14T00:00:00.000Z"),
      },
    ]);

    const result = await generateDueTransactions(
      new Date("2026-06-16T23:59:59.000Z"),
    );

    expect(result).toEqual({ processedRules: 1, createdCount: 3 });
    expect(dbMock.createTransaction).toHaveBeenCalledTimes(3);
    expect(dbMock.advanceRecurringTransaction).toHaveBeenCalledWith(
      testId(12),
      expect.objectContaining({
        generatedCount: 3,
        isActive: false,
      }),
    );
  });

  it("stops generating when endDate is exceeded", async () => {
    const { generateDueTransactions } =
      await import("@/server/_core/recurrenceGenerator");
    const endDate = new Date("2026-06-16T00:00:00.000Z");

    dbMock.getDueRecurringTransactions.mockResolvedValue([
      {
        ...baseRule,
        id: testId(20),
        endCondition: "endDate",
        endDate,
        nextRunDate: new Date("2026-06-15T00:00:00.000Z"),
      },
    ]);

    const result = await generateDueTransactions(
      new Date("2026-06-20T00:00:00.000Z"),
    );

    expect(result.createdCount).toBe(2);
    expect(dbMock.createTransaction).toHaveBeenCalledTimes(2);
    expect(dbMock.advanceRecurringTransaction).toHaveBeenCalledWith(
      testId(20),
      expect.objectContaining({ isActive: false }),
    );
  });

  it("returns zero counts when no rules are due", async () => {
    const { generateDueTransactions } =
      await import("@/server/_core/recurrenceGenerator");
    dbMock.getDueRecurringTransactions.mockResolvedValue([]);

    await expect(
      generateDueTransactions(new Date("2026-06-16T00:00:00.000Z")),
    ).resolves.toEqual({ processedRules: 0, createdCount: 0 });
    expect(dbMock.createTransaction).not.toHaveBeenCalled();
  });
});

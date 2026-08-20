import { beforeEach, describe, expect, it, vi } from "vitest";
import { testId, syncColumns } from "./helpers/ids";

const dbQuery = vi.fn();

vi.mock("@/server/_core/db-query", () => ({
  dbQuery: (...args: unknown[]) => dbQuery(...args),
}));

describe("ensureDefaultAccount", () => {
  beforeEach(() => {
    dbQuery.mockReset();
  });

  it("creates a default cash account and backfills null accountId transactions", async () => {
    dbQuery
      .mockResolvedValueOnce([{ accountCount: 0 }])
      .mockResolvedValueOnce({ insertId: 5 })
      .mockResolvedValueOnce([
        { id: testId(5), userId: testId(1), name: "Cash", isDefault: true },
      ])
      .mockResolvedValueOnce({ affectedRows: 3 });

    const { ensureDefaultAccount } = await import("@/server/db");
    await ensureDefaultAccount(testId(1));

    expect(dbQuery).toHaveBeenNthCalledWith(1, "Database/query", {
      body: {
        query:
          "SELECT COUNT(*) as accountCount FROM accounts WHERE userId = ? AND deletedAt IS NULL",
        params: [testId(1)],
      },
    });

    expect(dbQuery).toHaveBeenNthCalledWith(2, "Database/query", {
      body: expect.objectContaining({
        query: expect.stringMatching(/INSERT INTO accounts/),
        params: expect.arrayContaining([
          testId(1),
          "Cash",
          "cash",
          "USD",
          true,
        ]),
      }),
    });

    expect(dbQuery).toHaveBeenNthCalledWith(4, "Database/query", {
      body: {
        query: expect.stringContaining(
          "UPDATE transactions SET accountId = ?, updatedAt = ?, dirty = 1 WHERE userId = ? AND accountId IS NULL",
        ),
        params: [testId(5), expect.any(Date), testId(1)],
      },
    });
  });

  it("is a no-op when the user already has accounts", async () => {
    dbQuery.mockResolvedValueOnce([{ accountCount: 2 }]);

    const { ensureDefaultAccount } = await import("@/server/db");
    await ensureDefaultAccount(testId(1));

    expect(dbQuery).toHaveBeenCalledTimes(1);
  });

  it("is idempotent on second run after backfill", async () => {
    dbQuery.mockResolvedValueOnce([{ accountCount: 1 }]);

    const { ensureDefaultAccount } = await import("@/server/db");
    await ensureDefaultAccount(testId(1));

    expect(dbQuery).toHaveBeenCalledTimes(1);
  });
});

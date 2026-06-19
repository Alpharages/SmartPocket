import { beforeEach, describe, expect, it, vi } from "vitest";

const callDataApi = vi.fn();

vi.mock("@/server/_core/dataApi", () => ({
  callDataApi: (...args: unknown[]) => callDataApi(...args),
}));

describe("ensureDefaultAccount", () => {
  beforeEach(() => {
    callDataApi.mockReset();
  });

  it("creates a default cash account and backfills null accountId transactions", async () => {
    callDataApi
      .mockResolvedValueOnce([{ accountCount: 0 }])
      .mockResolvedValueOnce({ insertId: 5 })
      .mockResolvedValueOnce([{ id: 5, userId: 1, name: "Cash", isDefault: true }])
      .mockResolvedValueOnce({ affectedRows: 3 });

    const { ensureDefaultAccount } = await import("@/server/db");
    await ensureDefaultAccount(1);

    expect(callDataApi).toHaveBeenNthCalledWith(1, "Database/query", {
      body: {
        query: "SELECT COUNT(*) as accountCount FROM accounts WHERE userId = ?",
        params: [1],
      },
    });

    expect(callDataApi).toHaveBeenNthCalledWith(2, "Database/query", {
      body: expect.objectContaining({
        query: expect.stringMatching(/INSERT INTO accounts/),
        params: expect.arrayContaining([1, "Cash", "cash", "USD", true]),
      }),
    });

    expect(callDataApi).toHaveBeenNthCalledWith(4, "Database/query", {
      body: {
        query:
          "UPDATE transactions SET accountId = ? WHERE userId = ? AND accountId IS NULL",
        params: [5, 1],
      },
    });
  });

  it("is a no-op when the user already has accounts", async () => {
    callDataApi.mockResolvedValueOnce([{ accountCount: 2 }]);

    const { ensureDefaultAccount } = await import("@/server/db");
    await ensureDefaultAccount(1);

    expect(callDataApi).toHaveBeenCalledTimes(1);
  });

  it("is idempotent on second run after backfill", async () => {
    callDataApi.mockResolvedValueOnce([{ accountCount: 1 }]);

    const { ensureDefaultAccount } = await import("@/server/db");
    await ensureDefaultAccount(1);

    expect(callDataApi).toHaveBeenCalledTimes(1);
  });
});

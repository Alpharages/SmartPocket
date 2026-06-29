import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";
import {
  createBudget,
  deleteBudget,
  findActiveBudget,
  getBudgetById,
  getBudgetProgress,
  getUserBudgets,
  updateBudget,
} from "../server/db";

const callDataApi = vi.fn();

vi.mock("../server/_core/dataApi", () => ({
  callDataApi: (...args: unknown[]) => callDataApi(...args),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createUserContext(userId: number): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `user-${userId}`,
    email: `user${userId}@example.com`,
    name: `User ${userId}`,
    loginMethod: "manus",
    role: "user",
    aiEnabled: false,
    remindersEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const sampleBudget = {
  id: 1,
  userId: 1,
  categoryId: 10,
  period: "monthly" as const,
  amount: "100.00",
  startDate: null,
  endDate: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("budgets db layer", () => {
  beforeEach(() => {
    callDataApi.mockReset();
  });

  it("getUserBudgets scopes by userId", async () => {
    callDataApi.mockResolvedValueOnce([sampleBudget]);

    await expect(getUserBudgets(5)).resolves.toEqual([sampleBudget]);

    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: {
        query: "SELECT * FROM budgets WHERE userId = ? ORDER BY createdAt DESC",
        params: [5],
      },
    });
  });

  it("createBudget inserts with parameterized SQL", async () => {
    callDataApi.mockResolvedValueOnce({ insertId: 42 });

    const id = await createBudget({
      userId: 1,
      categoryId: 10,
      period: "monthly",
      amount: "100.00",
    });

    expect(id).toBe(42);
    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: {
        query: expect.stringContaining("INSERT INTO budgets"),
        params: [1, 10, "monthly", "100.00", null, null],
      },
    });
  });

  it("updateBudget scopes by userId", async () => {
    callDataApi.mockResolvedValueOnce(undefined);

    await updateBudget(7, 3, { amount: "200.00" });

    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: {
        query: expect.stringMatching(
          /UPDATE budgets SET amount = \? WHERE id = \? AND userId = \?/,
        ),
        params: ["200.00", 7, 3],
      },
    });
  });

  it("deleteBudget scopes by userId", async () => {
    callDataApi.mockResolvedValueOnce(undefined);

    await deleteBudget(7, 3);

    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: {
        query: "DELETE FROM budgets WHERE id = ? AND userId = ?",
        params: [7, 3],
      },
    });
  });

  it("getBudgetById scopes by userId", async () => {
    callDataApi.mockResolvedValueOnce([sampleBudget]);

    await expect(getBudgetById(1, 1)).resolves.toEqual(sampleBudget);

    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: {
        query: "SELECT * FROM budgets WHERE id = ? AND userId = ?",
        params: [1, 1],
      },
    });
  });

  it("findActiveBudget scopes by userId, category, period, and active window", async () => {
    callDataApi.mockResolvedValueOnce([sampleBudget]);

    await expect(findActiveBudget(1, 10, "monthly")).resolves.toEqual(
      sampleBudget,
    );

    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: {
        query: expect.stringContaining(
          "startDate IS NULL OR startDate <= NOW()",
        ),
        params: [1, 10, "monthly"],
      },
    });
  });

  it("findActiveBudget excludes id when provided", async () => {
    callDataApi.mockResolvedValueOnce([]);

    await expect(
      findActiveBudget(1, 10, "weekly", { excludeId: 5 }),
    ).resolves.toBeNull();

    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: {
        query: expect.stringContaining("AND id <> ?"),
        params: [1, 10, "weekly", 5],
      },
    });
  });
});

describe("getBudgetProgress", () => {
  const monthStart = new Date(2026, 5, 1);
  const monthEnd = new Date(2026, 5, 30, 23, 59, 59, 999);
  const weekStart = new Date(2026, 5, 15);
  const weekEnd = new Date(2026, 5, 21, 23, 59, 59, 999);

  beforeEach(() => {
    callDataApi.mockReset();
  });

  it("sums expense transactions for a monthly budget in the current month", async () => {
    callDataApi
      .mockResolvedValueOnce([sampleBudget])
      .mockResolvedValueOnce([{ amount: "50.00" }, { amount: "30.00" }]);

    await expect(
      getBudgetProgress(1, monthStart, monthEnd, weekStart, weekEnd),
    ).resolves.toEqual([{ budgetId: 1, spent: "80.00", limit: "100.00" }]);

    expect(callDataApi).toHaveBeenLastCalledWith("Database/query", {
      body: {
        query: expect.stringContaining("type = 'expense'"),
        params: [1, 10, monthStart, monthEnd],
      },
    });
  });

  it("uses weekly window for weekly budgets", async () => {
    const weeklyBudget = { ...sampleBudget, id: 2, period: "weekly" as const };
    callDataApi
      .mockResolvedValueOnce([weeklyBudget])
      .mockResolvedValueOnce([{ amount: "25.00" }]);

    await expect(
      getBudgetProgress(1, monthStart, monthEnd, weekStart, weekEnd),
    ).resolves.toEqual([{ budgetId: 2, spent: "25.00", limit: "100.00" }]);

    expect(callDataApi).toHaveBeenLastCalledWith("Database/query", {
      body: expect.objectContaining({
        params: [1, 10, weekStart, weekEnd],
      }),
    });
  });

  it("returns spent 0 when budget active window does not overlap period", async () => {
    const expiredBudget = {
      ...sampleBudget,
      startDate: new Date(2026, 0, 1),
      endDate: new Date(2026, 0, 31),
    };
    callDataApi.mockResolvedValueOnce([expiredBudget]);

    await expect(
      getBudgetProgress(1, monthStart, monthEnd, weekStart, weekEnd),
    ).resolves.toEqual([{ budgetId: 1, spent: "0.00", limit: "100.00" }]);

    expect(callDataApi).toHaveBeenCalledTimes(1);
  });

  it("clamps to budget endDate within the period", async () => {
    const midMonthBudget = {
      ...sampleBudget,
      endDate: new Date(2026, 5, 10, 23, 59, 59, 999),
    };
    callDataApi
      .mockResolvedValueOnce([midMonthBudget])
      .mockResolvedValueOnce([{ amount: "40.00" }]);

    await expect(
      getBudgetProgress(1, monthStart, monthEnd, weekStart, weekEnd),
    ).resolves.toEqual([{ budgetId: 1, spent: "40.00", limit: "100.00" }]);

    expect(callDataApi).toHaveBeenLastCalledWith("Database/query", {
      body: expect.objectContaining({
        params: [1, 10, monthStart, midMonthBudget.endDate],
      }),
    });
  });

  it("returns empty array when user has no budgets", async () => {
    callDataApi.mockResolvedValueOnce([]);

    await expect(
      getBudgetProgress(1, monthStart, monthEnd, weekStart, weekEnd),
    ).resolves.toEqual([]);
  });

  it("preserves decimal precision in spent string", async () => {
    callDataApi
      .mockResolvedValueOnce([sampleBudget])
      .mockResolvedValueOnce([{ amount: "0.10" }, { amount: "0.20" }]);

    await expect(
      getBudgetProgress(1, monthStart, monthEnd, weekStart, weekEnd),
    ).resolves.toEqual([{ budgetId: 1, spent: "0.30", limit: "100.00" }]);
  });
});

describe("budgets router", () => {
  beforeEach(() => {
    callDataApi.mockReset();
  });

  it("create then list returns budget for authenticated user", async () => {
    callDataApi
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ insertId: 1 })
      .mockResolvedValueOnce([sampleBudget]);

    const caller = appRouter.createCaller(createUserContext(1));

    const id = await caller.budgets.create({
      categoryId: 10,
      period: "monthly",
      amount: "100.00",
    });

    expect(id).toBe(1);

    await expect(caller.budgets.list()).resolves.toEqual([sampleBudget]);

    const insertCall = callDataApi.mock.calls[1];
    expect(
      (insertCall[1] as { body: { params: unknown[] } }).body.params[0],
    ).toBe(1);
  });

  it("user B cannot see or mutate user A budget", async () => {
    callDataApi.mockResolvedValueOnce([]).mockResolvedValueOnce(null);

    const callerB = appRouter.createCaller(createUserContext(2));

    await expect(callerB.budgets.list()).resolves.toEqual([]);

    await expect(callerB.budgets.getById({ id: 1 })).resolves.toBeNull();

    callDataApi.mockResolvedValueOnce([]).mockResolvedValueOnce(undefined);
    await callerB.budgets.update({
      id: 1,
      categoryId: 10,
      period: "monthly",
      amount: "50.00",
    });
    expect(callDataApi).toHaveBeenLastCalledWith("Database/query", {
      body: expect.objectContaining({
        params: expect.arrayContaining([1, 2]),
      }),
    });
  });

  it("rejects invalid period", async () => {
    const caller = appRouter.createCaller(createUserContext(1));

    await expect(
      caller.budgets.create({
        categoryId: 10,
        // @ts-expect-error invalid period for validation test
        period: "daily",
        amount: "100.00",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects negative amount", async () => {
    const caller = appRouter.createCaller(createUserContext(1));

    await expect(
      caller.budgets.create({
        categoryId: 10,
        period: "monthly",
        amount: "-5",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects three decimal places", async () => {
    const caller = appRouter.createCaller(createUserContext(1));

    await expect(
      caller.budgets.create({
        categoryId: 10,
        period: "monthly",
        amount: "1.999",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects zero and non-positive amounts", async () => {
    const caller = appRouter.createCaller(createUserContext(1));

    await expect(
      caller.budgets.create({ categoryId: 10, period: "monthly", amount: "0" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.budgets.create({
        categoryId: 10,
        period: "weekly",
        amount: "0.00",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("accepts large valid amounts", async () => {
    callDataApi
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ insertId: 1 });

    const caller = appRouter.createCaller(createUserContext(1));

    await expect(
      caller.budgets.create({
        categoryId: 10,
        period: "monthly",
        amount: "9999999999.99",
      }),
    ).resolves.toBe(1);
  });

  it("rejects duplicate active budget for same category and period", async () => {
    callDataApi.mockResolvedValueOnce([sampleBudget]);

    const caller = appRouter.createCaller(createUserContext(1));

    await expect(
      caller.budgets.create({
        categoryId: 10,
        period: "monthly",
        amount: "50.00",
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("active budget already exists"),
    });
  });

  it("allows create when no active budget exists for category and period", async () => {
    callDataApi
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ insertId: 2 });

    const caller = appRouter.createCaller(createUserContext(1));

    await expect(
      caller.budgets.create({
        categoryId: 10,
        period: "monthly",
        amount: "75.00",
      }),
    ).resolves.toBe(2);

    expect(callDataApi.mock.calls[0]).toEqual([
      "Database/query",
      expect.objectContaining({
        body: expect.objectContaining({
          params: [1, 10, "monthly"],
        }),
      }),
    ]);
  });

  it("update excludes self from duplicate check", async () => {
    callDataApi.mockResolvedValueOnce([]).mockResolvedValueOnce(undefined);

    const caller = appRouter.createCaller(createUserContext(1));

    await caller.budgets.update({
      id: 5,
      categoryId: 10,
      period: "weekly",
      amount: "75.50",
    });

    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: expect.objectContaining({
        query: expect.stringContaining("AND id <> ?"),
        params: [1, 10, "weekly", 5],
      }),
    });
  });

  it("rejects update that collides with another active budget", async () => {
    callDataApi.mockResolvedValueOnce([{ ...sampleBudget, id: 9 }]);

    const caller = appRouter.createCaller(createUserContext(1));

    await expect(
      caller.budgets.update({
        id: 5,
        categoryId: 10,
        period: "monthly",
        amount: "120.00",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("update and delete work for owner", async () => {
    callDataApi.mockResolvedValueOnce([]).mockResolvedValueOnce(undefined);

    const caller = appRouter.createCaller(createUserContext(1));

    await caller.budgets.update({
      id: 5,
      categoryId: 10,
      period: "weekly",
      amount: "75.50",
    });

    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: expect.objectContaining({
        query: expect.stringMatching(/UPDATE budgets SET/),
        params: expect.arrayContaining([5, 1]),
      }),
    });

    await caller.budgets.delete({ id: 5 });

    expect(callDataApi).toHaveBeenLastCalledWith("Database/query", {
      body: {
        query: "DELETE FROM budgets WHERE id = ? AND userId = ?",
        params: [5, 1],
      },
    });
  });

  it("rejects unauthenticated list", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    });

    await expect(caller.budgets.list()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("progress returns spent vs limit for authenticated user", async () => {
    callDataApi
      .mockResolvedValueOnce([sampleBudget])
      .mockResolvedValueOnce([{ amount: "50.00" }]);

    const caller = appRouter.createCaller(createUserContext(1));
    const monthStart = new Date(2026, 5, 1);
    const monthEnd = new Date(2026, 5, 30, 23, 59, 59, 999);
    const weekStart = new Date(2026, 5, 15);
    const weekEnd = new Date(2026, 5, 21, 23, 59, 59, 999);

    await expect(
      caller.budgets.progress({
        monthStart,
        monthEnd,
        weekStart,
        weekEnd,
      }),
    ).resolves.toEqual([{ budgetId: 1, spent: "50.00", limit: "100.00" }]);
  });

  it("rejects unauthenticated progress", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    });

    await expect(
      caller.budgets.progress({
        monthStart: new Date(),
        monthEnd: new Date(),
        weekStart: new Date(),
        weekEnd: new Date(),
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

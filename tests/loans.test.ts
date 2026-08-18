import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";
import {
  computeRemainingBalance,
  createLoan,
  createRepayment,
  deleteLoan,
  deleteRepayment,
  getLoanById,
  getLoanWithBalance,
  getRepaymentsByLoan,
  getUserLoans,
  recordRepayment,
  RepaymentExceedsBalanceError,
  updateLoan,
} from "../server/db";
import type { Loan, Repayment } from "@/drizzle/schema";
import type { Id } from "@/drizzle/schema";
import { testId, syncColumns } from "./helpers/ids";

const callDataApi = vi.fn();

vi.mock("../server/_core/dataApi", () => ({
  callDataApi: (...args: unknown[]) => callDataApi(...args),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createUserContext(userId: Id): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `user-${userId}`,
    email: `user${userId}@example.com`,
    name: `User ${userId}`,
    loginMethod: "manus",
    role: "user",
    aiEnabled: false,
    remindersEnabled: false,
    pinHash: null,
    pinFailedAttempts: 0,
    pinLockedUntil: null,
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

const now = new Date("2026-06-01T00:00:00.000Z");

const sampleLoan: Loan = {
  id: testId(1),
  userId: testId(1),
  direction: "lend",
  counterparty: "Alex",
  principal: "1000.00",
  rate: "5.00",
  periodicity: "monthly",
  installmentCount: 10,
  endDate: null,
  nextDueDate: new Date("2026-07-01T00:00:00.000Z"),
  status: "active",
  note: null,
  createdAt: now,
  updatedAt: now,
  ...syncColumns(),
};

const sampleRepayment: Repayment = {
  id: testId(10),
  loanId: testId(1),
  userId: testId(1),
  amount: "400.00",
  date: new Date("2026-06-10T00:00:00.000Z"),
  note: "First payment",
  createdAt: now,
  updatedAt: now,
  ...syncColumns(),
};

describe("computeRemainingBalance", () => {
  it("returns principal minus sum of repayments", () => {
    expect(
      computeRemainingBalance("1000.00", [
        { amount: "400.00" },
        { amount: "100.00" },
      ]),
    ).toBe("500.00");
  });

  it("returns full principal when there are no repayments", () => {
    expect(computeRemainingBalance("250.50", [])).toBe("250.50");
  });
});

describe("loans db layer", () => {
  beforeEach(() => {
    callDataApi.mockReset();
  });

  it("getUserLoans scopes by userId", async () => {
    callDataApi.mockResolvedValueOnce([sampleLoan]);

    await expect(getUserLoans(testId(5))).resolves.toEqual([sampleLoan]);

    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: {
        query:
          "SELECT * FROM loans WHERE userId = ? AND deletedAt IS NULL ORDER BY createdAt DESC",
        params: [testId(5)],
      },
    });
  });

  it("createLoan inserts with parameterized SQL and returns the created row", async () => {
    callDataApi
      .mockResolvedValueOnce({ insertId: 42 })
      .mockResolvedValueOnce([{ ...sampleLoan, id: testId(42) }]);

    const created = await createLoan({
      userId: testId(1),
      direction: "lend",
      counterparty: "Alex",
      principal: "1000.00",
      rate: "5.00",
      periodicity: "monthly",
      installmentCount: 10,
      endDate: null,
      nextDueDate: sampleLoan.nextDueDate,
      status: "active",
      note: null,
    });

    expect(created?.id).toBe(testId(42));
    expect(callDataApi).toHaveBeenNthCalledWith(1, "Database/query", {
      body: {
        query: expect.stringContaining("INSERT INTO loans"),
        params: expect.arrayContaining([testId(1), "lend", "Alex", "1000.00"]),
      },
    });
  });

  it("getLoanById scopes by userId", async () => {
    callDataApi.mockResolvedValueOnce([sampleLoan]);

    await expect(getLoanById(testId(1), testId(1))).resolves.toEqual(
      sampleLoan,
    );

    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: {
        query:
          "SELECT * FROM loans WHERE id = ? AND userId = ? AND deletedAt IS NULL",
        params: [testId(1), testId(1)],
      },
    });
  });

  it("updateLoan scopes by userId", async () => {
    callDataApi.mockResolvedValueOnce(undefined);

    await updateLoan(testId(7), testId(3), { counterparty: "Sam" });

    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: {
        query: expect.stringMatching(
          /UPDATE loans SET counterparty = \?, updatedAt = \?, dirty = 1 WHERE id = \? AND userId = \? AND deletedAt IS NULL/,
        ),
        params: ["Sam", expect.any(Date), testId(7), testId(3)],
      },
    });
  });

  it("deleteLoan scopes by userId", async () => {
    callDataApi.mockResolvedValueOnce(undefined);

    await deleteLoan(testId(7), testId(3));

    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: {
        query: expect.stringContaining(
          "UPDATE loans SET deletedAt = ?, updatedAt = ?, dirty = 1 WHERE id = ? AND userId = ?",
        ),
        params: [expect.any(Date), expect.any(Date), testId(7), testId(3)],
      },
    });
  });

  it("createRepayment verifies loan ownership before insert", async () => {
    callDataApi.mockResolvedValueOnce([]);

    await expect(
      createRepayment({
        loanId: testId(1),
        userId: testId(2),
        amount: "100.00",
        date: now,
        note: null,
      }),
    ).resolves.toBeNull();

    expect(callDataApi).toHaveBeenCalledTimes(1);
  });

  it("createRepayment inserts when loan belongs to user", async () => {
    callDataApi
      .mockResolvedValueOnce([sampleLoan])
      .mockResolvedValueOnce({ insertId: 11 })
      .mockResolvedValueOnce([sampleRepayment]);

    const created = await createRepayment({
      loanId: testId(1),
      userId: testId(1),
      amount: "400.00",
      date: sampleRepayment.date,
      note: "First payment",
    });

    expect(created).toEqual(sampleRepayment);
    expect(callDataApi).toHaveBeenNthCalledWith(2, "Database/query", {
      body: {
        query: expect.stringContaining("INSERT INTO repayments"),
        params: [
          expect.any(String),
          testId(1),
          testId(1),
          "400.00",
          sampleRepayment.date,
          "First payment",
        ],
      },
    });
  });

  it("recordRepayment rejects over-payment before insert", async () => {
    callDataApi
      .mockResolvedValueOnce([sampleLoan])
      .mockResolvedValueOnce([{ amount: "900.00" }]);

    await expect(
      recordRepayment({
        loanId: testId(1),
        userId: testId(1),
        amount: "200.00",
        date: now,
        note: null,
      }),
    ).rejects.toBeInstanceOf(RepaymentExceedsBalanceError);

    expect(callDataApi).toHaveBeenCalledTimes(2);
  });

  it("recordRepayment advances nextDueDate and updates loan", async () => {
    callDataApi
      .mockResolvedValueOnce([sampleLoan])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ insertId: 11 })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([
        {
          ...sampleLoan,
          nextDueDate: new Date("2026-08-01T00:00:00.000Z"),
        },
      ])
      .mockResolvedValueOnce([{ amount: "200.00" }]);

    const result = await recordRepayment({
      loanId: testId(1),
      userId: testId(1),
      amount: "200.00",
      date: now,
      note: null,
    });

    expect(result?.remainingBalance).toBe("800.00");
    expect(callDataApi).toHaveBeenNthCalledWith(4, "Database/query", {
      body: {
        query: expect.stringMatching(/UPDATE loans SET nextDueDate = \?/),
        params: expect.arrayContaining([
          new Date("2026-08-01T00:00:00.000Z"),
          testId(1),
          testId(1),
        ]),
      },
    });
  });

  it("recordRepayment settles loan when balance reaches zero", async () => {
    callDataApi
      .mockResolvedValueOnce([sampleLoan])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ insertId: 12 })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([{ ...sampleLoan, status: "settled" }])
      .mockResolvedValueOnce([{ amount: "1000.00" }]);

    const result = await recordRepayment({
      loanId: testId(1),
      userId: testId(1),
      amount: "1000.00",
      date: now,
      note: null,
    });

    expect(result?.remainingBalance).toBe("0.00");
    expect(callDataApi).toHaveBeenNthCalledWith(4, "Database/query", {
      body: {
        query: expect.stringMatching(/UPDATE loans SET/),
        params: expect.arrayContaining(["settled", testId(1), testId(1)]),
      },
    });
  });

  it("getRepaymentsByLoan scopes by loanId and userId", async () => {
    callDataApi.mockResolvedValueOnce([sampleRepayment]);

    await expect(getRepaymentsByLoan(testId(1), testId(1))).resolves.toEqual([
      sampleRepayment,
    ]);

    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: {
        query:
          "SELECT * FROM repayments WHERE loanId = ? AND userId = ? AND deletedAt IS NULL ORDER BY date DESC",
        params: [testId(1), testId(1)],
      },
    });
  });

  it("deleteRepayment scopes by userId", async () => {
    callDataApi.mockResolvedValueOnce(undefined);

    await deleteRepayment(testId(10), testId(1));

    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: {
        query: expect.stringContaining(
          "UPDATE repayments SET deletedAt = ?, updatedAt = ?, dirty = 1 WHERE id = ? AND userId = ?",
        ),
        params: [expect.any(Date), expect.any(Date), testId(10), testId(1)],
      },
    });
  });

  it("getLoanWithBalance computes remaining balance from repayments", async () => {
    const repaymentA = { ...sampleRepayment, amount: "400.00" };
    const repaymentB = {
      ...sampleRepayment,
      id: testId(11),
      amount: "100.00",
    };

    callDataApi
      .mockResolvedValueOnce([sampleLoan])
      .mockResolvedValueOnce([repaymentA, repaymentB]);

    await expect(getLoanWithBalance(testId(1), testId(1))).resolves.toEqual({
      ...sampleLoan,
      remainingBalance: "500.00",
      repayments: [repaymentA, repaymentB],
    });
  });
});

describe("loans router", () => {
  beforeEach(() => {
    callDataApi.mockReset();
  });

  it("create then list returns loan for authenticated user", async () => {
    callDataApi
      .mockResolvedValueOnce({ insertId: 1 })
      .mockResolvedValueOnce([sampleLoan])
      .mockResolvedValueOnce([sampleLoan]);

    const caller = appRouter.createCaller(createUserContext(testId(1)));

    const created = await caller.loans.create({
      direction: "lend",
      counterparty: "Alex",
      principal: "1000.00",
      rate: "5.00",
      periodicity: "monthly",
      installmentCount: 10,
      nextDueDate: sampleLoan.nextDueDate!,
    });

    expect(created?.userId).toBe(testId(1));
    expect(created?.status).toBe("active");

    await expect(caller.loans.list()).resolves.toEqual([sampleLoan]);
  });

  it("user B cannot read or mutate user A loan", async () => {
    callDataApi.mockResolvedValueOnce([]).mockResolvedValueOnce(null);

    const callerB = appRouter.createCaller(createUserContext(testId(2)));

    await expect(callerB.loans.list()).resolves.toEqual([]);
    await expect(callerB.loans.getById({ id: testId(1) })).resolves.toBeNull();

    callDataApi.mockResolvedValueOnce(undefined);
    await callerB.loans.delete({ id: testId(1) });
    expect(callDataApi).toHaveBeenLastCalledWith("Database/query", {
      body: expect.objectContaining({
        params: [expect.any(Date), expect.any(Date), testId(1), testId(2)],
      }),
    });
  });

  it("rejects invalid direction and non-positive principal", async () => {
    const caller = appRouter.createCaller(createUserContext(testId(1)));

    await expect(
      caller.loans.create({
        // @ts-expect-error invalid direction for validation test
        direction: "give",
        principal: "100.00",
        periodicity: "none",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await expect(
      caller.loans.create({
        direction: "borrow",
        principal: "0",
        periodicity: "none",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects invalid schedule without count or end date", async () => {
    const caller = appRouter.createCaller(createUserContext(testId(1)));

    await expect(
      caller.loans.create({
        direction: "lend",
        principal: "100.00",
        periodicity: "monthly",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await expect(
      caller.loans.create({
        direction: "lend",
        principal: "100.00",
        periodicity: "monthly",
        endDate: new Date("2020-01-01T00:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("addRepayment returns null for a foreign loan", async () => {
    callDataApi.mockResolvedValueOnce([]);

    const callerB = appRouter.createCaller(createUserContext(testId(2)));

    await expect(
      callerB.loans.addRepayment({
        loanId: testId(1),
        amount: "50.00",
        date: now,
      }),
    ).resolves.toBeNull();
  });

  it("addRepayment persists for owned loan and getById reflects balance", async () => {
    callDataApi
      .mockResolvedValueOnce([sampleLoan])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ insertId: 10 })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([sampleLoan])
      .mockResolvedValueOnce([{ amount: "400.00" }])
      .mockResolvedValueOnce([sampleLoan])
      .mockResolvedValueOnce([{ amount: "400.00" }]);

    const caller = appRouter.createCaller(createUserContext(testId(1)));

    await expect(
      caller.loans.addRepayment({
        loanId: testId(1),
        amount: "400.00",
        date: sampleRepayment.date,
        note: "First payment",
      }),
    ).resolves.toMatchObject({ amount: "400.00" });

    await expect(
      caller.loans.getById({ id: testId(1) }),
    ).resolves.toMatchObject({
      id: testId(1),
      remainingBalance: "600.00",
    });
  });

  it("recordRepayment rejects over-payment at router layer", async () => {
    callDataApi
      .mockResolvedValueOnce([sampleLoan])
      .mockResolvedValueOnce([{ amount: "950.00" }]);

    const caller = appRouter.createCaller(createUserContext(testId(1)));

    await expect(
      caller.loans.recordRepayment({
        loanId: testId(1),
        amount: "100.00",
        date: now,
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Repayment cannot exceed remaining balance",
    });
  });

  it("rejects non-positive repayment amounts", async () => {
    const caller = appRouter.createCaller(createUserContext(testId(1)));

    await expect(
      caller.loans.recordRepayment({
        loanId: testId(1),
        amount: "0",
        date: now,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await expect(
      caller.loans.recordRepayment({
        loanId: testId(1),
        amount: "1.234",
        date: now,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

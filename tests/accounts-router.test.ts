import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";
import type { Account } from "@/drizzle/schema";
import type { Id } from "@/drizzle/schema";
import { testId, syncColumns } from "./helpers/ids";
import { isUlid } from "@shared/ulid";

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
    loginMethod: "password",
    passwordHash: null,
    role: "user",
    aiEnabled: false,
    remindersEnabled: false,
    pinHash: null,
  cardKey: null,
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

const sampleAccount: Account = {
  id: testId(1),
  userId: testId(1),
  name: "Checking",
  type: "bank",
  currency: "USD",
  isDefault: false,
  createdAt: now,
  updatedAt: now,
  ...syncColumns(),
};

const sampleCategory = {
  id: testId(1),
  userId: testId(1),
  name: "Groceries",
  type: "expense",
  color: "#10B981",
  icon: "cart",
  isDefault: false,
  createdAt: now,
  updatedAt: now,
};

describe("accounts router", () => {
  beforeEach(() => {
    callDataApi.mockReset();
  });

  it("creates and returns an account scoped to the authenticated user", async () => {
    callDataApi
      .mockResolvedValueOnce({ insertId: 2 })
      .mockResolvedValueOnce([
        { ...sampleAccount, id: testId(2), userId: testId(1) },
      ]);

    const caller = appRouter.createCaller(createUserContext(testId(1)));
    const created = await caller.accounts.create({
      name: "Checking",
      type: "bank",
      currency: "USD",
    });

    expect(created?.userId).toBe(testId(1));
    expect(created?.name).toBe("Checking");
  });

  it("lists only the authenticated user's accounts", async () => {
    callDataApi.mockResolvedValueOnce([sampleAccount]);

    const caller = appRouter.createCaller(createUserContext(testId(1)));
    await expect(caller.accounts.list()).resolves.toEqual([sampleAccount]);

    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: {
        query:
          "SELECT * FROM accounts WHERE userId = ? AND deletedAt IS NULL ORDER BY name",
        params: [testId(1)],
      },
    });
  });

  it("rejects invalid account type at the API boundary", async () => {
    const caller = appRouter.createCaller(createUserContext(testId(1)));

    await expect(
      caller.accounts.create({
        name: "Crypto",
        type: "crypto",
      } as unknown as Parameters<typeof caller.accounts.create>[0]),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects whitespace-only account names", async () => {
    const caller = appRouter.createCaller(createUserContext(testId(1)));

    await expect(
      caller.accounts.create({
        name: "   ",
        type: "cash",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("propagates transaction count query failures", async () => {
    callDataApi
      .mockResolvedValueOnce([sampleAccount])
      .mockRejectedValueOnce(new Error("database unavailable"));

    const caller = appRouter.createCaller(createUserContext(testId(1)));
    await expect(
      caller.accounts.transactionCount({ id: testId(1) }),
    ).rejects.toThrow("database unavailable");
  });

  it("rejects invalid currency length", async () => {
    const caller = appRouter.createCaller(createUserContext(testId(1)));

    await expect(
      caller.accounts.create({
        name: "Wallet",
        type: "wallet",
        currency: "US",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("allows transactions.create without accountId", async () => {
    callDataApi
      // SP-023: category ownership is verified before the insert.
      .mockResolvedValueOnce([sampleCategory])
      .mockResolvedValueOnce(undefined);

    const caller = appRouter.createCaller(createUserContext(testId(1)));
    const id = await caller.transactions.create({
      categoryId: testId(1),
      type: "expense",
      amount: "12.50",
      date: new Date("2026-06-10"),
    });

    expect(isUlid(id)).toBe(true);
    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: expect.objectContaining({
        params: expect.arrayContaining([
          testId(1),
          testId(1),
          null,
          "expense",
          "12.50",
        ]),
      }),
    });
  });

  it("persists accountId on transactions.create after ownership check", async () => {
    callDataApi
      .mockResolvedValueOnce([sampleAccount])
      .mockResolvedValueOnce([sampleCategory])
      .mockResolvedValueOnce(undefined);

    const caller = appRouter.createCaller(createUserContext(testId(1)));
    const id = await caller.transactions.create({
      categoryId: testId(1),
      type: "income",
      amount: "200.00",
      date: new Date("2026-06-10"),
      accountId: testId(1),
    });
    expect(isUlid(id)).toBe(true);

    expect(callDataApi).toHaveBeenNthCalledWith(1, "Database/query", {
      body: {
        query:
          "SELECT * FROM accounts WHERE id = ? AND userId = ? AND deletedAt IS NULL",
        params: [testId(1), testId(1)],
      },
    });
    expect(callDataApi).toHaveBeenLastCalledWith("Database/query", {
      body: expect.objectContaining({
        params: expect.arrayContaining([
          testId(1),
          testId(1),
          null,
          testId(1),
          "income",
          "200.00",
        ]),
      }),
    });
  });

  it("rejects transactions.create with another user's account", async () => {
    callDataApi.mockResolvedValueOnce([]);

    const caller = appRouter.createCaller(createUserContext(testId(1)));
    await expect(
      caller.transactions.create({
        categoryId: testId(1),
        type: "expense",
        amount: "12.50",
        date: new Date("2026-06-10"),
        accountId: testId(99),
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(callDataApi).toHaveBeenCalledTimes(1);
  });

  it("persists null accountId on user-scoped transactions.update", async () => {
    // SP-023: a categoryId in the patch is ownership-checked before the UPDATE.
    callDataApi.mockResolvedValueOnce([sampleCategory]);
    const caller = appRouter.createCaller(createUserContext(testId(1)));
    await caller.transactions.update({
      id: testId(7),
      categoryId: testId(1),
      type: "expense",
      amount: "12.50",
      date: new Date("2026-06-10"),
      accountId: null,
    });

    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: {
        query: expect.stringContaining("WHERE id = ? AND userId = ?"),
        params: expect.arrayContaining([null, testId(7), testId(1)]),
      },
    });
  });

  it("rejects transactions.update with another user's account", async () => {
    callDataApi.mockResolvedValueOnce([]);

    const caller = appRouter.createCaller(createUserContext(testId(1)));
    await expect(
      caller.transactions.update({
        id: testId(7),
        categoryId: testId(1),
        type: "expense",
        amount: "12.50",
        date: new Date("2026-06-10"),
        accountId: testId(99),
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(callDataApi).toHaveBeenCalledTimes(1);
  });

  // Regression (Story 9.5 P0): the edit screen's "Save account" sends ONLY
  // { id, accountId } — the exact partial payload below. The update input must
  // accept it (transactionSchema.partial()); a full-required schema rejected it
  // with a Zod BAD_REQUEST before the resolver ran, so the feature never worked.
  it("accepts a partial { id, accountId } payload (the real edit-screen shape) and persists it", async () => {
    callDataApi
      .mockResolvedValueOnce([
        { ...sampleAccount, id: testId(11), userId: testId(1) },
      ]) // ownership check
      .mockResolvedValueOnce(undefined); // UPDATE

    const caller = appRouter.createCaller(createUserContext(testId(1)));
    await expect(
      caller.transactions.update({ id: testId(7), accountId: testId(11) }),
    ).resolves.not.toThrow();

    expect(callDataApi).toHaveBeenNthCalledWith(1, "Database/query", {
      body: {
        query:
          "SELECT * FROM accounts WHERE id = ? AND userId = ? AND deletedAt IS NULL",
        params: [testId(11), testId(1)],
      },
    });
    expect(callDataApi).toHaveBeenLastCalledWith("Database/query", {
      body: {
        query:
          "UPDATE transactions SET accountId = ?, updatedAt = ?, dirty = 1 WHERE id = ? AND userId = ? AND deletedAt IS NULL",
        params: [testId(11), expect.any(Date), testId(7), testId(1)],
      },
    });
  });

  it("accepts a partial { id, accountId: null } clear payload without an ownership check", async () => {
    const caller = appRouter.createCaller(createUserContext(testId(1)));
    await expect(
      caller.transactions.update({ id: testId(7), accountId: null }),
    ).resolves.not.toThrow();

    // null accountId skips ownership lookup → exactly one call: the UPDATE.
    expect(callDataApi).toHaveBeenCalledTimes(1);
    expect(callDataApi).toHaveBeenLastCalledWith("Database/query", {
      body: {
        query:
          "UPDATE transactions SET accountId = ?, updatedAt = ?, dirty = 1 WHERE id = ? AND userId = ? AND deletedAt IS NULL",
        params: [null, expect.any(Date), testId(7), testId(1)],
      },
    });
  });

  it("emits no SQL when transactions.update has no fields to change", async () => {
    const caller = appRouter.createCaller(createUserContext(testId(1)));
    await expect(
      caller.transactions.update({ id: testId(7) }),
    ).resolves.not.toThrow();

    // Empty data → updateTransaction returns early, avoiding `SET  WHERE ...`.
    expect(callDataApi).not.toHaveBeenCalled();
  });

  it("scopes transactions.delete by the authenticated user (IDOR guard)", async () => {
    const caller = appRouter.createCaller(createUserContext(testId(1)));
    await caller.transactions.delete({ id: testId(7) });

    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: {
        query:
          "UPDATE transactions SET deletedAt = ?, updatedAt = ?, dirty = 1 WHERE id = ? AND userId = ? AND deletedAt IS NULL",
        params: [expect.any(Date), expect.any(Date), testId(7), testId(1)],
      },
    });
  });

  it("scopes transactions.getById by the authenticated user (IDOR guard)", async () => {
    callDataApi.mockResolvedValueOnce([]);

    const caller = appRouter.createCaller(createUserContext(testId(1)));
    await caller.transactions.getById({ id: testId(7) });

    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: {
        query:
          "SELECT * FROM transactions WHERE id = ? AND userId = ? AND deletedAt IS NULL",
        params: [testId(7), testId(1)],
      },
    });
  });

  it("returns transaction count scoped to the authenticated user", async () => {
    callDataApi
      .mockResolvedValueOnce([sampleAccount])
      .mockResolvedValueOnce([{ txCount: 3 }]);

    const caller = appRouter.createCaller(createUserContext(testId(1)));
    await expect(
      caller.accounts.transactionCount({ id: testId(1) }),
    ).resolves.toBe(3);

    expect(callDataApi).toHaveBeenLastCalledWith("Database/query", {
      body: {
        query:
          "SELECT COUNT(*) as txCount FROM transactions WHERE userId = ? AND accountId = ? AND deletedAt IS NULL",
        params: [testId(1), testId(1)],
      },
    });
  });

  it("blocks delete when linked transactions exist", async () => {
    callDataApi
      .mockResolvedValueOnce([sampleAccount])
      .mockResolvedValueOnce([{ txCount: 2 }]);

    const caller = appRouter.createCaller(createUserContext(testId(1)));
    await expect(
      caller.accounts.delete({ id: testId(1) }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
  });

  it("reassigns transactions then deletes the source account", async () => {
    const targetAccount = { ...sampleAccount, id: testId(2), name: "Savings" };
    callDataApi
      .mockResolvedValueOnce([sampleAccount])
      .mockResolvedValueOnce([targetAccount])
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    const caller = appRouter.createCaller(createUserContext(testId(1)));
    await expect(
      caller.accounts.reassignAndDelete({
        id: testId(1),
        targetAccountId: testId(2),
      }),
    ).resolves.toBeUndefined();

    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: {
        query: expect.stringContaining("UPDATE transactions SET accountId = ?"),
        params: expect.arrayContaining([testId(2), testId(1), testId(1)]),
      },
    });
    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: {
        query: expect.stringContaining(
          "UPDATE transfers SET deletedAt = ?, updatedAt = ?, dirty = 1 WHERE userId = ? AND fromAccountId = ? AND toAccountId = ?",
        ),
        params: expect.arrayContaining([testId(1), testId(1), testId(2)]),
      },
    });
    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: {
        query: expect.stringContaining(
          "UPDATE transfers SET deletedAt = ?, updatedAt = ?, dirty = 1 WHERE userId = ? AND fromAccountId = ? AND toAccountId = ?",
        ),
        params: expect.arrayContaining([testId(1), testId(2), testId(1)]),
      },
    });
    expect(callDataApi).toHaveBeenCalledWith("Database/query", {
      body: {
        query: expect.stringContaining(
          "UPDATE accounts SET deletedAt = ?, updatedAt = ?, dirty = 1 WHERE id = ? AND userId = ?",
        ),
        params: expect.arrayContaining([testId(1), testId(1)]),
      },
    });
  });

  it("returns transfer count scoped to the authenticated user", async () => {
    callDataApi
      .mockResolvedValueOnce([sampleAccount])
      .mockResolvedValueOnce([{ transferCount: 2 }]);

    const caller = appRouter.createCaller(createUserContext(testId(1)));
    await expect(
      caller.accounts.transferCount({ id: testId(1) }),
    ).resolves.toBe(2);

    expect(callDataApi).toHaveBeenLastCalledWith("Database/query", {
      body: {
        query:
          "SELECT COUNT(*) as transferCount FROM transfers WHERE userId = ? AND (fromAccountId = ? OR toAccountId = ?) AND deletedAt IS NULL",
        params: [testId(1), testId(1), testId(1)],
      },
    });
  });

  it("rejects reassigning to the same account", async () => {
    const caller = appRouter.createCaller(createUserContext(testId(1)));
    await expect(
      caller.accounts.reassignAndDelete({
        id: testId(1),
        targetAccountId: testId(1),
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("returns derived balances scoped to the authenticated user", async () => {
    callDataApi
      .mockResolvedValueOnce([
        {
          id: testId(1),
          accountId: testId(1),
          type: "income",
          amount: "50.00",
        },
        {
          id: testId(2),
          accountId: testId(1),
          type: "expense",
          amount: "20.00",
        },
      ])
      .mockResolvedValueOnce([]);

    const caller = appRouter.createCaller(createUserContext(testId(1)));
    await expect(caller.accounts.balances()).resolves.toEqual([
      { accountId: testId(1), balance: 30 },
    ]);

    expect(callDataApi).toHaveBeenNthCalledWith(1, "Database/query", {
      body: {
        query:
          "SELECT id, accountId, type, amount FROM transactions WHERE userId = ? AND deletedAt IS NULL",
        params: [testId(1)],
      },
    });
    expect(callDataApi).toHaveBeenNthCalledWith(2, "Database/query", {
      body: {
        query:
          "SELECT * FROM transfers WHERE userId = ? AND deletedAt IS NULL ORDER BY date DESC, id DESC",
        params: [testId(1)],
      },
    });
  });

  it("records a transfer and folds legs into balances (AC1, AC5)", async () => {
    const fromAccount = { ...sampleAccount, id: testId(1) };
    const toAccount = { ...sampleAccount, id: testId(2), name: "Savings" };
    const transferDate = new Date("2026-06-10");

    callDataApi
      .mockResolvedValueOnce([fromAccount])
      .mockResolvedValueOnce([toAccount])
      .mockResolvedValueOnce({ insertId: 9 })
      .mockResolvedValueOnce([
        {
          id: testId(9),
          userId: testId(1),
          fromAccountId: testId(1),
          toAccountId: testId(2),
          amount: "50.00",
          description: null,
          date: transferDate,
          createdAt: transferDate,
          updatedAt: transferDate,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: testId(1),
          accountId: testId(1),
          type: "income",
          amount: "100.00",
        },
        {
          id: testId(2),
          accountId: testId(2),
          type: "income",
          amount: "20.00",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: testId(9),
          userId: testId(1),
          fromAccountId: testId(1),
          toAccountId: testId(2),
          amount: "50.00",
          description: null,
          date: transferDate,
          createdAt: transferDate,
          updatedAt: transferDate,
        },
      ]);

    const caller = appRouter.createCaller(createUserContext(testId(1)));
    const created = await caller.accounts.transfer({
      fromAccountId: testId(1),
      toAccountId: testId(2),
      amount: "50.00",
      date: transferDate,
    });

    expect(created?.id).toBe(testId(9));

    await expect(caller.accounts.balances()).resolves.toEqual([
      { accountId: testId(1), balance: 50 },
      { accountId: testId(2), balance: 70 },
    ]);
  });

  it("rejects same-account transfers (AC3)", async () => {
    const caller = appRouter.createCaller(createUserContext(testId(1)));
    await expect(
      caller.accounts.transfer({
        fromAccountId: testId(1),
        toAccountId: testId(1),
        amount: "10.00",
        date: new Date("2026-06-10"),
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects non-positive transfer amounts (AC4)", async () => {
    const caller = appRouter.createCaller(createUserContext(testId(1)));
    await expect(
      caller.accounts.transfer({
        fromAccountId: testId(1),
        toAccountId: testId(2),
        amount: "0",
        date: new Date("2026-06-10"),
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects transfers referencing another user's account", async () => {
    callDataApi
      .mockResolvedValueOnce([sampleAccount])
      .mockResolvedValueOnce([]);

    const caller = appRouter.createCaller(createUserContext(testId(1)));
    await expect(
      caller.accounts.transfer({
        fromAccountId: testId(1),
        toAccountId: testId(2),
        amount: "10.00",
        date: new Date("2026-06-10"),
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects cross-currency transfers", async () => {
    callDataApi
      .mockResolvedValueOnce([sampleAccount])
      .mockResolvedValueOnce([
        { ...sampleAccount, id: testId(2), currency: "EUR" },
      ]);

    const caller = appRouter.createCaller(createUserContext(testId(1)));
    await expect(
      caller.accounts.transfer({
        fromAccountId: testId(1),
        toAccountId: testId(2),
        amount: "10.00",
        date: new Date("2026-06-10"),
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Transfers require accounts with the same currency",
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../server/_core/context";

const dbMock = vi.hoisted(() => ({
  getUserRecurringTransactions: vi.fn(),
  createRecurringTransaction: vi.fn(),
  updateRecurringTransaction: vi.fn(),
  deleteRecurringTransaction: vi.fn(),
  getRecurringTransactionById: vi.fn(),
}));

vi.mock("@/server/db", () => dbMock);

import { appRouter } from "@/server/routers";
import type { Id } from "@/drizzle/schema";
import { testId, syncColumns } from "./helpers/ids";

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

const validCreateInput = {
  categoryId: testId(1),
  type: "expense" as const,
  amount: "50.00",
  frequency: "monthly" as const,
  interval: 1,
  endCondition: "never" as const,
  startDate: new Date("2026-06-17T00:00:00.000Z"),
};

describe("recurringTransactions router", () => {
  beforeEach(() => {
    Object.values(dbMock).forEach((fn) => fn.mockReset());
    dbMock.getUserRecurringTransactions.mockResolvedValue([]);
    dbMock.createRecurringTransaction.mockResolvedValue(99);
    dbMock.updateRecurringTransaction.mockResolvedValue(undefined);
    dbMock.deleteRecurringTransaction.mockResolvedValue(undefined);
    dbMock.getRecurringTransactionById.mockResolvedValue(null);
  });

  it("creates a recurring transaction scoped to ctx.user.id", async () => {
    const caller = appRouter.createCaller(createUserContext(testId(42)));
    const startDate = validCreateInput.startDate;

    await caller.recurringTransactions.create({
      ...validCreateInput,
      creditCardId: null,
      description: "Rent",
    });

    expect(dbMock.createRecurringTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: testId(42),
        nextRunDate: startDate,
      }),
    );
  });

  it("rejects count endCondition without occurrenceCount", async () => {
    const caller = appRouter.createCaller(createUserContext(testId(1)));

    await expect(
      caller.recurringTransactions.create({
        ...validCreateInput,
        endCondition: "count",
      }),
    ).rejects.toThrow();
  });

  it("rejects endDate endCondition when endDate is not after startDate", async () => {
    const caller = appRouter.createCaller(createUserContext(testId(1)));
    const startDate = new Date("2026-06-17T00:00:00.000Z");

    await expect(
      caller.recurringTransactions.create({
        ...validCreateInput,
        startDate,
        endCondition: "endDate",
        endDate: startDate,
      }),
    ).rejects.toThrow();
  });

  it("rejects zero interval", async () => {
    const caller = appRouter.createCaller(createUserContext(testId(1)));

    await expect(
      caller.recurringTransactions.create({
        ...validCreateInput,
        interval: 0,
      }),
    ).rejects.toThrow();
  });

  it("rejects invalid amount precision", async () => {
    const caller = appRouter.createCaller(createUserContext(testId(1)));

    await expect(
      caller.recurringTransactions.create({
        ...validCreateInput,
        amount: "1.999",
      }),
    ).rejects.toThrow();
  });

  it("user B cannot see or mutate user A recurrence", async () => {
    const callerB = appRouter.createCaller(createUserContext(testId(2)));

    await expect(callerB.recurringTransactions.list()).resolves.toEqual([]);
    expect(dbMock.getUserRecurringTransactions).toHaveBeenCalledWith(testId(2));

    await expect(
      callerB.recurringTransactions.getById({ id: testId(5) }),
    ).resolves.toBeNull();
    expect(dbMock.getRecurringTransactionById).toHaveBeenCalledWith(
      testId(5),
      testId(2),
    );

    await callerB.recurringTransactions.update({
      id: testId(5),
      ...validCreateInput,
    });
    expect(dbMock.updateRecurringTransaction).toHaveBeenCalledWith(
      testId(5),
      testId(2),
      expect.any(Object),
    );

    await callerB.recurringTransactions.delete({ id: testId(5) });
    expect(dbMock.deleteRecurringTransaction).toHaveBeenCalledWith(
      testId(5),
      testId(2),
    );
  });
});

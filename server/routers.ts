import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "./_core/trpc";
import * as db from "./db";
import {
  CATEGORY_DEFAULT_COLOR,
  DEFAULT_CATEGORY_ICON,
  getCategoryColorForName,
} from "../shared/theme";
import {
  hashPin,
  verifyPinHash,
  isPinLocked,
  recordFailedAttempt,
  MAX_PIN_ATTEMPTS,
} from "./_core/pin-crypto";

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

/** Luhn checksum used by every major card scheme (SP-012). */
export function isLuhnValid(cardNumber: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = cardNumber.length - 1; i >= 0; i--) {
    let digit = cardNumber.charCodeAt(i) - 48;
    if (digit < 0 || digit > 9) return false;
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum > 0 && sum % 10 === 0;
}

/** True when the card is still valid at the end of its expiry month (SP-033). */
export function isExpiryInFuture(
  month: number,
  year: number,
  now: Date = new Date(),
): boolean {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  if (year > currentYear) return true;
  if (year < currentYear) return false;
  return month >= currentMonth;
}

/** Unwrapped card fields — `creditCardSchema` is a ZodEffects and has no `.shape`. */
const creditCardFields = {
  name: z.string().min(1).max(100),
  cardNumber: z
    .string()
    .regex(/^\d{13,19}$/, "Card number must be 13-19 digits")
    .refine(isLuhnValid, { message: "Card number failed the Luhn check" }),
  cardholderName: z.string().min(1).max(100),
  expiryMonth: z.number().int().min(1).max(12),
  expiryYear: z
    .number()
    .int()
    .min(new Date().getFullYear())
    .max(new Date().getFullYear() + 30),
  creditLimit: z.string().regex(/^\d+(\.\d{1,2})?$/),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i)
    .optional(),
  cardType: z.string().max(50).optional(),
};

const categorySchema = z.object({
  // SP-031: the client submitted the untrimmed value, so " Food " and "Food"
  // could coexist as visually identical categories.
  name: z.string().trim().min(1).max(100),
  type: z.enum(["income", "expense"]),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i)
    .optional(),
  icon: z.string().max(50).optional(),
});

const creditCardSchema = z
  .object({
    name: z.string().min(1).max(100),
    // SP-012: was `min(13).max(19)` with no digit or checksum constraint, so
    // "abcdefghijklm" was accepted, encrypted and stored.
    cardNumber: z
      .string()
      .regex(/^\d{13,19}$/, "Card number must be 13-19 digits")
      .refine(isLuhnValid, { message: "Card number failed the Luhn check" }),
    cardholderName: z.string().min(1).max(100),
    expiryMonth: z.number().int().min(1).max(12),
    // SP-033: the hard-coded 2024 floor accepted already-expired cards and
    // grows more wrong every year. Bounded relative to today instead.
    expiryYear: z
      .number()
      .int()
      .min(new Date().getFullYear())
      .max(new Date().getFullYear() + 30),
    creditLimit: z.string().regex(/^\d+(\.\d{1,2})?$/),
    color: z
      .string()
      .regex(/^#[0-9A-F]{6}$/i)
      .optional(),
    cardType: z.string().max(50).optional(),
  })
  .superRefine((value, ctx) => {
    if (!isExpiryInFuture(value.expiryMonth, value.expiryYear)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Card has already expired",
        path: ["expiryMonth"],
      });
    }
  });

const accountSchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: z.enum(["cash", "bank", "wallet"]),
  currency: z.string().length(3).optional(),
});

const transferSchema = z
  .object({
    fromAccountId: z.number(),
    toAccountId: z.number(),
    amount: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/)
      .refine((value) => Number(value) > 0, {
        message: "Amount must be positive",
      }),
    description: z.string().max(500).optional(),
    date: z.date(),
  })
  .refine((value) => value.fromAccountId !== value.toAccountId, {
    message: "Source and destination must be different accounts",
  });

const transactionSchema = z.object({
  categoryId: z.number(),
  type: z.enum(["income", "expense"]),
  // SP-041: was `regex` only, which accepts "0" and "0.00". Every other money
  // field in this file already refines to > 0; transactions were the outlier.
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .refine((v) => Number(v) > 0, {
      message: "Amount must be greater than zero",
    }),
  description: z.string().max(500).optional(),
  date: z.date(),
  creditCardId: z.number().optional(),
  accountId: z.number().nullable().optional(),
});

const budgetSchema = z.object({
  categoryId: z.number(),
  period: z.enum(["monthly", "weekly"]),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .refine((v) => Number(v) > 0, {
      message: "Amount must be greater than zero",
    }),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
});

const positiveMoneySchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/)
  .refine((v) => Number(v) > 0, {
    message: "Amount must be greater than zero",
  });

const loanSchema = z
  .object({
    direction: z.enum(["lend", "borrow"]),
    counterparty: z.string().max(100).nullable().optional(),
    principal: positiveMoneySchema,
    rate: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/)
      .refine((v) => Number(v) >= 0, {
        message: "Rate must be zero or greater",
      })
      .nullable()
      .optional(),
    periodicity: z.enum(["weekly", "monthly", "yearly", "none"]),
    installmentCount: z.number().int().positive().nullable().optional(),
    endDate: z.date().nullable().optional(),
    nextDueDate: z.date().nullable().optional(),
    status: z.enum(["active", "settled"]).optional(),
    note: z.string().max(2000).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.periodicity === "none") {
      return;
    }

    const hasCount =
      value.installmentCount != null && value.installmentCount > 0;
    const hasEndDate = value.endDate != null;

    if (!hasCount && !hasEndDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Schedule requires installment count or end date",
        path: ["installmentCount"],
      });
    }

    if (hasEndDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endDay = new Date(
        value.endDate!.getFullYear(),
        value.endDate!.getMonth(),
        value.endDate!.getDate(),
      );
      if (endDay <= today) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "End date must be in the future",
          path: ["endDate"],
        });
      }
    }
  });

const repaymentInputSchema = z.object({
  loanId: z.number(),
  amount: positiveMoneySchema,
  date: z.date(),
  note: z.string().max(2000).nullable().optional(),
});

const recurringTransactionSchemaBase = z.object({
  categoryId: z.number(),
  creditCardId: z.number().nullable().optional(),
  type: z.enum(["income", "expense"]),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  description: z.string().max(500).nullable().optional(),
  frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
  interval: z.number().int().positive(),
  endCondition: z.enum(["count", "endDate", "never"]),
  occurrenceCount: z.number().int().min(1).nullable().optional(),
  endDate: z.date().nullable().optional(),
  startDate: z.date(),
});

const recurringTransactionSchema = recurringTransactionSchemaBase.superRefine(
  (value, ctx) => {
    if (value.endCondition === "count") {
      if (value.occurrenceCount == null || value.occurrenceCount < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "occurrenceCount must be >= 1 when endCondition is count",
          path: ["occurrenceCount"],
        });
      }
      if (value.endDate != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "endDate must be omitted when endCondition is count",
          path: ["endDate"],
        });
      }
    }

    if (value.endCondition === "endDate") {
      if (value.endDate == null || value.endDate <= value.startDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "endDate must be greater than startDate",
          path: ["endDate"],
        });
      }
      if (value.occurrenceCount != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "occurrenceCount must be omitted when endCondition is endDate",
          path: ["occurrenceCount"],
        });
      }
    }

    if (value.endCondition === "never") {
      if (value.endDate != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "endDate must be omitted when endCondition is never",
          path: ["endDate"],
        });
      }
      if (value.occurrenceCount != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "occurrenceCount must be omitted when endCondition is never",
          path: ["occurrenceCount"],
        });
      }
    }
  },
);

// ============================================================================
// OWNERSHIP GUARDS
// ============================================================================

/**
 * Every procedure that accepts a client-supplied row id must prove the row
 * belongs to the caller before touching it. The DB layer is also scoped by
 * `userId`, so these guards exist to turn a silent no-op into an explicit
 * NOT_FOUND — and to keep single-row writes consistent with the bulk paths.
 */
async function assertOwnedCategory(id: number, userId: number) {
  const category = await db.getCategoryById(id, userId);
  if (!category) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Category not found" });
  }
  return category;
}

/** Case-insensitive uniqueness for category names within a user + type (SP-031). */
async function assertCategoryNameAvailable(
  name: string,
  type: "income" | "expense",
  userId: number,
  excludeId?: number,
) {
  const existing = await db.getUserCategories(userId, type);
  const clash = existing.find(
    (category: { id: number; name: string }) =>
      category.id !== excludeId &&
      category.name.trim().toLowerCase() === name.trim().toLowerCase(),
  );
  if (clash) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `${type === "expense" ? "An" : "A"} ${type} category named "${name}" already exists.`,
    });
  }
}

async function assertOwnedCard(id: number, userId: number) {
  const card = await db.getCreditCardById(id, userId);
  if (!card) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Credit card not found",
    });
  }
  return card;
}

// ============================================================================
// CATEGORIES ROUTER
// ============================================================================

const categoriesRouter = router({
  list: protectedProcedure
    .input(
      z.object({ type: z.enum(["income", "expense"]).optional() }).optional(),
    )
    .query(({ ctx, input }) => {
      return db.getUserCategories(ctx.user.id, input?.type);
    }),

  create: protectedProcedure
    .input(categorySchema)
    .mutation(async ({ ctx, input }) => {
      await assertCategoryNameAvailable(input.name, input.type, ctx.user.id);
      return db.createCategory({
        userId: ctx.user.id,
        ...input,
        // No explicit color → assign a distinct palette token by hashing the
        // name, so auto-defaulted categories don't all collide on indigo.
        color: input.color || getCategoryColorForName(input.name),
        icon: input.icon || DEFAULT_CATEGORY_ICON,
      });
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), ...categorySchema.shape }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await assertOwnedCategory(id, ctx.user.id);
      await assertCategoryNameAvailable(data.name, data.type, ctx.user.id, id);
      return db.updateCategory(id, ctx.user.id, data);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertOwnedCategory(input.id, ctx.user.id);
      return db.deleteCategory(input.id, ctx.user.id);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ ctx, input }) => {
      return db.getCategoryById(input.id, ctx.user.id);
    }),
});

// ============================================================================
// CREDIT CARDS ROUTER
// ============================================================================

const creditCardsRouter = router({
  list: protectedProcedure.query(({ ctx }) => {
    return db.getUserCreditCards(ctx.user.id);
  }),

  create: protectedProcedure
    .input(creditCardSchema)
    .mutation(({ ctx, input }) => {
      return db.createCreditCard({
        userId: ctx.user.id,
        cardNumber: input.cardNumber,
        cardholderName: input.cardholderName,
        expiryMonth: input.expiryMonth,
        expiryYear: input.expiryYear,
        creditLimit: input.creditLimit,
        color: input.color || CATEGORY_DEFAULT_COLOR,
        cardType: input.cardType || "credit",
        name: input.name,
      });
    }),

  update: protectedProcedure
    .input(
      z
        .object({
          id: z.number(),
          name: creditCardFields.name,
          cardNumber: creditCardFields.cardNumber.optional(),
          cardholderName: creditCardFields.cardholderName,
          expiryMonth: creditCardFields.expiryMonth,
          expiryYear: creditCardFields.expiryYear,
          creditLimit: creditCardFields.creditLimit,
          color: creditCardFields.color,
          cardType: creditCardFields.cardType,
        })
        .superRefine((value, ctx) => {
          if (!isExpiryInFuture(value.expiryMonth, value.expiryYear)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Card has already expired",
              path: ["expiryMonth"],
            });
          }
        }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, cardNumber, ...data } = input;
      await assertOwnedCard(id, ctx.user.id);
      return db.updateCreditCard(id, ctx.user.id, {
        ...data,
        creditLimit: data.creditLimit,
        ...(cardNumber !== undefined ? { cardNumber } : {}),
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertOwnedCard(input.id, ctx.user.id);
      return db.deleteCreditCard(input.id, ctx.user.id);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ ctx, input }) => {
      return db.getCreditCardById(input.id, ctx.user.id);
    }),
});

// ============================================================================
// ACCOUNTS ROUTER
// ============================================================================

const accountsRouter = router({
  list: protectedProcedure.query(({ ctx }) => {
    return db.getUserAccounts(ctx.user.id);
  }),

  create: protectedProcedure.input(accountSchema).mutation(({ ctx, input }) => {
    return db.createAccount({
      userId: ctx.user.id,
      name: input.name,
      type: input.type,
      currency: input.currency ?? "USD",
    });
  }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), ...accountSchema.partial().shape }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return db.updateAccount(id, ctx.user.id, data);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const account = await db.getAccountById(input.id, ctx.user.id);
      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found",
        });
      }

      const txCount = await db.getAccountTransactionCount(
        input.id,
        ctx.user.id,
      );
      if (txCount > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Account has linked transactions",
        });
      }

      const transferCount = await db.getAccountTransferCount(
        input.id,
        ctx.user.id,
      );
      if (transferCount > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Account has linked transfers",
        });
      }

      await db.deleteAccount(input.id, ctx.user.id);
    }),

  transactionCount: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const account = await db.getAccountById(input.id, ctx.user.id);
      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found",
        });
      }
      return db.getAccountTransactionCount(input.id, ctx.user.id);
    }),

  transferCount: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const account = await db.getAccountById(input.id, ctx.user.id);
      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found",
        });
      }
      return db.getAccountTransferCount(input.id, ctx.user.id);
    }),

  reassignAndDelete: protectedProcedure
    .input(
      z
        .object({
          id: z.number(),
          targetAccountId: z.number(),
        })
        .refine((value) => value.id !== value.targetAccountId, {
          message: "Cannot reassign to the same account",
        }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await db.reassignAndDeleteAccount(
          input.id,
          input.targetAccountId,
          ctx.user.id,
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to reassign account";
        if (message === "Account not found") {
          throw new TRPCError({ code: "NOT_FOUND", message });
        }
        if (message === "Cannot reassign to the same account") {
          throw new TRPCError({ code: "BAD_REQUEST", message });
        }
        throw error;
      }
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ ctx, input }) => {
      return db.getAccountById(input.id, ctx.user.id);
    }),

  balances: protectedProcedure.query(async ({ ctx }) => {
    const balances = await db.getAccountBalances(ctx.user.id);
    return Object.entries(balances).map(([accountId, balance]) => ({
      accountId: Number(accountId),
      balance,
    }));
  }),

  transfers: protectedProcedure.query(({ ctx }) => {
    return db.getUserTransfers(ctx.user.id);
  }),

  transfer: protectedProcedure
    .input(transferSchema)
    .mutation(async ({ ctx, input }) => {
      const fromAccount = await db.getAccountById(
        input.fromAccountId,
        ctx.user.id,
      );
      const toAccount = await db.getAccountById(input.toAccountId, ctx.user.id);

      if (!fromAccount || !toAccount) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found",
        });
      }

      if (fromAccount.currency !== toAccount.currency) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Transfers require accounts with the same currency",
        });
      }

      const created = await db.createTransfer({
        userId: ctx.user.id,
        fromAccountId: input.fromAccountId,
        toAccountId: input.toAccountId,
        amount: input.amount,
        description: input.description,
        date: input.date,
      });

      if (!created) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create transfer",
        });
      }

      return created;
    }),
});

// ============================================================================
// TRANSACTIONS ROUTER
// ============================================================================

const transactionsRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().optional(),
          offset: z.number().optional(),
        })
        .optional(),
    )
    .query(({ ctx, input }) => {
      return db.getUserTransactions(ctx.user.id, input?.limit, input?.offset);
    }),

  listByDateRange: protectedProcedure
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
      }),
    )
    .query(({ ctx, input }) => {
      return db.getTransactionsByDateRange(
        ctx.user.id,
        input.startDate,
        input.endDate,
      );
    }),

  listByCategory: protectedProcedure
    .input(z.object({ categoryId: z.number() }))
    .query(({ ctx, input }) => {
      return db.getTransactionsByCategory(ctx.user.id, input.categoryId);
    }),

  listByCreditCard: protectedProcedure
    .input(z.object({ creditCardId: z.number() }))
    .query(({ ctx, input }) => {
      return db.getTransactionsByCreditCard(ctx.user.id, input.creditCardId);
    }),

  recent: protectedProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(({ ctx, input }) => {
      return db.getRecentTransactions(ctx.user.id, input?.limit || 7);
    }),

  create: protectedProcedure
    .input(transactionSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.accountId != null) {
        const account = await db.getAccountById(input.accountId, ctx.user.id);
        if (!account) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Account not found",
          });
        }
      }
      // Parity with createMany: a client must not be able to reference another
      // user's category or card by id (QA report SP-023).
      await assertOwnedCategory(input.categoryId, ctx.user.id);
      if (input.creditCardId != null) {
        await assertOwnedCard(input.creditCardId, ctx.user.id);
      }
      return db.createTransaction({
        userId: ctx.user.id,
        categoryId: input.categoryId,
        type: input.type,
        amount: input.amount,
        description: input.description,
        date: input.date,
        creditCardId: input.creditCardId,
        accountId: input.accountId,
      });
    }),

  createMany: protectedProcedure
    .input(z.array(transactionSchema).min(1).max(1000))
    .mutation(async ({ ctx, input }) => {
      const accountIds = Array.from(
        new Set(
          input
            .map((row) => row.accountId)
            .filter((id): id is number => id != null),
        ),
      );
      for (const accountId of accountIds) {
        const account = await db.getAccountById(accountId, ctx.user.id);
        if (!account) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Account not found",
          });
        }
      }

      const categoryIds = Array.from(
        new Set(input.map((row) => row.categoryId)),
      );
      for (const categoryId of categoryIds) {
        await assertOwnedCategory(categoryId, ctx.user.id);
      }

      const creditCardIds = Array.from(
        new Set(
          input
            .map((row) => row.creditCardId)
            .filter((id): id is number => id != null),
        ),
      );
      for (const creditCardId of creditCardIds) {
        await assertOwnedCard(creditCardId, ctx.user.id);
      }

      return db.createTransactionsBulk(
        input.map((row) => ({
          userId: ctx.user.id,
          categoryId: row.categoryId,
          type: row.type,
          amount: row.amount,
          description: row.description,
          date: row.date,
          creditCardId: row.creditCardId,
          accountId: row.accountId,
        })),
      );
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), ...transactionSchema.partial().shape }))
    .mutation(async ({ ctx, input }) => {
      if (input.accountId != null) {
        const account = await db.getAccountById(input.accountId, ctx.user.id);
        if (!account) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Account not found",
          });
        }
      }
      if (input.categoryId != null) {
        await assertOwnedCategory(input.categoryId, ctx.user.id);
      }
      if (input.creditCardId != null) {
        await assertOwnedCard(input.creditCardId, ctx.user.id);
      }
      const { id, ...data } = input;
      return db.updateTransaction(id, ctx.user.id, data);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => {
      return db.deleteTransaction(input.id, ctx.user.id);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ ctx, input }) => {
      return db.getTransactionById(input.id, ctx.user.id);
    }),
});

const recurringTransactionsRouter = router({
  list: protectedProcedure.query(({ ctx }) => {
    return db.getUserRecurringTransactions(ctx.user.id);
  }),

  create: protectedProcedure
    .input(recurringTransactionSchema)
    .mutation(({ ctx, input }) => {
      return db.createRecurringTransaction({
        userId: ctx.user.id,
        categoryId: input.categoryId,
        creditCardId: input.creditCardId ?? null,
        type: input.type,
        amount: input.amount,
        description: input.description ?? null,
        frequency: input.frequency,
        interval: input.interval,
        endCondition: input.endCondition,
        occurrenceCount: input.occurrenceCount ?? null,
        endDate: input.endDate ?? null,
        startDate: input.startDate,
        nextRunDate: input.startDate,
      });
    }),

  update: protectedProcedure
    .input(
      z
        .object({ id: z.number(), isActive: z.boolean().optional() })
        .and(recurringTransactionSchema),
    )
    .mutation(({ ctx, input }) => {
      const { id, isActive, ...data } = input;
      return db.updateRecurringTransaction(id, ctx.user.id, {
        ...data,
        creditCardId: data.creditCardId ?? null,
        description: data.description ?? null,
        occurrenceCount: data.occurrenceCount ?? null,
        endDate: data.endDate ?? null,
        ...(isActive !== undefined ? { isActive } : {}),
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => {
      return db.deleteRecurringTransaction(input.id, ctx.user.id);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ ctx, input }) => {
      return db.getRecurringTransactionById(input.id, ctx.user.id);
    }),
});

// ============================================================================
// SUMMARY ROUTER
// ============================================================================

const summaryRouter = router({
  monthlyStats: protectedProcedure
    .input(
      z.object({
        year: z.number(),
        month: z.number().min(1).max(12),
      }),
    )
    .query(({ ctx, input }) => {
      return db.getMonthlyStats(ctx.user.id, input.year, input.month);
    }),

  expensesByCategory: protectedProcedure
    .input(
      z.object({
        year: z.number(),
        month: z.number().min(1).max(12),
      }),
    )
    .query(({ ctx, input }) => {
      return db.getExpensesByCategory(ctx.user.id, input.year, input.month);
    }),

  categoryAnomalies: protectedProcedure
    .input(
      z.object({
        year: z.number(),
        month: z.number().min(1).max(12),
        lookbackMonths: z.number().min(1).max(12).optional(),
      }),
    )
    .query(({ ctx, input }) => {
      return db.getCategoryAnomalies(
        ctx.user.id,
        input.year,
        input.month,
        input.lookbackMonths ?? 3,
      );
    }),

  monthlyTrend: protectedProcedure
    .input(
      z.object({
        year: z.number(),
        month: z.number().min(1).max(12),
        count: z.number().min(1).max(24).optional(),
      }),
    )
    .query(({ ctx, input }) => {
      return db.getMonthlyTrend(
        ctx.user.id,
        input.year,
        input.month,
        input.count ?? 6,
      );
    }),
});

// ============================================================================
// BUDGETS ROUTER
// ============================================================================

const budgetsRouter = router({
  list: protectedProcedure.query(({ ctx }) => {
    return db.getUserBudgets(ctx.user.id);
  }),

  create: protectedProcedure
    .input(budgetSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await db.findActiveBudget(
        ctx.user.id,
        input.categoryId,
        input.period,
      );
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "An active budget already exists for this category and period.",
        });
      }
      return db.createBudget({
        userId: ctx.user.id,
        ...input,
      });
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), ...budgetSchema.shape }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const existing = await db.findActiveBudget(
        ctx.user.id,
        data.categoryId,
        data.period,
        { excludeId: id },
      );
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "An active budget already exists for this category and period.",
        });
      }
      return db.updateBudget(id, ctx.user.id, data);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => {
      return db.deleteBudget(input.id, ctx.user.id);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ ctx, input }) => {
      return db.getBudgetById(input.id, ctx.user.id);
    }),

  progress: protectedProcedure
    .input(
      z.object({
        monthStart: z.date(),
        monthEnd: z.date(),
        weekStart: z.date(),
        weekEnd: z.date(),
      }),
    )
    .query(({ ctx, input }) =>
      db.getBudgetProgress(
        ctx.user.id,
        input.monthStart,
        input.monthEnd,
        input.weekStart,
        input.weekEnd,
      ),
    ),
});

// ============================================================================
// LOANS ROUTER
// ============================================================================

const loansRouter = router({
  list: protectedProcedure.query(({ ctx }) => {
    return db.getUserLoans(ctx.user.id);
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ ctx, input }) => {
      return db.getLoanWithBalance(input.id, ctx.user.id);
    }),

  create: protectedProcedure.input(loanSchema).mutation(({ ctx, input }) => {
    return db.createLoan({
      userId: ctx.user.id,
      direction: input.direction,
      counterparty: input.counterparty ?? null,
      principal: input.principal,
      rate: input.rate ?? null,
      periodicity: input.periodicity,
      installmentCount: input.installmentCount ?? null,
      endDate: input.endDate ?? null,
      nextDueDate: input.nextDueDate ?? null,
      status: input.status ?? "active",
      note: input.note ?? null,
    });
  }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), ...loanSchema.partial().shape }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await db.updateLoan(id, ctx.user.id, data);
      return db.getLoanById(id, ctx.user.id);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => {
      return db.deleteLoan(input.id, ctx.user.id);
    }),

  addRepayment: protectedProcedure
    .input(repaymentInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const updated = await db.recordRepayment({
          loanId: input.loanId,
          userId: ctx.user.id,
          amount: input.amount,
          date: input.date,
          note: input.note ?? null,
        });
        if (!updated) {
          return null;
        }
        return (
          updated.repayments.find(
            (repayment) =>
              repayment.amount === input.amount &&
              new Date(repayment.date).getTime() === input.date.getTime(),
          ) ??
          updated.repayments[0] ??
          null
        );
      } catch (err) {
        if (err instanceof db.RepaymentExceedsBalanceError) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: err.message,
          });
        }
        throw err;
      }
    }),

  recordRepayment: protectedProcedure
    .input(repaymentInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const updated = await db.recordRepayment({
          loanId: input.loanId,
          userId: ctx.user.id,
          amount: input.amount,
          date: input.date,
          note: input.note ?? null,
        });
        if (!updated) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Loan not found",
          });
        }
        return updated;
      } catch (err) {
        if (err instanceof db.RepaymentExceedsBalanceError) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: err.message,
          });
        }
        throw err;
      }
    }),

  listRepayments: protectedProcedure
    .input(z.object({ loanId: z.number() }))
    .query(({ ctx, input }) => {
      return db.getRepaymentsByLoan(input.loanId, ctx.user.id);
    }),

  deleteRepayment: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => {
      return db.deleteRepayment(input.id, ctx.user.id);
    }),
});

// ============================================================================
// SETTINGS ROUTER
// ============================================================================

const settingsRouter = router({
  get: protectedProcedure.query(({ ctx }) => {
    return db.getUserSettings(ctx.user.id);
  }),

  setAiEnabled: protectedProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await db.updateAiEnabled(ctx.user.id, input.enabled);
      return { aiEnabled: input.enabled };
    }),
});

// ============================================================================
// SECURITY ROUTER — account-linked PIN (Epic 13, Story 13.6)
//
// Scope for this session (per resolved dev clarification on 86eyeq72c): sync
// a single account-wide PIN to the server as a salted hash, with a rate-limited
// verify path. Profile (mobile/email) and one-time-code recovery are descoped.
// ============================================================================

const PIN_INPUT = z.object({
  pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
});

const securityRouter = router({
  getPinStatus: protectedProcedure.query(async ({ ctx }) => {
    const state = await db.getUserPinState(ctx.user.id);
    return { pinSet: state.pinHash !== null };
  }),

  setPin: protectedProcedure
    .input(PIN_INPUT)
    .mutation(async ({ ctx, input }) => {
      const hash = hashPin(input.pin);
      await db.setUserPin(ctx.user.id, hash);
      return { pinSet: true };
    }),

  clearPin: protectedProcedure.mutation(async ({ ctx }) => {
    await db.clearUserPin(ctx.user.id);
    return { pinSet: false };
  }),

  verifyPin: protectedProcedure
    .input(PIN_INPUT)
    .mutation(async ({ ctx, input }) => {
      const state = await db.getUserPinState(ctx.user.id);

      if (!state.pinHash) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No account-linked PIN is set",
        });
      }

      const now = new Date();
      const attemptState = {
        failedAttempts: state.pinFailedAttempts,
        lockedUntil: state.pinLockedUntil,
      };
      if (isPinLocked(attemptState, now)) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many attempts. Try again later.",
        });
      }

      if (verifyPinHash(input.pin, state.pinHash)) {
        await db.recordPinAttemptResult(ctx.user.id, {
          failedAttempts: 0,
          lockedUntil: null,
        });
        return { valid: true as const };
      }

      const next = recordFailedAttempt(attemptState, now);
      await db.recordPinAttemptResult(ctx.user.id, next);
      return {
        valid: false as const,
        attemptsRemaining: Math.max(0, MAX_PIN_ATTEMPTS - next.failedAttempts),
        lockedUntil: next.lockedUntil ? next.lockedUntil.toISOString() : null,
      };
    }),
});

// ============================================================================
// DATA MANAGEMENT ROUTER
// ============================================================================

const dataRouter = router({
  clearAll: protectedProcedure.mutation(({ ctx }) => {
    return db.deleteAllUserData(ctx.user.id);
  }),
});

// ============================================================================
// APP ROUTER
// ============================================================================

export const appRouter = router({
  health: publicProcedure.query(() => ({ status: "ok" })),

  categories: categoriesRouter,
  creditCards: creditCardsRouter,
  accounts: accountsRouter,
  transactions: transactionsRouter,
  recurringTransactions: recurringTransactionsRouter,
  summary: summaryRouter,
  budgets: budgetsRouter,
  loans: loansRouter,
  settings: settingsRouter,
  security: securityRouter,
  data: dataRouter,
});

export type AppRouter = typeof appRouter;

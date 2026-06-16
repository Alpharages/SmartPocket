import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "./_core/trpc";
import * as db from "./db";
import {
  CATEGORY_DEFAULT_COLOR,
  getCategoryColorForName,
} from "../shared/theme";

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const categorySchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["income", "expense"]),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i)
    .optional(),
  icon: z.string().max(50).optional(),
});

const creditCardSchema = z.object({
  name: z.string().min(1).max(100),
  cardNumber: z.string().min(13).max(19),
  cardholderName: z.string().min(1).max(100),
  expiryMonth: z.number().min(1).max(12),
  expiryYear: z.number().min(2024).max(2099),
  creditLimit: z.string().regex(/^\d+(\.\d{1,2})?$/),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i)
    .optional(),
  cardType: z.string().max(50).optional(),
});

const transactionSchema = z.object({
  categoryId: z.number(),
  type: z.enum(["income", "expense"]),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  description: z.string().max(500).optional(),
  date: z.date(),
  creditCardId: z.number().optional(),
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
    .mutation(({ ctx, input }) => {
      return db.createCategory({
        userId: ctx.user.id,
        ...input,
        // No explicit color → assign a distinct palette token by hashing the
        // name, so auto-defaulted categories don't all collide on indigo.
        color: input.color || getCategoryColorForName(input.name),
        icon: input.icon || "tag",
      });
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), ...categorySchema.shape }))
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return db.updateCategory(id, data);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => {
      return db.deleteCategory(input.id);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => {
      return db.getCategoryById(input.id);
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
      z.object({
        id: z.number(),
        name: creditCardSchema.shape.name,
        cardNumber: creditCardSchema.shape.cardNumber.optional(),
        cardholderName: creditCardSchema.shape.cardholderName,
        expiryMonth: creditCardSchema.shape.expiryMonth,
        expiryYear: creditCardSchema.shape.expiryYear,
        creditLimit: creditCardSchema.shape.creditLimit,
        color: creditCardSchema.shape.color,
        cardType: creditCardSchema.shape.cardType,
      }),
    )
    .mutation(({ input }) => {
      const { id, cardNumber, ...data } = input;
      return db.updateCreditCard(id, {
        ...data,
        creditLimit: data.creditLimit,
        ...(cardNumber !== undefined ? { cardNumber } : {}),
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => {
      return db.deleteCreditCard(input.id);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => {
      return db.getCreditCardById(input.id);
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
    .mutation(({ ctx, input }) => {
      return db.createTransaction({
        userId: ctx.user.id,
        categoryId: input.categoryId,
        type: input.type,
        amount: input.amount,
        description: input.description,
        date: input.date,
        creditCardId: input.creditCardId,
      });
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), ...transactionSchema.shape }))
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return db.updateTransaction(id, data);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => {
      return db.deleteTransaction(input.id);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => {
      return db.getTransactionById(input.id);
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
  transactions: transactionsRouter,
  summary: summaryRouter,
  budgets: budgetsRouter,
  settings: settingsRouter,
  data: dataRouter,
});

export type AppRouter = typeof appRouter;

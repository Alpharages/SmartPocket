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
    .input(z.object({ id: z.number(), ...creditCardSchema.shape }))
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return db.updateCreditCard(id, {
        ...data,
        creditLimit: data.creditLimit,
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
});

export type AppRouter = typeof appRouter;

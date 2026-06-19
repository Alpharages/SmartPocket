import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
} from "drizzle-orm/mysql-core";
import { CATEGORY_DEFAULT_COLOR } from "../shared/theme";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  /** Explicit opt-in for AI features; default off for all users (FR-20, NFR-1). */
  aiEnabled: boolean("aiEnabled").default(false).notNull(),
  /** Opt-in for payment/loan reminder notifications (Epic 7). */
  remindersEnabled: boolean("remindersEnabled").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Categories table for transaction categorization.
 * Supports both predefined and custom categories.
 */
export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  type: mysqlEnum("type", ["income", "expense"]).notNull(),
  color: varchar("color", { length: 7 })
    .default(CATEGORY_DEFAULT_COLOR)
    .notNull(), // Hex color
  icon: varchar("icon", { length: 50 }).default("pricetag-outline").notNull(),
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;

/**
 * Credit cards table for managing user's credit cards.
 */
export const creditCards = mysqlTable("creditCards", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  cardNumber: varchar("cardNumber", { length: 255 }).notNull(), // Encrypted
  cardholderName: varchar("cardholderName", { length: 100 }).notNull(),
  expiryMonth: int("expiryMonth").notNull(),
  expiryYear: int("expiryYear").notNull(),
  creditLimit: decimal("creditLimit", { precision: 12, scale: 2 }).notNull(),
  currentBalance: decimal("currentBalance", { precision: 12, scale: 2 })
    .default("0")
    .notNull(),
  color: varchar("color", { length: 7 })
    .default(CATEGORY_DEFAULT_COLOR)
    .notNull(),
  cardType: varchar("cardType", { length: 50 }).default("credit").notNull(), // credit, debit, etc.
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CreditCard = typeof creditCards.$inferSelect;
export type InsertCreditCard = typeof creditCards.$inferInsert;

/**
 * Accounts table for tracking cash, bank, and wallet balances per user.
 */
export const accounts = mysqlTable("accounts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  type: mysqlEnum("type", ["cash", "bank", "wallet"]).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Account = typeof accounts.$inferSelect;
export type InsertAccount = typeof accounts.$inferInsert;

/**
 * Transfers table for moving money between accounts without affecting income/expense summaries.
 */
export const transfers = mysqlTable("transfers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  fromAccountId: int("fromAccountId").notNull(),
  toAccountId: int("toAccountId").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  date: timestamp("date").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Transfer = typeof transfers.$inferSelect;
export type InsertTransfer = typeof transfers.$inferInsert;

/**
 * Transactions table for logging income and expenses.
 */
export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  categoryId: int("categoryId").notNull(),
  creditCardId: int("creditCardId"), // Optional: link to credit card
  accountId: int("accountId"), // Optional: link to account
  type: mysqlEnum("type", ["income", "expense"]).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  date: timestamp("date").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

/**
 * Recurring transactions table for scheduled transaction generation.
 */
export const recurringTransactions = mysqlTable("recurringTransactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  categoryId: int("categoryId").notNull(),
  creditCardId: int("creditCardId"),
  type: mysqlEnum("type", ["income", "expense"]).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  frequency: mysqlEnum("frequency", [
    "daily",
    "weekly",
    "monthly",
    "yearly",
  ]).notNull(),
  interval: int("interval").notNull().default(1),
  endCondition: mysqlEnum("endCondition", [
    "count",
    "endDate",
    "never",
  ]).notNull(),
  occurrenceCount: int("occurrenceCount"),
  endDate: timestamp("endDate"),
  startDate: timestamp("startDate").notNull(),
  nextRunDate: timestamp("nextRunDate").notNull(),
  lastRunDate: timestamp("lastRunDate"),
  generatedCount: int("generatedCount").notNull().default(0),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RecurringTransaction = typeof recurringTransactions.$inferSelect;
export type InsertRecurringTransaction =
  typeof recurringTransactions.$inferInsert;

/**
 * Budgets table: per-category spending caps for a period.
 * Progress (spent vs. limit) is computed at read-time in Story 6.3 — not stored here.
 */
export const budgets = mysqlTable("budgets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  categoryId: int("categoryId").notNull(),
  period: mysqlEnum("period", ["monthly", "weekly"]).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Budget = typeof budgets.$inferSelect;
export type InsertBudget = typeof budgets.$inferInsert;

/**
 * Monthly summaries table for caching monthly statistics.
 * Helps optimize dashboard and summary queries.
 */
export const monthlySummaries = mysqlTable("monthlySummaries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  year: int("year").notNull(),
  month: int("month").notNull(), // 1-12
  totalIncome: decimal("totalIncome", { precision: 12, scale: 2 })
    .default("0")
    .notNull(),
  totalExpense: decimal("totalExpense", { precision: 12, scale: 2 })
    .default("0")
    .notNull(),
  netBalance: decimal("netBalance", { precision: 12, scale: 2 })
    .default("0")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MonthlySummary = typeof monthlySummaries.$inferSelect;
export type InsertMonthlySummary = typeof monthlySummaries.$inferInsert;

/**
 * Loans table for tracking money lent to or borrowed from others.
 */
export const loans = mysqlTable("loans", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  direction: mysqlEnum("direction", ["lend", "borrow"]).notNull(),
  counterparty: varchar("counterparty", { length: 100 }),
  principal: decimal("principal", { precision: 12, scale: 2 }).notNull(),
  rate: decimal("rate", { precision: 5, scale: 2 }),
  periodicity: mysqlEnum("periodicity", [
    "weekly",
    "monthly",
    "yearly",
    "none",
  ]).notNull(),
  installmentCount: int("installmentCount"),
  endDate: timestamp("endDate"),
  nextDueDate: timestamp("nextDueDate"),
  status: mysqlEnum("status", ["active", "settled"]).default("active").notNull(),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Loan = typeof loans.$inferSelect;
export type InsertLoan = typeof loans.$inferInsert;

/**
 * Repayments table for logging payments against a loan.
 */
export const repayments = mysqlTable("repayments", {
  id: int("id").autoincrement().primaryKey(),
  loanId: int("loanId").notNull(),
  userId: int("userId").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  date: timestamp("date").notNull(),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Repayment = typeof repayments.$inferSelect;
export type InsertRepayment = typeof repayments.$inferInsert;

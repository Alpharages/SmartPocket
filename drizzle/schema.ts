import {
  bigint,
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
import { ULID_LENGTH, ulid } from "../shared/ulid";

/**
 * Every primary key here is a client-generated ULID, not a database
 * autoincrement. Multi-device sync is what forces this: two phones editing
 * offline would both be handed `id = 5` by their local SQLite and one would
 * silently overwrite the other on push. The client mints the id, so the id is
 * already globally unique before it ever reaches a server.
 *
 * The three sync columns on every data table below exist for the same reason:
 *
 * - `deletedAt` — a tombstone. Without one, a delete made offline cannot
 *   propagate: the sync sees "row absent locally" and cannot tell *deleted*
 *   from *not yet pulled*. Rows are soft-deleted and only purged once the
 *   delete has been acknowledged and the retention window has passed.
 * - `dirty` — set by every local write, cleared by a successful push. This is
 *   a flag rather than a timestamp comparison because it is clock-independent,
 *   and it gives "push the backlog when sync is re-enabled" for free: anything
 *   written while sync was off is simply still dirty. No outbox table needed.
 * - `serverSeq` — a server-assigned monotonic sequence. The client pulls
 *   everything above its `lastPulledSeq`. Deliberately *not* wall-clock paging:
 *   device clocks drift, and a phone with a wrong clock would silently skip or
 *   re-fetch records.
 *
 * `users` carries none of the three — an account row is not a synced record,
 * it is the thing records belong to.
 */

/** A ULID primary key. Aliased so id parameters read differently from counts. */
export type Id = string;

/**
 * Tables the sync worker walks, in foreign-key order.
 *
 * Order matters on the pull side: applying a transaction before the category it
 * references would leave a dangling reference for as long as the batch takes.
 */
export const SYNC_TABLES = [
  "categories",
  "creditCards",
  "accounts",
  "loans",
  "budgets",
  "monthlySummaries",
  "transactions",
  "transfers",
  "recurringTransactions",
  "repayments",
] as const;

export type SyncTable = (typeof SYNC_TABLES)[number];

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key — a client-generated ULID, not a database
   * autoincrement. Use this for relations between tables.
   */
  id: varchar("id", { length: ULID_LENGTH })
    .primaryKey()
    .$defaultFn(() => ulid()),
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
  /**
   * Salted hash of the account-linked App Lock PIN (Epic 13, Story 13.6).
   * Format: `scrypt:v1:<saltB64>:<hashB64>`. Null when no PIN is synced
   * server-side. Never a reversible ciphertext — the server cannot recover
   * the PIN from this value.
   */
  pinHash: varchar("pinHash", { length: 255 }),
  /** Consecutive failed server-side PIN verification attempts since the last success or reset. */
  pinFailedAttempts: int("pinFailedAttempts").default(0).notNull(),
  /** Set once pinFailedAttempts crosses the lockout threshold; verifyPin rejects until this passes. */
  pinLockedUntil: timestamp("pinLockedUntil"),
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
  id: varchar("id", { length: ULID_LENGTH })
    .primaryKey()
    .$defaultFn(() => ulid()),
  userId: varchar("userId", { length: ULID_LENGTH }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  type: mysqlEnum("type", ["income", "expense"]).notNull(),
  color: varchar("color", { length: 7 })
    .default(CATEGORY_DEFAULT_COLOR)
    .notNull(), // Hex color
  icon: varchar("icon", { length: 50 }).default("pricetag-outline").notNull(),
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp("deletedAt"),
  dirty: boolean("dirty").default(true).notNull(),
  serverSeq: bigint("serverSeq", { mode: "number" }),
});

export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;

/**
 * Credit cards table for managing user's credit cards.
 */
export const creditCards = mysqlTable("creditCards", {
  id: varchar("id", { length: ULID_LENGTH })
    .primaryKey()
    .$defaultFn(() => ulid()),
  userId: varchar("userId", { length: ULID_LENGTH }).notNull(),
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
  deletedAt: timestamp("deletedAt"),
  dirty: boolean("dirty").default(true).notNull(),
  serverSeq: bigint("serverSeq", { mode: "number" }),
});

export type CreditCard = typeof creditCards.$inferSelect;
export type InsertCreditCard = typeof creditCards.$inferInsert;

/**
 * Accounts table for tracking cash, bank, and wallet balances per user.
 */
export const accounts = mysqlTable("accounts", {
  id: varchar("id", { length: ULID_LENGTH })
    .primaryKey()
    .$defaultFn(() => ulid()),
  userId: varchar("userId", { length: ULID_LENGTH }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  type: mysqlEnum("type", ["cash", "bank", "wallet"]).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp("deletedAt"),
  dirty: boolean("dirty").default(true).notNull(),
  serverSeq: bigint("serverSeq", { mode: "number" }),
});

export type Account = typeof accounts.$inferSelect;
export type InsertAccount = typeof accounts.$inferInsert;

/**
 * Transfers table for moving money between accounts without affecting income/expense summaries.
 */
export const transfers = mysqlTable("transfers", {
  id: varchar("id", { length: ULID_LENGTH })
    .primaryKey()
    .$defaultFn(() => ulid()),
  userId: varchar("userId", { length: ULID_LENGTH }).notNull(),
  fromAccountId: varchar("fromAccountId", { length: ULID_LENGTH }).notNull(),
  toAccountId: varchar("toAccountId", { length: ULID_LENGTH }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  date: timestamp("date").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp("deletedAt"),
  dirty: boolean("dirty").default(true).notNull(),
  serverSeq: bigint("serverSeq", { mode: "number" }),
});

export type Transfer = typeof transfers.$inferSelect;
export type InsertTransfer = typeof transfers.$inferInsert;

/**
 * Transactions table for logging income and expenses.
 */
export const transactions = mysqlTable("transactions", {
  id: varchar("id", { length: ULID_LENGTH })
    .primaryKey()
    .$defaultFn(() => ulid()),
  userId: varchar("userId", { length: ULID_LENGTH }).notNull(),
  categoryId: varchar("categoryId", { length: ULID_LENGTH }).notNull(),
  creditCardId: varchar("creditCardId", { length: ULID_LENGTH }), // Optional: link to credit card
  accountId: varchar("accountId", { length: ULID_LENGTH }), // Optional: link to account
  type: mysqlEnum("type", ["income", "expense"]).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  date: timestamp("date").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp("deletedAt"),
  dirty: boolean("dirty").default(true).notNull(),
  serverSeq: bigint("serverSeq", { mode: "number" }),
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

/**
 * Recurring transactions table for scheduled transaction generation.
 */
export const recurringTransactions = mysqlTable("recurringTransactions", {
  id: varchar("id", { length: ULID_LENGTH })
    .primaryKey()
    .$defaultFn(() => ulid()),
  userId: varchar("userId", { length: ULID_LENGTH }).notNull(),
  categoryId: varchar("categoryId", { length: ULID_LENGTH }).notNull(),
  creditCardId: varchar("creditCardId", { length: ULID_LENGTH }),
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
  deletedAt: timestamp("deletedAt"),
  dirty: boolean("dirty").default(true).notNull(),
  serverSeq: bigint("serverSeq", { mode: "number" }),
});

export type RecurringTransaction = typeof recurringTransactions.$inferSelect;
export type InsertRecurringTransaction =
  typeof recurringTransactions.$inferInsert;

/**
 * Budgets table: per-category spending caps for a period.
 * Progress (spent vs. limit) is computed at read-time in Story 6.3 — not stored here.
 */
export const budgets = mysqlTable("budgets", {
  id: varchar("id", { length: ULID_LENGTH })
    .primaryKey()
    .$defaultFn(() => ulid()),
  userId: varchar("userId", { length: ULID_LENGTH }).notNull(),
  categoryId: varchar("categoryId", { length: ULID_LENGTH }).notNull(),
  period: mysqlEnum("period", ["monthly", "weekly"]).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp("deletedAt"),
  dirty: boolean("dirty").default(true).notNull(),
  serverSeq: bigint("serverSeq", { mode: "number" }),
});

export type Budget = typeof budgets.$inferSelect;
export type InsertBudget = typeof budgets.$inferInsert;

/**
 * Monthly summaries table for caching monthly statistics.
 * Helps optimize dashboard and summary queries.
 */
export const monthlySummaries = mysqlTable("monthlySummaries", {
  id: varchar("id", { length: ULID_LENGTH })
    .primaryKey()
    .$defaultFn(() => ulid()),
  userId: varchar("userId", { length: ULID_LENGTH }).notNull(),
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
  deletedAt: timestamp("deletedAt"),
  dirty: boolean("dirty").default(true).notNull(),
  serverSeq: bigint("serverSeq", { mode: "number" }),
});

export type MonthlySummary = typeof monthlySummaries.$inferSelect;
export type InsertMonthlySummary = typeof monthlySummaries.$inferInsert;

/**
 * Loans table for tracking money lent to or borrowed from others.
 */
export const loans = mysqlTable("loans", {
  id: varchar("id", { length: ULID_LENGTH })
    .primaryKey()
    .$defaultFn(() => ulid()),
  userId: varchar("userId", { length: ULID_LENGTH }).notNull(),
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
  status: mysqlEnum("status", ["active", "settled"])
    .default("active")
    .notNull(),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp("deletedAt"),
  dirty: boolean("dirty").default(true).notNull(),
  serverSeq: bigint("serverSeq", { mode: "number" }),
});

export type Loan = typeof loans.$inferSelect;
export type InsertLoan = typeof loans.$inferInsert;

/**
 * Repayments table for logging payments against a loan.
 */
export const repayments = mysqlTable("repayments", {
  id: varchar("id", { length: ULID_LENGTH })
    .primaryKey()
    .$defaultFn(() => ulid()),
  loanId: varchar("loanId", { length: ULID_LENGTH }).notNull(),
  userId: varchar("userId", { length: ULID_LENGTH }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  date: timestamp("date").notNull(),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp("deletedAt"),
  dirty: boolean("dirty").default(true).notNull(),
  serverSeq: bigint("serverSeq", { mode: "number" }),
});

export type Repayment = typeof repayments.$inferSelect;
export type InsertRepayment = typeof repayments.$inferInsert;

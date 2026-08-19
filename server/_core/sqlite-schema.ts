/**
 * The on-device SQLite schema — the same 11 tables as `drizzle/schema.ts`,
 * translated to SQLite DDL. This is hand-written rather than drizzle-kit
 * generated: drizzle-kit's SQLite dialect targets `drizzle-orm/sqlite-core`
 * table definitions, and duplicating the whole schema in a second dialect
 * would mean every future column change has to be made twice and kept in
 * sync by hand anyway. Since `server/db.ts` talks to the database entirely
 * through hand-written SQL strings (not the drizzle query builder), the two
 * schemas only need to agree on table/column names and be close enough in
 * type semantics for the same query text to run against either — this file
 * is that second, minimal declaration.
 *
 * Every column name, nullability and default here must match
 * `drizzle/schema.ts` exactly; there is no automated check tying the two
 * together, so a schema change on one side needs the same change made here.
 *
 * Type mapping notes:
 * - `varchar`/`text`/`mysqlEnum` → `TEXT`. SQLite has no enum type; the
 *   application already validates enum values with Zod before they reach
 *   `server/db.ts`, so a CHECK constraint would only duplicate that.
 * - `int`/`bigint` → `INTEGER`.
 * - `boolean` → `INTEGER` storing 0/1, matching what `mysql2` already returns
 *   for MySQL's `tinyint(1)` boolean columns — no read-side conversion is
 *   needed for either backend to agree.
 * - `decimal` → `TEXT`. Money is already handled as decimal strings
 *   throughout the app (`shared/money.ts`); storing it as SQLite `REAL` would
 *   introduce floating-point error this codebase has deliberately avoided.
 * - `timestamp` → `TEXT`, storing an ISO 8601 string. `server/_core/
 *   sqlite-engine.ts` converts a bound `Date` to this format on write and
 *   back to a `Date` on read, so `server/db.ts` sees the same `Date`
 *   instances it would from `mysql2` regardless of which engine is live.
 */

/**
 * PRAGMA user_version-driven migrations. Each entry is a full DDL script run
 * exactly once, in order, against a fresh or existing database — index 0 runs
 * to take a brand-new database from user_version 0 to 1, and so on. Append
 * new migrations here; never edit an entry that has already shipped.
 */
export const SQLITE_MIGRATIONS: readonly string[] = [
  `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      openId TEXT NOT NULL UNIQUE,
      name TEXT,
      email TEXT,
      loginMethod TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      aiEnabled INTEGER NOT NULL DEFAULT 0,
      remindersEnabled INTEGER NOT NULL DEFAULT 0,
      pinHash TEXT,
      pinFailedAttempts INTEGER NOT NULL DEFAULT 0,
      pinLockedUntil TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      lastSignedIn TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      color TEXT NOT NULL,
      icon TEXT NOT NULL,
      isDefault INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      deletedAt TEXT,
      dirty INTEGER NOT NULL DEFAULT 1,
      serverSeq INTEGER
    );
    CREATE INDEX IF NOT EXISTS categories_userId_idx ON categories (userId);

    CREATE TABLE IF NOT EXISTS creditCards (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      name TEXT NOT NULL,
      cardNumber TEXT NOT NULL,
      cardholderName TEXT NOT NULL,
      expiryMonth INTEGER NOT NULL,
      expiryYear INTEGER NOT NULL,
      creditLimit TEXT NOT NULL,
      currentBalance TEXT NOT NULL DEFAULT '0',
      color TEXT NOT NULL,
      cardType TEXT NOT NULL DEFAULT 'credit',
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      deletedAt TEXT,
      dirty INTEGER NOT NULL DEFAULT 1,
      serverSeq INTEGER
    );
    CREATE INDEX IF NOT EXISTS creditCards_userId_idx ON creditCards (userId);

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      isDefault INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      deletedAt TEXT,
      dirty INTEGER NOT NULL DEFAULT 1,
      serverSeq INTEGER
    );
    CREATE INDEX IF NOT EXISTS accounts_userId_idx ON accounts (userId);

    CREATE TABLE IF NOT EXISTS transfers (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      fromAccountId TEXT NOT NULL,
      toAccountId TEXT NOT NULL,
      amount TEXT NOT NULL,
      description TEXT,
      date TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      deletedAt TEXT,
      dirty INTEGER NOT NULL DEFAULT 1,
      serverSeq INTEGER
    );
    CREATE INDEX IF NOT EXISTS transfers_userId_idx ON transfers (userId);

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      categoryId TEXT NOT NULL,
      creditCardId TEXT,
      accountId TEXT,
      type TEXT NOT NULL,
      amount TEXT NOT NULL,
      description TEXT,
      date TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      deletedAt TEXT,
      dirty INTEGER NOT NULL DEFAULT 1,
      serverSeq INTEGER
    );
    CREATE INDEX IF NOT EXISTS transactions_userId_idx ON transactions (userId);
    CREATE INDEX IF NOT EXISTS transactions_categoryId_idx ON transactions (categoryId);
    CREATE INDEX IF NOT EXISTS transactions_creditCardId_idx ON transactions (creditCardId);
    CREATE INDEX IF NOT EXISTS transactions_accountId_idx ON transactions (accountId);
    CREATE INDEX IF NOT EXISTS transactions_date_idx ON transactions (date);

    CREATE TABLE IF NOT EXISTS recurringTransactions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      categoryId TEXT NOT NULL,
      creditCardId TEXT,
      type TEXT NOT NULL,
      amount TEXT NOT NULL,
      description TEXT,
      frequency TEXT NOT NULL,
      \`interval\` INTEGER NOT NULL DEFAULT 1,
      endCondition TEXT NOT NULL,
      occurrenceCount INTEGER,
      endDate TEXT,
      startDate TEXT NOT NULL,
      nextRunDate TEXT NOT NULL,
      lastRunDate TEXT,
      generatedCount INTEGER NOT NULL DEFAULT 0,
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      deletedAt TEXT,
      dirty INTEGER NOT NULL DEFAULT 1,
      serverSeq INTEGER
    );
    CREATE INDEX IF NOT EXISTS recurringTransactions_userId_idx ON recurringTransactions (userId);
    CREATE INDEX IF NOT EXISTS recurringTransactions_nextRunDate_idx ON recurringTransactions (nextRunDate);

    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      categoryId TEXT NOT NULL,
      period TEXT NOT NULL,
      amount TEXT NOT NULL,
      startDate TEXT,
      endDate TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      deletedAt TEXT,
      dirty INTEGER NOT NULL DEFAULT 1,
      serverSeq INTEGER
    );
    CREATE INDEX IF NOT EXISTS budgets_userId_idx ON budgets (userId);

    CREATE TABLE IF NOT EXISTS monthlySummaries (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      totalIncome TEXT NOT NULL DEFAULT '0',
      totalExpense TEXT NOT NULL DEFAULT '0',
      netBalance TEXT NOT NULL DEFAULT '0',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      deletedAt TEXT,
      dirty INTEGER NOT NULL DEFAULT 1,
      serverSeq INTEGER
    );
    CREATE INDEX IF NOT EXISTS monthlySummaries_userId_idx ON monthlySummaries (userId);

    CREATE TABLE IF NOT EXISTS loans (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      direction TEXT NOT NULL,
      counterparty TEXT,
      principal TEXT NOT NULL,
      rate TEXT,
      periodicity TEXT NOT NULL,
      installmentCount INTEGER,
      endDate TEXT,
      nextDueDate TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      note TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      deletedAt TEXT,
      dirty INTEGER NOT NULL DEFAULT 1,
      serverSeq INTEGER
    );
    CREATE INDEX IF NOT EXISTS loans_userId_idx ON loans (userId);

    CREATE TABLE IF NOT EXISTS repayments (
      id TEXT PRIMARY KEY,
      loanId TEXT NOT NULL,
      userId TEXT NOT NULL,
      amount TEXT NOT NULL,
      date TEXT NOT NULL,
      note TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      deletedAt TEXT,
      dirty INTEGER NOT NULL DEFAULT 1,
      serverSeq INTEGER
    );
    CREATE INDEX IF NOT EXISTS repayments_loanId_idx ON repayments (loanId);
    CREATE INDEX IF NOT EXISTS repayments_userId_idx ON repayments (userId);
  `,
  // Migration 2 — mirrors drizzle/0015_user_card_key.sql. Appended as its own
  // entry rather than edited into migration 0: the runner only applies scripts
  // at or above the database's current `user_version`, so a device that has
  // already installed migration 0 would never see a column added to it.
  //
  // The device does not read this column — `crypto.native.ts` holds the
  // account's card key in expo-secure-store (the OS keychain), not in the
  // database. It exists so a row read locally has the same shape as the same
  // row read on the server.
  `
    ALTER TABLE users ADD COLUMN cardKey TEXT;
  `,
];

/**
 * Column names stored as ISO 8601 text that must round-trip through JS `Date`
 * on read, matching what `mysql2` returns for a MySQL `timestamp` column.
 * Shared by every table — a name appearing in any table means "this is a
 * date" everywhere it appears, which holds across all 11 tables here.
 *
 * Deliberately a second, independently-maintained list rather than a shared
 * import from `server/_core/devDb.ts`'s equivalent set: the two are
 * unrelated fakes (one simulates MySQL for local dev with no database, this
 * one drives a real SQLite engine for the shipped offline app) and coupling
 * them would make an unrelated change to one a silent risk to the other.
 */
export const SQLITE_DATE_COLUMNS: ReadonlySet<string> = new Set([
  "createdAt",
  "updatedAt",
  "deletedAt",
  "lastSignedIn",
  "pinLockedUntil",
  "date",
  "startDate",
  "endDate",
  "nextDueDate",
  "nextRunDate",
  "lastRunDate",
]);

/**
 * Tables whose `INSERT ... ON DUPLICATE KEY UPDATE` targets a UNIQUE column
 * other than the primary key — MySQL upsert syntax resolves the conflict
 * implicitly by whichever constraint collides, but SQLite's
 * `ON CONFLICT (...) DO UPDATE` must name the column. `users` is keyed on
 * `openId` (OAuth sign-in must not create a duplicate row for a returning
 * user); every synced table (local-first-sync-plan.md phase 4's
 * server/_core/sync-engine.ts, applyIncomingRow) upserts by `id` — the row
 * either already exists locally with that primary key or it doesn't.
 */
export const UPSERT_CONFLICT_COLUMN: Readonly<Record<string, string>> = {
  users: "openId",
  categories: "id",
  creditCards: "id",
  accounts: "id",
  loans: "id",
  budgets: "id",
  monthlySummaries: "id",
  transactions: "id",
  transfers: "id",
  recurringTransactions: "id",
  repayments: "id",
};

/**
 * Columns MySQL fills in with `DEFAULT (CURRENT_TIMESTAMP)` /
 * `ON UPDATE CURRENT_TIMESTAMP` when a raw `INSERT` doesn't list them — every
 * `create*` function in `server/db.ts` omits `createdAt`/`updatedAt` from its
 * column list for exactly this reason, and `upsertUser` omits `lastSignedIn`
 * too when the caller didn't pass one. SQLite has no equivalent column
 * attribute, so `sqlite-engine.ts` fills these in itself at insert time
 * (`injectMissingTimestamps`) rather than requiring every call site in
 * `server/db.ts` to start passing them explicitly — the whole point of the
 * `dataApi.native.ts` seam is that `server/db.ts` doesn't change per backend.
 *
 * This only covers the INSERT-time defaults. The `ON UPDATE CURRENT_TIMESTAMP`
 * half is already handled for every synced table by the explicit
 * `updatedAt = ?, dirty = 1` (`TOUCH_SET`) appended to every write in
 * `server/db.ts` — that was added in the same migration that added the sync
 * columns, specifically because SQLite has no such column attribute either.
 * `users` is not a synced table and has no `TOUCH_SET` equivalent, so a plain
 * `UPDATE users SET pinHash = ?` will not bump `users.updatedAt` under
 * SQLite the way MySQL's `ON UPDATE CURRENT_TIMESTAMP` silently would.
 * Accepted: nothing in this codebase reads `users.updatedAt` for anything —
 * it is an audit timestamp, not a value any control flow branches on.
 */
export const DEFAULT_NOW_COLUMNS: Readonly<Record<string, readonly string[]>> =
  {
    users: ["createdAt", "updatedAt", "lastSignedIn"],
    categories: ["createdAt", "updatedAt"],
    creditCards: ["createdAt", "updatedAt"],
    accounts: ["createdAt", "updatedAt"],
    transfers: ["createdAt", "updatedAt"],
    transactions: ["createdAt", "updatedAt"],
    recurringTransactions: ["createdAt", "updatedAt"],
    budgets: ["createdAt", "updatedAt"],
    monthlySummaries: ["createdAt", "updatedAt"],
    loans: ["createdAt", "updatedAt"],
    repayments: ["createdAt", "updatedAt"],
  };

import { resolveNextDueDateAfterRepayment } from "../lib/loan-schedule";
import {
  applyTransferLegs,
  reduceAccountBalances,
} from "@/lib/account-balances";
import { dbQuery } from "./_core/db-query";
import { ulid } from "@shared/ulid";
import {
  decryptCardNumber,
  encryptCardNumber,
  maskCardNumber,
} from "./_core/crypto";
import { DEFAULT_CATEGORIES } from "./_core/default-categories";
import {
  CATEGORY_DEFAULT_COLOR,
  DEFAULT_CATEGORY_ICON,
  getCategoryColorForName,
} from "@shared/theme";
import {
  categories,
  creditCards,
  transactions,
  recurringTransactions,
  monthlySummaries,
  users,
  InsertCategory,
  InsertCreditCard,
  InsertTransaction,
  InsertBudget,
  InsertRecurringTransaction,
  InsertMonthlySummary,
  InsertLoan,
  InsertRepayment,
  Category,
  CreditCard,
  Transaction,
  Budget,
  MonthlySummary,
  User,
  RecurringTransaction,
  Loan,
  Repayment,
  Account,
  InsertAccount,
  Transfer,
  InsertTransfer,
  Id,
} from "@/drizzle/schema";

/**
 * Get database connection.
 */
async function getDb() {
  try {
    const result = await dbQuery("SELECT 1");
    return result ? true : null;
  } catch {
    return null;
  }
}

// ============================================================================
// USERS
// ============================================================================

export async function getUserByOpenId(openId: string) {
  const result = await dbQuery("SELECT * FROM users WHERE openId = ?", [
    openId,
  ]);
  return result && Array.isArray(result) ? result[0] : null;
}

/**
 * Looks an account up by its login identity.
 *
 * Lowercased before the lookup, and stored lowercased by `createPasswordUser`,
 * so "Ali@x.com" and "ali@x.com" are one account rather than two — a unique
 * index alone would happily let both exist and leave the user unable to work
 * out which one holds their data.
 */
export async function getUserByEmail(email: string) {
  const result = await dbQuery("SELECT * FROM users WHERE email = ?", [
    email.trim().toLowerCase(),
  ]);
  return result && Array.isArray(result) ? result[0] : null;
}

/**
 * Creates an email+password account.
 *
 * A plain INSERT, not the `upsertUser` path: an ON DUPLICATE KEY UPDATE here
 * would silently overwrite an existing account's password when someone
 * re-registers a taken address. The duplicate-key error is the point — it is
 * what tells the caller the address is taken, atomically, with no
 * check-then-insert race in between.
 *
 * `openId` is a fresh ULID rather than the email so a later address change
 * never invalidates issued sessions (see drizzle/schema.ts).
 */
export async function createPasswordUser(data: {
  email: string;
  passwordHash: string;
  name?: string | null;
}): Promise<Id> {
  const id = ulid();
  // Every value is a parameter — no `'password'` or `NOW()` literals in the
  // statement. The dev database (server/_core/devDb.ts) maps columns onto
  // params positionally and does not evaluate SQL expressions, so a literal
  // silently lands as NULL there while working fine against real MySQL. That
  // is a difference the dev environment should not have.
  await dbQuery(
    `
        INSERT INTO users (id, openId, email, passwordHash, name, loginMethod, lastSignedIn)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    [
      id,
      ulid(),
      data.email.trim().toLowerCase(),
      data.passwordHash,
      data.name ?? null,
      "password",
      new Date(),
    ],
  );
  return id;
}

/** Stamps a successful sign-in. Best-effort: a failed write must not fail the login. */
export async function touchLastSignedIn(id: Id): Promise<void> {
  await dbQuery("UPDATE users SET lastSignedIn = NOW() WHERE id = ?", [id]);
}

/**
 * Re-points the device's local user row at the signed-in account's id.
 *
 * local-first-sync-plan.md's "signing in later *associates* that local user
 * with the account": `reownLocalData` rewrites every data row's `userId`
 * from the synthetic local id to the account's, but the row in `users` that
 * the in-process tRPC context resolves to (server/_core/local-context.ts)
 * still carried the old id — so after a first sync the app looked up its own
 * data under an id nothing owned any more and every screen went blank.
 * Moving the identity keeps `getUserByOpenId(localOpenId)` returning the
 * same row, now answering with the account's id, which is also the id every
 * pulled row arrives owned by.
 *
 * Local (SQLite) only: the device's `users` table holds exactly one row —
 * `users` is not in SYNC_TABLES, so nothing ever inserts a second one — and
 * the server's own `users` table is never touched by this path.
 */
export async function reassignUserId(fromId: Id, toId: Id) {
  await dbQuery("UPDATE users SET id = ? WHERE id = ?", [toId, fromId]);
}

export async function upsertUser(data: {
  openId: string;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  lastSignedIn?: Date;
}) {
  // This is a raw INSERT, not a drizzle-builder one — the schema's
  // `.$defaultFn(() => ulid())` on `users.id` only fires through drizzle's
  // query builder, never for a hand-written statement like this one. `id` is
  // minted here and included in the column list so a first-time signup gets a
  // real id; it is deliberately excluded from the ON DUPLICATE KEY UPDATE
  // clause below so a returning user's existing id is never overwritten.
  const fields = [
    ["id", ulid()],
    ["openId", data.openId],
    ["name", data.name],
    ["email", data.email],
    ["loginMethod", data.loginMethod],
    ["lastSignedIn", data.lastSignedIn],
  ].filter(([, value]) => value !== undefined) as [string, unknown][];
  const columns = fields.map(([column]) => column);
  const values = fields.map(([, value]) => value);
  const updates = columns
    .filter((column) => column !== "openId" && column !== "id")
    .map((column) => `${column} = VALUES(${column})`);

  await dbQuery(
    `
        INSERT INTO users (${columns.join(", ")})
        VALUES (${columns.map(() => "?").join(", ")})
        ON DUPLICATE KEY UPDATE
          ${updates.length > 0 ? updates.join(", ") : "openId = openId"}
      `,
    values,
  );
}

/**
 * Appended to the SET clause of every write against a synced table.
 *
 * `updatedAt` is stamped explicitly rather than left to MySQL's
 * `ON UPDATE CURRENT_TIMESTAMP`, because these same statements now run against
 * the on-device SQLite, which has no such column attribute — and because
 * last-write-wins conflict resolution is only as trustworthy as the timestamp
 * it compares. `dirty = 1` marks the row as not yet pushed; the sync worker is
 * the only thing that clears it.
 */
const TOUCH_SET = "updatedAt = ?, dirty = 1";

/**
 * Soft delete. A hard `DELETE` cannot propagate to another device: the sync
 * would see "row absent locally" and be unable to tell a deletion from a row
 * it has simply never pulled. The tombstone is what carries the intent.
 */
const TOMBSTONE_SET = "deletedAt = ?, updatedAt = ?, dirty = 1";

/** Timestamp shared by every column a single write stamps, so they cannot disagree. */
function writeStamp(): Date {
  return new Date();
}

/** Coerce MySQL tinyint (0/1) or boolean — never use Boolean() (string "0" is truthy). */
function coerceDbBoolean(value: unknown): boolean {
  return value === 1 || value === true;
}

export async function getUserSettings(
  userId: Id,
): Promise<{ aiEnabled: boolean; remindersEnabled: boolean }> {
  const result = await dbQuery(
    "SELECT aiEnabled, remindersEnabled FROM users WHERE id = ?",
    [userId],
  );

  const row = result && Array.isArray(result) ? result[0] : null;
  if (!row) {
    return { aiEnabled: false, remindersEnabled: false };
  }

  return {
    aiEnabled: coerceDbBoolean(row.aiEnabled),
    remindersEnabled: coerceDbBoolean(row.remindersEnabled),
  };
}

export async function updateAiEnabled(
  userId: Id,
  enabled: boolean,
): Promise<void> {
  await dbQuery("UPDATE users SET aiEnabled = ? WHERE id = ?", [
    enabled,
    userId,
  ]);
}

// ============================================================================
// SECURITY — account-linked PIN (Epic 13, Story 13.6)
// ============================================================================

export interface UserPinState {
  pinHash: string | null;
  pinFailedAttempts: number;
  pinLockedUntil: Date | null;
}

export async function getUserPinState(userId: Id): Promise<UserPinState> {
  const result = await dbQuery(
    "SELECT pinHash, pinFailedAttempts, pinLockedUntil FROM users WHERE id = ?",
    [userId],
  );
  const row = Array.isArray(result)
    ? (result[0] as Record<string, unknown>)
    : null;
  if (!row) {
    return { pinHash: null, pinFailedAttempts: 0, pinLockedUntil: null };
  }
  return {
    pinHash: (row.pinHash as string | null) ?? null,
    pinFailedAttempts: Number(row.pinFailedAttempts ?? 0),
    pinLockedUntil: row.pinLockedUntil
      ? new Date(row.pinLockedUntil as string)
      : null,
  };
}

/** Stores the salted hash and resets attempt/lockout state — a fresh PIN starts with a clean slate. */
export async function setUserPin(userId: Id, pinHash: string): Promise<void> {
  await dbQuery(
    "UPDATE users SET pinHash = ?, pinFailedAttempts = ?, pinLockedUntil = ? WHERE id = ?",
    [pinHash, 0, null, userId],
  );
}

export async function clearUserPin(userId: Id): Promise<void> {
  await dbQuery(
    "UPDATE users SET pinHash = ?, pinFailedAttempts = ?, pinLockedUntil = ? WHERE id = ?",
    [null, 0, null, userId],
  );
}

/** Clears failed-attempt/lockout state without touching the hash — used after a successful verify. */
export async function resetPinAttempts(userId: Id): Promise<void> {
  await dbQuery(
    "UPDATE users SET pinFailedAttempts = ?, pinLockedUntil = ? WHERE id = ?",
    [0, null, userId],
  );
}

/**
 * Idempotent, atomic: clears attempt state only if the current lockout has
 * already passed. Always safe to call — a no-op when not locked or still
 * locked. Run before evaluating a verify attempt so a stale lockout can't
 * permanently re-trigger on the next failure (round-2 review B2).
 */
export async function resetExpiredPinLockout(
  userId: Id,
  now: Date,
): Promise<void> {
  await dbQuery(
    "UPDATE users SET pinFailedAttempts = ?, pinLockedUntil = ? WHERE id = ? AND pinLockedUntil IS NOT NULL AND pinLockedUntil <= ?",
    [0, null, userId, now],
  );
}

/**
 * Atomically increments the failure counter and locks once the threshold is
 * crossed, in a single guarded UPDATE — not a JS read-then-write. The WHERE
 * clause excludes a row that is already locked (or was locked by a
 * concurrent request between this request's read and this write), and
 * `counted: false` reports that exclusion. Callers that re-read the row
 * afterwards get the account's true lock state either way and don't need it;
 * it is kept because it is the only direct assertion that the WHERE guard —
 * the whole basis of the race-safety below — actually fired. A single-row
 * UPDATE like this is atomic under InnoDB's row-level locking, which is what
 * makes this race-safe under concurrent requests (round-2 review B1).
 *
 * `pinLockedUntil` is assigned BEFORE `pinFailedAttempts` in the SET clause
 * deliberately: MySQL evaluates multi-column UPDATE assignments left to
 * right, and a later assignment sees the already-updated value of an
 * earlier one — not the standard-SQL "all reads see the pre-update row"
 * semantics. Computing the lock decision after the increment would read the
 * post-increment count and trip the lockout one attempt early (round-2
 * review R1). Assigning the lock first means its `IF` reads the original,
 * pre-increment `pinFailedAttempts`.
 */
export async function recordFailedPinAttempt(
  userId: Id,
  data: { maxAttempts: number; lockedUntilIfTripped: Date; now: Date },
): Promise<{ counted: boolean }> {
  const result = await dbQuery(
    "UPDATE users SET pinLockedUntil = IF(pinFailedAttempts + 1 >= ?, ?, NULL), pinFailedAttempts = pinFailedAttempts + 1 WHERE id = ? AND (pinLockedUntil IS NULL OR pinLockedUntil <= ?)",
    [data.maxAttempts, data.lockedUntilIfTripped, userId, data.now],
  );
  const affectedRows =
    result && typeof result === "object" && "affectedRows" in result
      ? (result as { affectedRows: number }).affectedRows
      : 0;
  return { counted: affectedRows > 0 };
}

// ============================================================================
// CATEGORIES
// ============================================================================

/**
 * QA report SP-014: nearly every read here ended `catch { return [] }`, so a
 * database outage, a bad credential or a malformed query was indistinguishable
 * from a genuinely empty account — a user with three years of history was told
 * they had none, and might then re-enter data. Reads now log and rethrow so the
 * tRPC layer surfaces a real error and the client can show a retry instead of
 * an empty state.
 */
function rethrowReadFailure(operation: string, error: unknown): never {
  console.error(`[db] ${operation} failed:`, error);
  throw error instanceof Error ? error : new Error(`${operation} failed`);
}

export async function getUserCategories(
  userId: Id,
  type?: "income" | "expense",
) {
  try {
    const query = type
      ? "SELECT * FROM categories WHERE userId = ? AND type = ? AND deletedAt IS NULL ORDER BY name"
      : "SELECT * FROM categories WHERE userId = ? AND deletedAt IS NULL ORDER BY name";
    const params = type ? [userId, type] : [userId];

    const result = await dbQuery(query, params);
    return Array.isArray(result) ? result : [];
  } catch (error) {
    rethrowReadFailure("getUserCategories", error);
  }
}

export async function createCategory(data: InsertCategory) {
  const id = ulid();
  await dbQuery(
    `
        INSERT INTO categories (id, userId, name, type, color, icon, isDefault)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    [
      id,
      data.userId,
      data.name,
      data.type,
      // Assign a distinct palette token by name when no color is supplied.
      data.color || getCategoryColorForName(data.name),
      data.icon || DEFAULT_CATEGORY_ICON,
      data.isDefault || false,
    ],
  );
  return id;
}

/** Idempotent: seeds DEFAULT_CATEGORIES once per user when they have zero categories. */
export async function seedDefaultCategories(userId: Id): Promise<void> {
  const countResult = await dbQuery(
    "SELECT COUNT(*) as categoryCount FROM categories WHERE userId = ? AND deletedAt IS NULL",
    [userId],
  );

  const row =
    Array.isArray(countResult) && countResult.length > 0
      ? (countResult[0] as Record<string, unknown>)
      : null;
  const existingCount = Number(row?.categoryCount ?? 0);
  if (existingCount > 0) {
    return;
  }

  for (const def of DEFAULT_CATEGORIES) {
    await createCategory({
      userId,
      name: def.name,
      type: def.type,
      color: def.color,
      icon: def.icon,
      isDefault: true,
    });
  }
}

/**
 * Columns a client-supplied patch is allowed to write, per table.
 *
 * The UPDATE builders below interpolate column names into SQL (values stay
 * parameterised). Zod strips unknown keys today, so injection is not reachable
 * through the router — this allowlist is defence in depth so a future
 * `.passthrough()` or a looser input schema cannot turn a patch into column
 * injection. Anything not listed here is dropped.
 */
const UPDATABLE_COLUMNS = {
  categories: ["name", "type", "color", "icon", "isDefault"],
  creditCards: [
    "name",
    "cardNumber",
    "cardholderName",
    "expiryMonth",
    "expiryYear",
    "creditLimit",
    "currentBalance",
    "color",
    "cardType",
    "isActive",
  ],
} as const;

function buildUpdate(
  table: keyof typeof UPDATABLE_COLUMNS,
  data: Record<string, unknown>,
): { clause: string; values: unknown[] } {
  const allowed = UPDATABLE_COLUMNS[table] as readonly string[];
  const entries = Object.entries(data).filter(
    ([key, value]) => allowed.includes(key) && value !== undefined,
  );
  return {
    clause: entries.map(([key]) => `${key} = ?`).join(", "),
    values: entries.map(([, value]) => value),
  };
}

/**
 * All three of these are scoped by `userId`. They were previously keyed on
 * `id` alone, which let any authenticated user read, modify or delete another
 * user's categories (QA report SP-001).
 */
export async function updateCategory(
  id: Id,
  userId: Id,
  data: Partial<InsertCategory>,
) {
  const { clause, values } = buildUpdate("categories", data);
  if (!clause) return;

  await dbQuery(
    `UPDATE categories SET ${clause}, ${TOUCH_SET} WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
    [...values, writeStamp(), id, userId],
  );
}

export async function deleteCategory(id: Id, userId: Id) {
  const stamp = writeStamp();
  await dbQuery(
    `UPDATE categories SET ${TOMBSTONE_SET} WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
    [stamp, stamp, id, userId],
  );
}

export async function getCategoryById(id: Id, userId: Id) {
  try {
    const result = await dbQuery(
      "SELECT * FROM categories WHERE id = ? AND userId = ? AND deletedAt IS NULL",
      [id, userId],
    );
    return Array.isArray(result) ? (result[0] ?? null) : null;
  } catch (error) {
    rethrowReadFailure("getCategoryById", error);
  }
}

// ============================================================================
// CREDIT CARDS
// ============================================================================

/** Client-safe credit card DTO — full PAN is never serialized. */
export type SafeCreditCard = Omit<CreditCard, "cardNumber"> & {
  cardNumberLast4: string;
};

async function toSafeCreditCard(row: CreditCard): Promise<SafeCreditCard> {
  const { cardNumber: _removed, ...rest } = row;
  if (!row.cardNumber) return { ...rest, cardNumberLast4: "" };

  let plain: string;
  try {
    plain = await decryptCardNumber(row.cardNumber, row.userId);
  } catch (error) {
    // A PAN this side holds no key for — a row encrypted under a key that
    // never reached this device. The client only ever needs the last four,
    // so the cost of that is those four digits on this one card. It used to
    // be the whole screen: these rows are mapped with `Promise.all`, so one
    // rejection took down the entire list and the Cards tab rendered "no
    // cards added yet" over a database that had several.
    console.error(
      `[cards] could not decrypt card ${row.id}; showing it without its last four`,
      error,
    );
    return { ...rest, cardNumberLast4: "" };
  }
  return { ...rest, cardNumberLast4: maskCardNumber(plain) };
}

export async function getUserCreditCards(
  userId: Id,
): Promise<SafeCreditCard[]> {
  try {
    const result = await dbQuery(
      "SELECT * FROM creditCards WHERE userId = ? AND deletedAt IS NULL ORDER BY name",
      [userId],
    );
    const rows = Array.isArray(result) ? result : [];
    return await Promise.all(
      rows.map((row) => toSafeCreditCard(row as CreditCard)),
    );
  } catch (error) {
    rethrowReadFailure("getUserCreditCards", error);
  }
}

export async function createCreditCard(
  data: InsertCreditCard,
): Promise<SafeCreditCard | null> {
  const id = ulid();
  await dbQuery(
    `
        INSERT INTO creditCards (id, userId, name, cardNumber, cardholderName, expiryMonth, expiryYear, creditLimit, color, cardType)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    [
      id,
      data.userId,
      data.name,
      await encryptCardNumber(data.cardNumber, data.userId),
      data.cardholderName,
      data.expiryMonth,
      data.expiryYear,
      data.creditLimit,
      data.color || CATEGORY_DEFAULT_COLOR,
      data.cardType || "credit",
    ],
  );
  return getCreditCardById(id, data.userId);
}

/**
 * Scoped by `userId` — previously keyed on `id` alone, which let any
 * authenticated user read another user's card metadata and even overwrite
 * their stored PAN (QA report SP-002).
 */
export async function updateCreditCard(
  id: Id,
  userId: Id,
  data: Partial<InsertCreditCard>,
): Promise<SafeCreditCard | null> {
  const payload: Partial<InsertCreditCard> = { ...data };
  if (payload.cardNumber !== undefined) {
    payload.cardNumber = await encryptCardNumber(payload.cardNumber, userId);
  }

  const { clause, values } = buildUpdate("creditCards", payload);

  if (clause) {
    await dbQuery(
      `UPDATE creditCards SET ${clause}, ${TOUCH_SET} WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
      [...values, writeStamp(), id, userId],
    );
  }

  return getCreditCardById(id, userId);
}

export async function deleteCreditCard(id: Id, userId: Id) {
  const stamp = writeStamp();
  await dbQuery(
    `UPDATE creditCards SET ${TOMBSTONE_SET} WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
    [stamp, stamp, id, userId],
  );
}

export async function getCreditCardById(
  id: Id,
  userId: Id,
): Promise<SafeCreditCard | null> {
  try {
    const result = await dbQuery(
      "SELECT * FROM creditCards WHERE id = ? AND userId = ? AND deletedAt IS NULL",
      [id, userId],
    );
    const row = Array.isArray(result) ? result[0] : null;
    return row ? await toSafeCreditCard(row as CreditCard) : null;
  } catch (error) {
    rethrowReadFailure("getCreditCardById", error);
  }
}

// ============================================================================
// ACCOUNTS
// ============================================================================

export async function getUserAccounts(userId: Id): Promise<Account[]> {
  try {
    const result = await dbQuery(
      "SELECT * FROM accounts WHERE userId = ? AND deletedAt IS NULL ORDER BY name",
      [userId],
    );
    return Array.isArray(result) ? (result as Account[]) : [];
  } catch (error) {
    rethrowReadFailure("getUserAccounts", error);
  }
}

export async function createAccount(
  data: InsertAccount,
): Promise<Account | null> {
  const id = ulid();
  await dbQuery(
    `
        INSERT INTO accounts (id, userId, name, type, currency, isDefault)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
    [
      id,
      data.userId,
      data.name,
      data.type,
      data.currency ?? "USD",
      data.isDefault ?? false,
    ],
  );
  return getAccountById(id, data.userId);
}

export async function updateAccount(
  id: Id,
  userId: Id,
  data: Partial<InsertAccount>,
): Promise<Account | null> {
  const updates = Object.entries(data)
    .map(([key]) => `${key} = ?`)
    .join(", ");
  const values = Object.values(data);

  if (updates.length === 0) {
    return getAccountById(id, userId);
  }

  await dbQuery(
    `UPDATE accounts SET ${updates}, ${TOUCH_SET} WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
    [...values, writeStamp(), id, userId],
  );

  return getAccountById(id, userId);
}

export async function deleteAccount(id: Id, userId: Id): Promise<void> {
  const stamp = writeStamp();
  await dbQuery(
    `UPDATE accounts SET ${TOMBSTONE_SET} WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
    [stamp, stamp, id, userId],
  );
}

export async function getAccountById(
  id: Id,
  userId: Id,
): Promise<Account | null> {
  try {
    const result = await dbQuery(
      "SELECT * FROM accounts WHERE id = ? AND userId = ? AND deletedAt IS NULL",
      [id, userId],
    );
    const row = Array.isArray(result) ? result[0] : null;
    return row ? (row as Account) : null;
  } catch (error) {
    rethrowReadFailure("getAccountById", error);
  }
}

export async function getAccountTransactionCount(
  accountId: Id,
  userId: Id,
): Promise<number> {
  const result = await dbQuery(
    "SELECT COUNT(*) as txCount FROM transactions WHERE userId = ? AND accountId = ? AND deletedAt IS NULL",
    [userId, accountId],
  );
  const row =
    Array.isArray(result) && result.length > 0
      ? (result[0] as Record<string, unknown>)
      : null;
  return Number(row?.txCount ?? 0);
}

export async function getAccountTransferCount(
  accountId: Id,
  userId: Id,
): Promise<number> {
  const result = await dbQuery(
    "SELECT COUNT(*) as transferCount FROM transfers WHERE userId = ? AND (fromAccountId = ? OR toAccountId = ?) AND deletedAt IS NULL",
    [userId, accountId, accountId],
  );
  const row =
    Array.isArray(result) && result.length > 0
      ? (result[0] as Record<string, unknown>)
      : null;
  return Number(row?.transferCount ?? 0);
}

export async function createTransfer(
  data: InsertTransfer,
): Promise<Transfer | null> {
  const id = ulid();
  await dbQuery(
    `
        INSERT INTO transfers (id, userId, fromAccountId, toAccountId, amount, description, date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    [
      id,
      data.userId,
      data.fromAccountId,
      data.toAccountId,
      data.amount,
      data.description || null,
      data.date,
    ],
  );
  return getTransferById(id, data.userId);
}

export async function getTransferById(
  id: Id,
  userId: Id,
): Promise<Transfer | null> {
  try {
    const result = await dbQuery(
      "SELECT * FROM transfers WHERE id = ? AND userId = ? AND deletedAt IS NULL",
      [id, userId],
    );
    const row = Array.isArray(result) ? result[0] : null;
    return row ? (row as Transfer) : null;
  } catch (error) {
    rethrowReadFailure("getTransferById", error);
  }
}

export async function getUserTransfers(userId: Id): Promise<Transfer[]> {
  try {
    const result = await dbQuery(
      "SELECT * FROM transfers WHERE userId = ? AND deletedAt IS NULL ORDER BY date DESC, id DESC",
      [userId],
    );
    return Array.isArray(result) ? (result as Transfer[]) : [];
  } catch (error) {
    rethrowReadFailure("getUserTransfers", error);
  }
}

export async function reassignAccountTransfers(
  fromAccountId: Id,
  toAccountId: Id,
  userId: Id,
): Promise<void> {
  // Direct legs between source and target are absorbed when merging accounts.
  // Tombstoned rather than dropped so the absorption reaches other devices.
  const stamp = writeStamp();
  await dbQuery(
    `UPDATE transfers SET ${TOMBSTONE_SET} WHERE userId = ? AND fromAccountId = ? AND toAccountId = ? AND deletedAt IS NULL`,
    [stamp, stamp, userId, fromAccountId, toAccountId],
  );
  await dbQuery(
    `UPDATE transfers SET ${TOMBSTONE_SET} WHERE userId = ? AND fromAccountId = ? AND toAccountId = ? AND deletedAt IS NULL`,
    [stamp, stamp, userId, toAccountId, fromAccountId],
  );
  await dbQuery(
    `UPDATE transfers SET fromAccountId = ?, ${TOUCH_SET} WHERE userId = ? AND fromAccountId = ? AND deletedAt IS NULL`,
    [toAccountId, writeStamp(), userId, fromAccountId],
  );
  await dbQuery(
    `UPDATE transfers SET toAccountId = ?, ${TOUCH_SET} WHERE userId = ? AND toAccountId = ? AND deletedAt IS NULL`,
    [toAccountId, writeStamp(), userId, fromAccountId],
  );
}

export async function reassignAccountTransactions(
  fromAccountId: Id,
  toAccountId: Id,
  userId: Id,
): Promise<void> {
  await dbQuery(
    `UPDATE transactions SET accountId = ?, ${TOUCH_SET} WHERE userId = ? AND accountId = ? AND deletedAt IS NULL`,
    [toAccountId, writeStamp(), userId, fromAccountId],
  );
}

export async function reassignAndDeleteAccount(
  accountId: Id,
  targetAccountId: Id,
  userId: Id,
): Promise<void> {
  if (accountId === targetAccountId) {
    throw new Error("Cannot reassign to the same account");
  }

  const source = await getAccountById(accountId, userId);
  const target = await getAccountById(targetAccountId, userId);
  if (!source || !target) {
    throw new Error("Account not found");
  }

  await reassignAccountTransactions(accountId, targetAccountId, userId);
  await reassignAccountTransfers(accountId, targetAccountId, userId);
  await deleteAccount(accountId, userId);
}

/** Idempotent: creates a default Cash account and backfills null accountId rows. */
export async function ensureDefaultAccount(userId: Id): Promise<void> {
  const countResult = await dbQuery(
    "SELECT COUNT(*) as accountCount FROM accounts WHERE userId = ? AND deletedAt IS NULL",
    [userId],
  );

  const row =
    Array.isArray(countResult) && countResult.length > 0
      ? (countResult[0] as Record<string, unknown>)
      : null;
  const existingCount = Number(row?.accountCount ?? 0);
  if (existingCount > 0) {
    return;
  }

  const created = await createAccount({
    userId,
    name: "Cash",
    type: "cash",
    currency: "USD",
    isDefault: true,
  });
  if (!created) {
    return;
  }

  await dbQuery(
    `UPDATE transactions SET accountId = ?, ${TOUCH_SET} WHERE userId = ? AND accountId IS NULL AND deletedAt IS NULL`,
    [created.id, writeStamp(), userId],
  );
}

// ============================================================================
// TRANSACTIONS
// ============================================================================

export async function getUserTransactions(
  userId: Id,
  limit?: number,
  offset?: number,
) {
  try {
    let query =
      "SELECT * FROM transactions WHERE userId = ? AND deletedAt IS NULL ORDER BY date DESC";
    const params: unknown[] = [userId];

    if (limit) {
      query += " LIMIT ?";
      params.push(limit);
    }
    if (offset) {
      query += " OFFSET ?";
      params.push(offset);
    }

    const result = await dbQuery(query, params);
    return Array.isArray(result) ? result : [];
  } catch (error) {
    rethrowReadFailure("getUserTransactions", error);
  }
}

export async function getTransactionsByDateRange(
  userId: Id,
  startDate: Date,
  endDate: Date,
) {
  try {
    const result = await dbQuery(
      "SELECT * FROM transactions WHERE userId = ? AND date >= ? AND date <= ? AND deletedAt IS NULL ORDER BY date DESC",
      [userId, startDate, endDate],
    );
    return Array.isArray(result) ? result : [];
  } catch (error) {
    rethrowReadFailure("getTransactionsByDateRange", error);
  }
}

export async function getTransactionsByCategory(userId: Id, categoryId: Id) {
  try {
    const result = await dbQuery(
      "SELECT * FROM transactions WHERE userId = ? AND categoryId = ? AND deletedAt IS NULL ORDER BY date DESC",
      [userId, categoryId],
    );
    return Array.isArray(result) ? result : [];
  } catch (error) {
    rethrowReadFailure("getTransactionsByCategory", error);
  }
}

export async function getTransactionsByCreditCard(
  userId: Id,
  creditCardId: Id,
) {
  try {
    const result = await dbQuery(
      "SELECT * FROM transactions WHERE userId = ? AND creditCardId = ? AND deletedAt IS NULL ORDER BY date DESC",
      [userId, creditCardId],
    );
    return Array.isArray(result) ? result : [];
  } catch (error) {
    rethrowReadFailure("getTransactionsByCreditCard", error);
  }
}

export async function createTransaction(data: InsertTransaction) {
  const id = ulid();
  await dbQuery(
    `
        INSERT INTO transactions (id, userId, categoryId, creditCardId, accountId, type, amount, description, date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    [
      id,
      data.userId,
      data.categoryId,
      data.creditCardId || null,
      data.accountId ?? null,
      data.type,
      data.amount,
      data.description || null,
      data.date,
    ],
  );
  return id;
}

export async function createTransactionsBulk(rows: InsertTransaction[]) {
  if (rows.length === 0) return 0;

  const params = rows.flatMap((data) => [
    ulid(),
    data.userId,
    data.categoryId,
    data.creditCardId || null,
    data.accountId ?? null,
    data.type,
    data.amount,
    data.description || null,
    data.date,
  ]);

  await dbQuery(
    `
        INSERT INTO transactions (id, userId, categoryId, creditCardId, accountId, type, amount, description, date)
        VALUES ${rows.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ")}
      `,
    params,
  );
  return rows.length;
}

export async function updateTransaction(
  id: Id,
  userId: Id,
  data: Partial<InsertTransaction>,
) {
  const entries = Object.entries(data);
  // No fields to update — avoid emitting `SET  WHERE ...` (invalid SQL).
  if (entries.length === 0) {
    return;
  }
  const updates = entries.map(([key]) => `${key} = ?`).join(", ");
  const values = entries.map(([, value]) => value);

  await dbQuery(
    `UPDATE transactions SET ${updates}, ${TOUCH_SET} WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
    [...values, writeStamp(), id, userId],
  );
}

export async function deleteTransaction(id: Id, userId: Id) {
  const stamp = writeStamp();
  await dbQuery(
    `UPDATE transactions SET ${TOMBSTONE_SET} WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
    [stamp, stamp, id, userId],
  );
}

/** Wipes all user-owned rows. Three separate DELETEs (not transactional) — on partial failure, retry clears any remainder. */
export async function deleteAllUserData(userId: Id) {
  const stamp = writeStamp();
  // Tombstoned, not dropped: "clear all data" is a user action like any other
  // and has to reach the account's other devices. Rows leave the database for
  // good only when the tombstone retention window expires.
  for (const table of [
    "recurringTransactions",
    "repayments",
    "loans",
    "budgets",
    "monthlySummaries",
    "transactions",
    "transfers",
    "accounts",
    "creditCards",
    "categories",
  ]) {
    await dbQuery(
      `UPDATE ${table} SET ${TOMBSTONE_SET} WHERE userId = ? AND deletedAt IS NULL`,
      [stamp, stamp, userId],
    );
  }
  // N7: "clear all data" must also drop the account-linked PIN — otherwise a
  // wiped account keeps a stale hash and lockout state.
  await clearUserPin(userId);
}

export async function getTransactionById(id: Id, userId: Id) {
  try {
    const result = await dbQuery(
      "SELECT * FROM transactions WHERE id = ? AND userId = ? AND deletedAt IS NULL",
      [id, userId],
    );
    return Array.isArray(result) ? result[0] : null;
  } catch (error) {
    rethrowReadFailure("getTransactionById", error);
  }
}

// ============================================================================
// RECURRING TRANSACTIONS
// ============================================================================

export async function getUserRecurringTransactions(
  userId: Id,
): Promise<RecurringTransaction[]> {
  try {
    const result = await dbQuery(
      "SELECT * FROM recurringTransactions WHERE userId = ? AND deletedAt IS NULL ORDER BY createdAt DESC",
      [userId],
    );
    return Array.isArray(result) ? (result as RecurringTransaction[]) : [];
  } catch (error) {
    rethrowReadFailure("getUserRecurringTransactions", error);
  }
}

export async function createRecurringTransaction(
  data: InsertRecurringTransaction,
): Promise<Id> {
  const id = ulid();
  await dbQuery(
    `
        INSERT INTO recurringTransactions (
          id, userId, categoryId, creditCardId, type, amount, description, frequency, \`interval\`,
          endCondition, occurrenceCount, endDate, startDate, nextRunDate, lastRunDate,
          generatedCount, isActive
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    [
      id,
      data.userId,
      data.categoryId,
      data.creditCardId ?? null,
      data.type,
      data.amount,
      data.description ?? null,
      data.frequency,
      data.interval ?? 1,
      data.endCondition,
      data.occurrenceCount ?? null,
      data.endDate ?? null,
      data.startDate,
      data.nextRunDate,
      data.lastRunDate ?? null,
      data.generatedCount ?? 0,
      data.isActive ?? true,
    ],
  );
  return id;
}

function sqlColumnName(column: string): string {
  return column === "interval" ? "`interval`" : column;
}

export async function updateRecurringTransaction(
  id: Id,
  userId: Id,
  data: Partial<InsertRecurringTransaction>,
): Promise<void> {
  const updates = Object.entries(data)
    .map(([key]) => `${sqlColumnName(key)} = ?`)
    .join(", ");
  if (!updates) {
    return;
  }
  const values = Object.values(data);
  await dbQuery(
    `UPDATE recurringTransactions SET ${updates}, ${TOUCH_SET} WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
    [...values, writeStamp(), id, userId],
  );
}

export async function deleteRecurringTransaction(
  id: Id,
  userId: Id,
): Promise<void> {
  const stamp = writeStamp();
  await dbQuery(
    `UPDATE recurringTransactions SET ${TOMBSTONE_SET} WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
    [stamp, stamp, id, userId],
  );
}

export async function getRecurringTransactionById(
  id: Id,
  userId: Id,
): Promise<RecurringTransaction | null> {
  try {
    const result = await dbQuery(
      "SELECT * FROM recurringTransactions WHERE id = ? AND userId = ? AND deletedAt IS NULL",
      [id, userId],
    );
    const row = Array.isArray(result) ? result[0] : null;
    return row ? (row as RecurringTransaction) : null;
  } catch (error) {
    rethrowReadFailure("getRecurringTransactionById", error);
  }
}

export async function getDueRecurringTransactions(
  now: Date,
): Promise<RecurringTransaction[]> {
  try {
    const result = await dbQuery(
      "SELECT * FROM recurringTransactions WHERE isActive = 1 AND nextRunDate <= ? AND deletedAt IS NULL ORDER BY nextRunDate ASC",
      [now],
    );
    return Array.isArray(result) ? (result as RecurringTransaction[]) : [];
  } catch (error) {
    rethrowReadFailure("getDueRecurringTransactions", error);
  }
}

export async function advanceRecurringTransaction(
  id: Id,
  updates: Pick<
    InsertRecurringTransaction,
    "nextRunDate" | "lastRunDate" | "generatedCount" | "isActive"
  >,
): Promise<void> {
  await dbQuery(
    `
        UPDATE recurringTransactions
        SET nextRunDate = ?, lastRunDate = ?, generatedCount = ?, isActive = ?, ${TOUCH_SET}
        WHERE id = ? AND deletedAt IS NULL
      `,
    [
      updates.nextRunDate,
      updates.lastRunDate ?? null,
      updates.generatedCount,
      updates.isActive,
      writeStamp(),
      id,
    ],
  );
}

// ============================================================================
// BUDGETS
// ============================================================================

export async function getUserBudgets(userId: Id): Promise<Budget[]> {
  try {
    const result = await dbQuery(
      "SELECT * FROM budgets WHERE userId = ? AND deletedAt IS NULL ORDER BY createdAt DESC",
      [userId],
    );
    return Array.isArray(result) ? (result as Budget[]) : [];
  } catch (error) {
    rethrowReadFailure("getUserBudgets", error);
  }
}

export async function createBudget(data: InsertBudget): Promise<Id> {
  const id = ulid();
  await dbQuery(
    `
        INSERT INTO budgets (id, userId, categoryId, period, amount, startDate, endDate)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    [
      id,
      data.userId,
      data.categoryId,
      data.period,
      data.amount,
      data.startDate ?? null,
      data.endDate ?? null,
    ],
  );
  return id;
}

export async function updateBudget(
  id: Id,
  userId: Id,
  data: Partial<InsertBudget>,
): Promise<void> {
  const updates = Object.entries(data)
    .map(([key]) => `${key} = ?`)
    .join(", ");
  const values = Object.values(data);

  if (updates.length === 0) {
    return;
  }

  await dbQuery(
    `UPDATE budgets SET ${updates}, ${TOUCH_SET} WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
    [...values, writeStamp(), id, userId],
  );
}

export async function deleteBudget(id: Id, userId: Id): Promise<void> {
  const stamp = writeStamp();
  await dbQuery(
    `UPDATE budgets SET ${TOMBSTONE_SET} WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
    [stamp, stamp, id, userId],
  );
}

export async function getBudgetById(
  id: Id,
  userId: Id,
): Promise<Budget | null> {
  try {
    const result = await dbQuery(
      "SELECT * FROM budgets WHERE id = ? AND userId = ? AND deletedAt IS NULL",
      [id, userId],
    );
    const row = Array.isArray(result) ? result[0] : null;
    return row ? (row as Budget) : null;
  } catch (error) {
    rethrowReadFailure("getBudgetById", error);
  }
}

export interface BudgetProgressRow {
  budgetId: Id;
  spent: string;
  limit: string;
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (value == null) {
    return null;
  }
  return value instanceof Date ? value : new Date(value);
}

export async function getBudgetProgress(
  userId: Id,
  monthStart: Date,
  monthEnd: Date,
  weekStart: Date,
  weekEnd: Date,
): Promise<BudgetProgressRow[]> {
  const budgets = await getUserBudgets(userId);

  return Promise.all(
    budgets.map(async (budget) => {
      const [periodStart, periodEnd] =
        budget.period === "weekly"
          ? [weekStart, weekEnd]
          : [monthStart, monthEnd];

      const budgetStart = toDate(budget.startDate);
      const budgetEnd = toDate(budget.endDate);

      const start =
        budgetStart && budgetStart > periodStart ? budgetStart : periodStart;
      const end = budgetEnd && budgetEnd < periodEnd ? budgetEnd : periodEnd;

      if (start > end) {
        return { budgetId: budget.id, spent: "0.00", limit: budget.amount };
      }

      try {
        const result = await dbQuery(
          "SELECT amount FROM transactions WHERE userId = ? AND type = 'expense' AND categoryId = ? AND date >= ? AND date <= ? AND deletedAt IS NULL",
          [userId, budget.categoryId, start, end],
        );

        const spent = (Array.isArray(result) ? result : []).reduce(
          (sum, row: Record<string, unknown>) =>
            sum + parseFloat(row.amount as string),
          0,
        );

        return {
          budgetId: budget.id,
          spent: spent.toFixed(2),
          limit: budget.amount,
        };
      } catch {
        return { budgetId: budget.id, spent: "0.00", limit: budget.amount };
      }
    }),
  );
}

export async function findActiveBudget(
  userId: Id,
  categoryId: Id,
  period: "monthly" | "weekly",
  options?: { excludeId?: Id },
): Promise<Budget | null> {
  try {
    const excludeClause = options?.excludeId != null ? " AND id <> ?" : "";
    const params: (number | string)[] = [userId, categoryId, period];
    if (options?.excludeId != null) {
      params.push(options.excludeId);
    }

    const result = await dbQuery(
      `
          SELECT * FROM budgets
          WHERE userId = ? AND categoryId = ? AND period = ?
            AND deletedAt IS NULL
            AND (startDate IS NULL OR startDate <= NOW())
            AND (endDate IS NULL OR endDate >= NOW())
            ${excludeClause}
          LIMIT 1
        `,
      params,
    );
    const row = Array.isArray(result) ? result[0] : null;
    return row ? (row as Budget) : null;
  } catch (error) {
    rethrowReadFailure("findActiveBudget", error);
  }
}

// ============================================================================
// MONTHLY SUMMARIES
// ============================================================================

export async function getMonthlySummary(
  userId: Id,
  year: number,
  month: number,
) {
  try {
    const result = await dbQuery(
      "SELECT * FROM monthlySummaries WHERE userId = ? AND year = ? AND month = ? AND deletedAt IS NULL",
      [userId, year, month],
    );
    return Array.isArray(result) ? result[0] : null;
  } catch (error) {
    rethrowReadFailure("getMonthlySummary", error);
  }
}

export async function createMonthlySummary(data: InsertMonthlySummary) {
  const id = ulid();
  await dbQuery(
    `
        INSERT INTO monthlySummaries (id, userId, year, month, totalIncome, totalExpense, netBalance)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    [
      id,
      data.userId,
      data.year,
      data.month,
      data.totalIncome || 0,
      data.totalExpense || 0,
      data.netBalance || 0,
    ],
  );
  return id;
}

export async function updateMonthlySummary(
  id: Id,
  data: Partial<InsertMonthlySummary>,
) {
  const updates = Object.entries(data)
    .map(([key]) => `${key} = ?`)
    .join(", ");
  const values = Object.values(data);

  await dbQuery(
    `UPDATE monthlySummaries SET ${updates}, ${TOUCH_SET} WHERE id = ? AND deletedAt IS NULL`,
    [...values, writeStamp(), id],
  );
}

// ============================================================================
// AGGREGATE QUERIES
// ============================================================================

/**
 * Derive per-account balances from all user transactions (JS reduce, no GROUP BY).
 */
export async function getAccountBalances(
  userId: Id,
): Promise<Record<Id, number>> {
  try {
    const result = await dbQuery(
      "SELECT id, accountId, type, amount FROM transactions WHERE userId = ? AND deletedAt IS NULL",
      [userId],
    );

    const rows = Array.isArray(result) ? result : [];
    const txnBalances = reduceAccountBalances(
      rows.map((row: Record<string, unknown>) => ({
        accountId: row.accountId == null ? null : (row.accountId as Id),
        type: String(row.type ?? ""),
        amount: String(row.amount ?? "0"),
      })),
    );

    const transfers = await getUserTransfers(userId);
    return applyTransferLegs(
      txnBalances,
      transfers.map((transfer) => ({
        fromAccountId: transfer.fromAccountId,
        toAccountId: transfer.toAccountId,
        amount: String(transfer.amount),
      })),
    );
  } catch (error) {
    rethrowReadFailure("getAccountBalances", error);
  }
}

/**
 * Get monthly statistics for a user.
 * Calculates total income, expenses, and net balance for a given month.
 */
export async function getMonthlyStats(userId: Id, year: number, month: number) {
  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const result = await dbQuery(
      "SELECT * FROM transactions WHERE userId = ? AND date >= ? AND date <= ? AND deletedAt IS NULL",
      [userId, startDate, endDate],
    );

    const txns = Array.isArray(result) ? result : [];
    let totalIncome = 0;
    let totalExpense = 0;

    txns.forEach((txn: Record<string, unknown>) => {
      const amount = parseFloat(txn.amount as string);
      if (txn.type === "income") {
        totalIncome += amount;
      } else {
        totalExpense += amount;
      }
    });

    return {
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense,
    };
  } catch (error) {
    rethrowReadFailure("getMonthlyStats", error);
  }
}

export interface MonthlyTrendPoint {
  year: number;
  month: number;
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
}

/**
 * Get income, expense, and net balance for the last N months ending at the anchor month.
 */
export async function getMonthlyTrend(
  userId: Id,
  year: number,
  month: number,
  count = 6,
): Promise<MonthlyTrendPoint[]> {
  try {
    const startDate = new Date(year, month - count, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const result = await dbQuery(
      "SELECT * FROM transactions WHERE userId = ? AND date >= ? AND date <= ? AND deletedAt IS NULL",
      [userId, startDate, endDate],
    );

    const txns = Array.isArray(result) ? result : [];
    const monthMap = new Map<
      string,
      { year: number; month: number; totalIncome: number; totalExpense: number }
    >();

    for (let i = 0; i < count; i++) {
      const d = new Date(year, month - count + i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      monthMap.set(`${y}-${m}`, {
        year: y,
        month: m,
        totalIncome: 0,
        totalExpense: 0,
      });
    }

    txns.forEach((txn: Record<string, unknown>) => {
      const txnDate = new Date(txn.date as string);
      const key = `${txnDate.getFullYear()}-${txnDate.getMonth() + 1}`;
      const bucket = monthMap.get(key);
      if (!bucket) return;

      const amount = parseFloat(txn.amount as string);
      if (txn.type === "income") {
        bucket.totalIncome += amount;
      } else {
        bucket.totalExpense += amount;
      }
    });

    return Array.from(monthMap.values())
      .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month))
      .map((item) => ({
        ...item,
        netBalance: item.totalIncome - item.totalExpense,
      }));
  } catch (error) {
    rethrowReadFailure("getMonthlyTrend", error);
  }
}

export interface CategoryAnomalyResult {
  categoryId: Id;
  current: number;
  mean: number;
  deltaPct: number;
  isAnomaly: boolean;
}

const DEFAULT_ANOMALY_THRESHOLD = 1.5;
const MIN_PRIOR_MONTHS_WITH_SPEND = 2;

function monthKeyFromDate(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}`;
}

function monthKey(year: number, month: number): string {
  return `${year}-${month}`;
}

/**
 * Flag categories whose spend in the target month is significantly above
 * their recent per-category mean (prior lookback window, months with spend only).
 */
export async function getCategoryAnomalies(
  userId: Id,
  year: number,
  month: number,
  lookbackMonths = 3,
  threshold = DEFAULT_ANOMALY_THRESHOLD,
): Promise<CategoryAnomalyResult[]> {
  try {
    const startDate = new Date(year, month - 1 - lookbackMonths, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const result = await dbQuery(
      "SELECT * FROM transactions WHERE userId = ? AND type = 'expense' AND date >= ? AND date <= ? AND deletedAt IS NULL",
      [userId, startDate, endDate],
    );

    const txns = Array.isArray(result) ? result : [];
    const monthSpend = new Map<string, Map<Id, number>>();

    txns.forEach((txn: Record<string, unknown>) => {
      const txnDate = new Date(txn.date as string);
      const key = monthKeyFromDate(txnDate);
      const categoryId = txn.categoryId as Id;
      const amount = parseFloat(txn.amount as string);
      const bucket = monthSpend.get(key) ?? new Map<Id, number>();
      bucket.set(categoryId, (bucket.get(categoryId) ?? 0) + amount);
      monthSpend.set(key, bucket);
    });

    const targetKey = monthKey(year, month);
    const targetSpend = monthSpend.get(targetKey) ?? new Map<Id, number>();
    const results: CategoryAnomalyResult[] = [];

    for (const [categoryId, current] of targetSpend.entries()) {
      const priorAmounts: number[] = [];

      for (let i = 1; i <= lookbackMonths; i++) {
        const d = new Date(year, month - 1 - i, 1);
        const key = monthKey(d.getFullYear(), d.getMonth() + 1);
        const prior = monthSpend.get(key)?.get(categoryId) ?? 0;
        if (prior > 0) {
          priorAmounts.push(prior);
        }
      }

      const mean =
        priorAmounts.length > 0
          ? priorAmounts.reduce((sum, v) => sum + v, 0) / priorAmounts.length
          : 0;
      const hasEnoughHistory =
        priorAmounts.length >= MIN_PRIOR_MONTHS_WITH_SPEND;
      const isAnomaly =
        hasEnoughHistory && mean > 0 && current > mean * threshold;
      const deltaPct = mean > 0 ? ((current - mean) / mean) * 100 : 0;

      results.push({
        categoryId,
        current,
        mean,
        deltaPct,
        isAnomaly,
      });
    }

    return results;
  } catch (error) {
    rethrowReadFailure("getCategoryAnomalies", error);
  }
}

/**
 * Get expense breakdown by category for a given month.
 */
export async function getExpensesByCategory(
  userId: Id,
  year: number,
  month: number,
) {
  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const result = await dbQuery(
      "SELECT * FROM transactions WHERE userId = ? AND type = 'expense' AND date >= ? AND date <= ? AND deletedAt IS NULL",
      [userId, startDate, endDate],
    );

    const txns = Array.isArray(result) ? result : [];
    const categoryMap = new Map<Id, { total: number; count: number }>();

    txns.forEach((txn: Record<string, unknown>) => {
      const amount = parseFloat(txn.amount as string);
      const categoryId = txn.categoryId as Id;
      const existing = categoryMap.get(categoryId) || { total: 0, count: 0 };
      categoryMap.set(categoryId, {
        total: existing.total + amount,
        count: existing.count + 1,
      });
    });

    return Array.from(categoryMap.entries()).map(([categoryId, data]) => ({
      categoryId,
      total: data.total,
      count: data.count,
    }));
  } catch (error) {
    rethrowReadFailure("getExpensesByCategory", error);
  }
}

/**
 * Get recent transactions for dashboard.
 */
export async function getRecentTransactions(userId: Id, limit: number = 7) {
  try {
    const result = await dbQuery(
      "SELECT * FROM transactions WHERE userId = ? AND deletedAt IS NULL ORDER BY date DESC LIMIT ?",
      [userId, limit],
    );
    return Array.isArray(result) ? result : [];
  } catch (error) {
    rethrowReadFailure("getRecentTransactions", error);
  }
}

// ============================================================================
// LOANS
// ============================================================================

export type LoanWithBalance = Loan & {
  remainingBalance: string;
  repayments: Repayment[];
};

export function computeRemainingBalance(
  principal: string,
  repayments: Pick<Repayment, "amount">[],
): string {
  const totalRepaid = repayments.reduce(
    (sum, repayment) => sum + Number(repayment.amount),
    0,
  );
  return Math.max(0, Number(principal) - totalRepaid).toFixed(2);
}

export class RepaymentExceedsBalanceError extends Error {
  constructor(public readonly remainingBalance: string) {
    super("Repayment cannot exceed remaining balance");
    this.name = "RepaymentExceedsBalanceError";
  }
}

export async function getUserLoans(userId: Id): Promise<Loan[]> {
  try {
    const result = await dbQuery(
      "SELECT * FROM loans WHERE userId = ? AND deletedAt IS NULL ORDER BY createdAt DESC",
      [userId],
    );
    return Array.isArray(result) ? (result as Loan[]) : [];
  } catch (error) {
    rethrowReadFailure("getUserLoans", error);
  }
}

export async function createLoan(data: InsertLoan): Promise<Loan | null> {
  const id = ulid();
  await dbQuery(
    `
        INSERT INTO loans (
          id, userId, direction, counterparty, principal, rate, periodicity,
          installmentCount, endDate, nextDueDate, status, note
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    [
      id,
      data.userId,
      data.direction,
      data.counterparty ?? null,
      data.principal,
      data.rate ?? null,
      data.periodicity,
      data.installmentCount ?? null,
      data.endDate ?? null,
      data.nextDueDate ?? null,
      data.status ?? "active",
      data.note ?? null,
    ],
  );
  return getLoanById(id, data.userId);
}

export async function getLoanById(id: Id, userId: Id): Promise<Loan | null> {
  try {
    const result = await dbQuery(
      "SELECT * FROM loans WHERE id = ? AND userId = ? AND deletedAt IS NULL",
      [id, userId],
    );
    const row = Array.isArray(result) ? result[0] : null;
    return row ? (row as Loan) : null;
  } catch (error) {
    rethrowReadFailure("getLoanById", error);
  }
}

export async function updateLoan(
  id: Id,
  userId: Id,
  data: Partial<InsertLoan>,
): Promise<void> {
  const updates = Object.entries(data)
    .map(([key]) => `${key} = ?`)
    .join(", ");
  const values = Object.values(data);

  if (updates.length === 0) {
    return;
  }

  await dbQuery(
    `UPDATE loans SET ${updates}, ${TOUCH_SET} WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
    [...values, writeStamp(), id, userId],
  );
}

export async function deleteLoan(id: Id, userId: Id): Promise<void> {
  const stamp = writeStamp();
  await dbQuery(
    `UPDATE loans SET ${TOMBSTONE_SET} WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
    [stamp, stamp, id, userId],
  );
}

export async function createRepayment(
  data: InsertRepayment,
): Promise<Repayment | null> {
  const loan = await getLoanById(data.loanId, data.userId);
  if (!loan) {
    return null;
  }

  const id = ulid();
  await dbQuery(
    `
        INSERT INTO repayments (id, loanId, userId, amount, date, note)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
    [id, data.loanId, data.userId, data.amount, data.date, data.note ?? null],
  );
  return getRepaymentById(id, data.userId);
}

export async function recordRepayment(
  data: InsertRepayment,
): Promise<LoanWithBalance | null> {
  const loan = await getLoanById(data.loanId, data.userId);
  if (!loan) {
    return null;
  }

  const existingRepayments = await getRepaymentsByLoan(
    data.loanId,
    data.userId,
  );
  const remainingBefore = computeRemainingBalance(
    loan.principal,
    existingRepayments,
  );

  if (Number(data.amount) > Number(remainingBefore)) {
    throw new RepaymentExceedsBalanceError(remainingBefore);
  }

  await dbQuery(
    `
        INSERT INTO repayments (id, loanId, userId, amount, date, note)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
    [
      ulid(),
      data.loanId,
      data.userId,
      data.amount,
      data.date,
      data.note ?? null,
    ],
  );

  const remainingAfter = computeRemainingBalance(loan.principal, [
    ...existingRepayments,
    { amount: data.amount },
  ]);

  const loanUpdates: Partial<InsertLoan> = {};

  const advancedDue = resolveNextDueDateAfterRepayment(
    loan.periodicity,
    loan.nextDueDate,
  );
  if (advancedDue) {
    loanUpdates.nextDueDate = advancedDue;
  }

  if (Number(remainingAfter) === 0) {
    loanUpdates.status = "settled";
  }

  if (Object.keys(loanUpdates).length > 0) {
    await updateLoan(data.loanId, data.userId, loanUpdates);
  }

  return getLoanWithBalance(data.loanId, data.userId);
}

export async function getRepaymentById(
  id: Id,
  userId: Id,
): Promise<Repayment | null> {
  try {
    const result = await dbQuery(
      "SELECT * FROM repayments WHERE id = ? AND userId = ? AND deletedAt IS NULL",
      [id, userId],
    );
    const row = Array.isArray(result) ? result[0] : null;
    return row ? (row as Repayment) : null;
  } catch (error) {
    rethrowReadFailure("getRepaymentById", error);
  }
}

export async function getRepaymentsByLoan(
  loanId: Id,
  userId: Id,
): Promise<Repayment[]> {
  try {
    const result = await dbQuery(
      "SELECT * FROM repayments WHERE loanId = ? AND userId = ? AND deletedAt IS NULL ORDER BY date DESC",
      [loanId, userId],
    );
    return Array.isArray(result) ? (result as Repayment[]) : [];
  } catch (error) {
    rethrowReadFailure("getRepaymentsByLoan", error);
  }
}

export async function deleteRepayment(id: Id, userId: Id): Promise<void> {
  const stamp = writeStamp();
  await dbQuery(
    `UPDATE repayments SET ${TOMBSTONE_SET} WHERE id = ? AND userId = ? AND deletedAt IS NULL`,
    [stamp, stamp, id, userId],
  );
}

export async function getLoanWithBalance(
  id: Id,
  userId: Id,
): Promise<LoanWithBalance | null> {
  const loan = await getLoanById(id, userId);
  if (!loan) {
    return null;
  }

  const repayments = await getRepaymentsByLoan(id, userId);
  return {
    ...loan,
    remainingBalance: computeRemainingBalance(loan.principal, repayments),
    repayments,
  };
}

import { resolveNextDueDateAfterRepayment } from "../lib/loan-schedule";
import {
  applyTransferLegs,
  reduceAccountBalances,
} from "@/lib/account-balances";
import { callDataApi } from "./_core/dataApi";
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
} from "@/drizzle/schema";

/**
 * Get database connection.
 * Uses the Manus platform's managed database.
 */
async function getDb() {
  try {
    const result = await callDataApi("Database/query", {
      body: { query: "SELECT 1" },
    });
    return result ? true : null;
  } catch {
    return null;
  }
}

// ============================================================================
// USERS
// ============================================================================

export async function getUserByOpenId(openId: string) {
  const result = await callDataApi("Database/query", {
    body: {
      query: "SELECT * FROM users WHERE openId = ?",
      params: [openId],
    },
  });
  return result && Array.isArray(result) ? result[0] : null;
}

export async function upsertUser(data: {
  openId: string;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  lastSignedIn?: Date;
}) {
  const fields = [
    ["openId", data.openId],
    ["name", data.name],
    ["email", data.email],
    ["loginMethod", data.loginMethod],
    ["lastSignedIn", data.lastSignedIn],
  ].filter(([, value]) => value !== undefined) as [string, unknown][];
  const columns = fields.map(([column]) => column);
  const values = fields.map(([, value]) => value);
  const updates = columns
    .filter((column) => column !== "openId")
    .map((column) => `${column} = VALUES(${column})`);

  await callDataApi("Database/query", {
    body: {
      query: `
        INSERT INTO users (${columns.join(", ")})
        VALUES (${columns.map(() => "?").join(", ")})
        ON DUPLICATE KEY UPDATE
          ${updates.length > 0 ? updates.join(", ") : "openId = openId"}
      `,
      params: values,
    },
  });
}

/** Coerce MySQL tinyint (0/1) or boolean — never use Boolean() (string "0" is truthy). */
function coerceDbBoolean(value: unknown): boolean {
  return value === 1 || value === true;
}

export async function getUserSettings(
  userId: number,
): Promise<{ aiEnabled: boolean; remindersEnabled: boolean }> {
  const result = await callDataApi("Database/query", {
    body: {
      query: "SELECT aiEnabled, remindersEnabled FROM users WHERE id = ?",
      params: [userId],
    },
  });

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
  userId: number,
  enabled: boolean,
): Promise<void> {
  await callDataApi("Database/query", {
    body: {
      query: "UPDATE users SET aiEnabled = ? WHERE id = ?",
      params: [enabled, userId],
    },
  });
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
  userId: number,
  type?: "income" | "expense",
) {
  try {
    const query = type
      ? "SELECT * FROM categories WHERE userId = ? AND type = ? ORDER BY name"
      : "SELECT * FROM categories WHERE userId = ? ORDER BY name";
    const params = type ? [userId, type] : [userId];

    const result = await callDataApi("Database/query", {
      body: { query, params },
    });
    return Array.isArray(result) ? result : [];
  } catch (error) {
    rethrowReadFailure("getUserCategories", error);
  }
}

export async function createCategory(data: InsertCategory) {
  const result = await callDataApi("Database/query", {
    body: {
      query: `
        INSERT INTO categories (userId, name, type, color, icon, isDefault)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      params: [
        data.userId,
        data.name,
        data.type,
        // Assign a distinct palette token by name when no color is supplied.
        data.color || getCategoryColorForName(data.name),
        data.icon || DEFAULT_CATEGORY_ICON,
        data.isDefault || false,
      ],
    },
  });
  return result && typeof result === "object" && "insertId" in result
    ? (result as { insertId: number }).insertId
    : 0;
}

/** Idempotent: seeds DEFAULT_CATEGORIES once per user when they have zero categories. */
export async function seedDefaultCategories(userId: number): Promise<void> {
  const countResult = await callDataApi("Database/query", {
    body: {
      query:
        "SELECT COUNT(*) as categoryCount FROM categories WHERE userId = ?",
      params: [userId],
    },
  });

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
  id: number,
  userId: number,
  data: Partial<InsertCategory>,
) {
  const { clause, values } = buildUpdate("categories", data);
  if (!clause) return;

  await callDataApi("Database/query", {
    body: {
      query: `UPDATE categories SET ${clause} WHERE id = ? AND userId = ?`,
      params: [...values, id, userId],
    },
  });
}

export async function deleteCategory(id: number, userId: number) {
  await callDataApi("Database/query", {
    body: {
      query: "DELETE FROM categories WHERE id = ? AND userId = ?",
      params: [id, userId],
    },
  });
}

export async function getCategoryById(id: number, userId: number) {
  try {
    const result = await callDataApi("Database/query", {
      body: {
        query: "SELECT * FROM categories WHERE id = ? AND userId = ?",
        params: [id, userId],
      },
    });
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

function toSafeCreditCard(row: CreditCard): SafeCreditCard {
  const plain = row.cardNumber ? decryptCardNumber(row.cardNumber) : "";
  const { cardNumber: _removed, ...rest } = row;
  return { ...rest, cardNumberLast4: maskCardNumber(plain) };
}

export async function getUserCreditCards(
  userId: number,
): Promise<SafeCreditCard[]> {
  try {
    const result = await callDataApi("Database/query", {
      body: {
        query: "SELECT * FROM creditCards WHERE userId = ? ORDER BY name",
        params: [userId],
      },
    });
    const rows = Array.isArray(result) ? result : [];
    return rows.map((row) => toSafeCreditCard(row as CreditCard));
  } catch (error) {
    rethrowReadFailure("getUserCreditCards", error);
  }
}

export async function createCreditCard(
  data: InsertCreditCard,
): Promise<SafeCreditCard | null> {
  const result = await callDataApi("Database/query", {
    body: {
      query: `
        INSERT INTO creditCards (userId, name, cardNumber, cardholderName, expiryMonth, expiryYear, creditLimit, color, cardType)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        data.userId,
        data.name,
        encryptCardNumber(data.cardNumber),
        data.cardholderName,
        data.expiryMonth,
        data.expiryYear,
        data.creditLimit,
        data.color || CATEGORY_DEFAULT_COLOR,
        data.cardType || "credit",
      ],
    },
  });
  const insertId =
    result && typeof result === "object" && "insertId" in result
      ? (result as { insertId: number }).insertId
      : 0;
  if (!insertId) {
    return null;
  }
  return getCreditCardById(insertId, data.userId);
}

/**
 * Scoped by `userId` — previously keyed on `id` alone, which let any
 * authenticated user read another user's card metadata and even overwrite
 * their stored PAN (QA report SP-002).
 */
export async function updateCreditCard(
  id: number,
  userId: number,
  data: Partial<InsertCreditCard>,
): Promise<SafeCreditCard | null> {
  const payload: Partial<InsertCreditCard> = { ...data };
  if (payload.cardNumber !== undefined) {
    payload.cardNumber = encryptCardNumber(payload.cardNumber);
  }

  const { clause, values } = buildUpdate("creditCards", payload);

  if (clause) {
    await callDataApi("Database/query", {
      body: {
        query: `UPDATE creditCards SET ${clause} WHERE id = ? AND userId = ?`,
        params: [...values, id, userId],
      },
    });
  }

  return getCreditCardById(id, userId);
}

export async function deleteCreditCard(id: number, userId: number) {
  await callDataApi("Database/query", {
    body: {
      query: "DELETE FROM creditCards WHERE id = ? AND userId = ?",
      params: [id, userId],
    },
  });
}

export async function getCreditCardById(
  id: number,
  userId: number,
): Promise<SafeCreditCard | null> {
  try {
    const result = await callDataApi("Database/query", {
      body: {
        query: "SELECT * FROM creditCards WHERE id = ? AND userId = ?",
        params: [id, userId],
      },
    });
    const row = Array.isArray(result) ? result[0] : null;
    return row ? toSafeCreditCard(row as CreditCard) : null;
  } catch (error) {
    rethrowReadFailure("getCreditCardById", error);
  }
}

// ============================================================================
// ACCOUNTS
// ============================================================================

export async function getUserAccounts(userId: number): Promise<Account[]> {
  try {
    const result = await callDataApi("Database/query", {
      body: {
        query: "SELECT * FROM accounts WHERE userId = ? ORDER BY name",
        params: [userId],
      },
    });
    return Array.isArray(result) ? (result as Account[]) : [];
  } catch (error) {
    rethrowReadFailure("getUserAccounts", error);
  }
}

export async function createAccount(
  data: InsertAccount,
): Promise<Account | null> {
  const result = await callDataApi("Database/query", {
    body: {
      query: `
        INSERT INTO accounts (userId, name, type, currency, isDefault)
        VALUES (?, ?, ?, ?, ?)
      `,
      params: [
        data.userId,
        data.name,
        data.type,
        data.currency ?? "USD",
        data.isDefault ?? false,
      ],
    },
  });
  const insertId =
    result && typeof result === "object" && "insertId" in result
      ? (result as { insertId: number }).insertId
      : 0;
  if (!insertId) {
    return null;
  }
  return getAccountById(insertId, data.userId);
}

export async function updateAccount(
  id: number,
  userId: number,
  data: Partial<InsertAccount>,
): Promise<Account | null> {
  const updates = Object.entries(data)
    .map(([key]) => `${key} = ?`)
    .join(", ");
  const values = Object.values(data);

  if (updates.length === 0) {
    return getAccountById(id, userId);
  }

  await callDataApi("Database/query", {
    body: {
      query: `UPDATE accounts SET ${updates} WHERE id = ? AND userId = ?`,
      params: [...values, id, userId],
    },
  });

  return getAccountById(id, userId);
}

export async function deleteAccount(id: number, userId: number): Promise<void> {
  await callDataApi("Database/query", {
    body: {
      query: "DELETE FROM accounts WHERE id = ? AND userId = ?",
      params: [id, userId],
    },
  });
}

export async function getAccountById(
  id: number,
  userId: number,
): Promise<Account | null> {
  try {
    const result = await callDataApi("Database/query", {
      body: {
        query: "SELECT * FROM accounts WHERE id = ? AND userId = ?",
        params: [id, userId],
      },
    });
    const row = Array.isArray(result) ? result[0] : null;
    return row ? (row as Account) : null;
  } catch (error) {
    rethrowReadFailure("getAccountById", error);
  }
}

export async function getAccountTransactionCount(
  accountId: number,
  userId: number,
): Promise<number> {
  const result = await callDataApi("Database/query", {
    body: {
      query:
        "SELECT COUNT(*) as txCount FROM transactions WHERE userId = ? AND accountId = ?",
      params: [userId, accountId],
    },
  });
  const row =
    Array.isArray(result) && result.length > 0
      ? (result[0] as Record<string, unknown>)
      : null;
  return Number(row?.txCount ?? 0);
}

export async function getAccountTransferCount(
  accountId: number,
  userId: number,
): Promise<number> {
  const result = await callDataApi("Database/query", {
    body: {
      query:
        "SELECT COUNT(*) as transferCount FROM transfers WHERE userId = ? AND (fromAccountId = ? OR toAccountId = ?)",
      params: [userId, accountId, accountId],
    },
  });
  const row =
    Array.isArray(result) && result.length > 0
      ? (result[0] as Record<string, unknown>)
      : null;
  return Number(row?.transferCount ?? 0);
}

export async function createTransfer(
  data: InsertTransfer,
): Promise<Transfer | null> {
  const result = await callDataApi("Database/query", {
    body: {
      query: `
        INSERT INTO transfers (userId, fromAccountId, toAccountId, amount, description, date)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      params: [
        data.userId,
        data.fromAccountId,
        data.toAccountId,
        data.amount,
        data.description || null,
        data.date,
      ],
    },
  });
  const insertId =
    result && typeof result === "object" && "insertId" in result
      ? (result as { insertId: number }).insertId
      : 0;
  if (!insertId) {
    return null;
  }
  return getTransferById(insertId, data.userId);
}

export async function getTransferById(
  id: number,
  userId: number,
): Promise<Transfer | null> {
  try {
    const result = await callDataApi("Database/query", {
      body: {
        query: "SELECT * FROM transfers WHERE id = ? AND userId = ?",
        params: [id, userId],
      },
    });
    const row = Array.isArray(result) ? result[0] : null;
    return row ? (row as Transfer) : null;
  } catch (error) {
    rethrowReadFailure("getTransferById", error);
  }
}

export async function getUserTransfers(userId: number): Promise<Transfer[]> {
  try {
    const result = await callDataApi("Database/query", {
      body: {
        query:
          "SELECT * FROM transfers WHERE userId = ? ORDER BY date DESC, id DESC",
        params: [userId],
      },
    });
    return Array.isArray(result) ? (result as Transfer[]) : [];
  } catch (error) {
    rethrowReadFailure("getUserTransfers", error);
  }
}

export async function reassignAccountTransfers(
  fromAccountId: number,
  toAccountId: number,
  userId: number,
): Promise<void> {
  // Direct legs between source and target are absorbed when merging accounts.
  await callDataApi("Database/query", {
    body: {
      query:
        "DELETE FROM transfers WHERE userId = ? AND fromAccountId = ? AND toAccountId = ?",
      params: [userId, fromAccountId, toAccountId],
    },
  });
  await callDataApi("Database/query", {
    body: {
      query:
        "DELETE FROM transfers WHERE userId = ? AND fromAccountId = ? AND toAccountId = ?",
      params: [userId, toAccountId, fromAccountId],
    },
  });
  await callDataApi("Database/query", {
    body: {
      query:
        "UPDATE transfers SET fromAccountId = ? WHERE userId = ? AND fromAccountId = ?",
      params: [toAccountId, userId, fromAccountId],
    },
  });
  await callDataApi("Database/query", {
    body: {
      query:
        "UPDATE transfers SET toAccountId = ? WHERE userId = ? AND toAccountId = ?",
      params: [toAccountId, userId, fromAccountId],
    },
  });
}

export async function reassignAccountTransactions(
  fromAccountId: number,
  toAccountId: number,
  userId: number,
): Promise<void> {
  await callDataApi("Database/query", {
    body: {
      query:
        "UPDATE transactions SET accountId = ? WHERE userId = ? AND accountId = ?",
      params: [toAccountId, userId, fromAccountId],
    },
  });
}

export async function reassignAndDeleteAccount(
  accountId: number,
  targetAccountId: number,
  userId: number,
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
export async function ensureDefaultAccount(userId: number): Promise<void> {
  const countResult = await callDataApi("Database/query", {
    body: {
      query: "SELECT COUNT(*) as accountCount FROM accounts WHERE userId = ?",
      params: [userId],
    },
  });

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

  await callDataApi("Database/query", {
    body: {
      query:
        "UPDATE transactions SET accountId = ? WHERE userId = ? AND accountId IS NULL",
      params: [created.id, userId],
    },
  });
}

// ============================================================================
// TRANSACTIONS
// ============================================================================

export async function getUserTransactions(
  userId: number,
  limit?: number,
  offset?: number,
) {
  try {
    let query =
      "SELECT * FROM transactions WHERE userId = ? ORDER BY date DESC";
    const params: unknown[] = [userId];

    if (limit) {
      query += " LIMIT ?";
      params.push(limit);
    }
    if (offset) {
      query += " OFFSET ?";
      params.push(offset);
    }

    const result = await callDataApi("Database/query", {
      body: { query, params },
    });
    return Array.isArray(result) ? result : [];
  } catch (error) {
    rethrowReadFailure("getUserTransactions", error);
  }
}

export async function getTransactionsByDateRange(
  userId: number,
  startDate: Date,
  endDate: Date,
) {
  try {
    const result = await callDataApi("Database/query", {
      body: {
        query:
          "SELECT * FROM transactions WHERE userId = ? AND date >= ? AND date <= ? ORDER BY date DESC",
        params: [userId, startDate, endDate],
      },
    });
    return Array.isArray(result) ? result : [];
  } catch (error) {
    rethrowReadFailure("getTransactionsByDateRange", error);
  }
}

export async function getTransactionsByCategory(
  userId: number,
  categoryId: number,
) {
  try {
    const result = await callDataApi("Database/query", {
      body: {
        query:
          "SELECT * FROM transactions WHERE userId = ? AND categoryId = ? ORDER BY date DESC",
        params: [userId, categoryId],
      },
    });
    return Array.isArray(result) ? result : [];
  } catch (error) {
    rethrowReadFailure("getTransactionsByCategory", error);
  }
}

export async function getTransactionsByCreditCard(
  userId: number,
  creditCardId: number,
) {
  try {
    const result = await callDataApi("Database/query", {
      body: {
        query:
          "SELECT * FROM transactions WHERE userId = ? AND creditCardId = ? ORDER BY date DESC",
        params: [userId, creditCardId],
      },
    });
    return Array.isArray(result) ? result : [];
  } catch (error) {
    rethrowReadFailure("getTransactionsByCreditCard", error);
  }
}

export async function createTransaction(data: InsertTransaction) {
  const result = await callDataApi("Database/query", {
    body: {
      query: `
        INSERT INTO transactions (userId, categoryId, creditCardId, accountId, type, amount, description, date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        data.userId,
        data.categoryId,
        data.creditCardId || null,
        data.accountId ?? null,
        data.type,
        data.amount,
        data.description || null,
        data.date,
      ],
    },
  });
  return result && typeof result === "object" && "insertId" in result
    ? (result as { insertId: number }).insertId
    : 0;
}

export async function createTransactionsBulk(rows: InsertTransaction[]) {
  if (rows.length === 0) return 0;

  const params = rows.flatMap((data) => [
    data.userId,
    data.categoryId,
    data.creditCardId || null,
    data.accountId ?? null,
    data.type,
    data.amount,
    data.description || null,
    data.date,
  ]);

  await callDataApi("Database/query", {
    body: {
      query: `
        INSERT INTO transactions (userId, categoryId, creditCardId, accountId, type, amount, description, date)
        VALUES ${rows.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(", ")}
      `,
      params,
    },
  });
  return rows.length;
}

export async function updateTransaction(
  id: number,
  userId: number,
  data: Partial<InsertTransaction>,
) {
  const entries = Object.entries(data);
  // No fields to update — avoid emitting `SET  WHERE ...` (invalid SQL).
  if (entries.length === 0) {
    return;
  }
  const updates = entries.map(([key]) => `${key} = ?`).join(", ");
  const values = entries.map(([, value]) => value);

  await callDataApi("Database/query", {
    body: {
      query: `UPDATE transactions SET ${updates} WHERE id = ? AND userId = ?`,
      params: [...values, id, userId],
    },
  });
}

export async function deleteTransaction(id: number, userId: number) {
  await callDataApi("Database/query", {
    body: {
      query: "DELETE FROM transactions WHERE id = ? AND userId = ?",
      params: [id, userId],
    },
  });
}

/** Wipes all user-owned rows. Three separate DELETEs (not transactional) — on partial failure, retry clears any remainder. */
export async function deleteAllUserData(userId: number) {
  await callDataApi("Database/query", {
    body: {
      query: "DELETE FROM recurringTransactions WHERE userId = ?",
      params: [userId],
    },
  });
  await callDataApi("Database/query", {
    body: {
      query: "DELETE FROM transactions WHERE userId = ?",
      params: [userId],
    },
  });
  await callDataApi("Database/query", {
    body: {
      query: "DELETE FROM transfers WHERE userId = ?",
      params: [userId],
    },
  });
  await callDataApi("Database/query", {
    body: {
      query: "DELETE FROM accounts WHERE userId = ?",
      params: [userId],
    },
  });
  await callDataApi("Database/query", {
    body: {
      query: "DELETE FROM creditCards WHERE userId = ?",
      params: [userId],
    },
  });
  await callDataApi("Database/query", {
    body: {
      query: "DELETE FROM categories WHERE userId = ?",
      params: [userId],
    },
  });
}

export async function getTransactionById(id: number, userId: number) {
  try {
    const result = await callDataApi("Database/query", {
      body: {
        query: "SELECT * FROM transactions WHERE id = ? AND userId = ?",
        params: [id, userId],
      },
    });
    return Array.isArray(result) ? result[0] : null;
  } catch (error) {
    rethrowReadFailure("getTransactionById", error);
  }
}

// ============================================================================
// RECURRING TRANSACTIONS
// ============================================================================

export async function getUserRecurringTransactions(
  userId: number,
): Promise<RecurringTransaction[]> {
  try {
    const result = await callDataApi("Database/query", {
      body: {
        query:
          "SELECT * FROM recurringTransactions WHERE userId = ? ORDER BY createdAt DESC",
        params: [userId],
      },
    });
    return Array.isArray(result) ? (result as RecurringTransaction[]) : [];
  } catch (error) {
    rethrowReadFailure("getUserRecurringTransactions", error);
  }
}

export async function createRecurringTransaction(
  data: InsertRecurringTransaction,
): Promise<number> {
  const result = await callDataApi("Database/query", {
    body: {
      query: `
        INSERT INTO recurringTransactions (
          userId, categoryId, creditCardId, type, amount, description, frequency, \`interval\`,
          endCondition, occurrenceCount, endDate, startDate, nextRunDate, lastRunDate,
          generatedCount, isActive
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
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
    },
  });
  return result && typeof result === "object" && "insertId" in result
    ? (result as { insertId: number }).insertId
    : 0;
}

function sqlColumnName(column: string): string {
  return column === "interval" ? "`interval`" : column;
}

export async function updateRecurringTransaction(
  id: number,
  userId: number,
  data: Partial<InsertRecurringTransaction>,
): Promise<void> {
  const updates = Object.entries(data)
    .map(([key]) => `${sqlColumnName(key)} = ?`)
    .join(", ");
  if (!updates) {
    return;
  }
  const values = Object.values(data);
  await callDataApi("Database/query", {
    body: {
      query: `UPDATE recurringTransactions SET ${updates} WHERE id = ? AND userId = ?`,
      params: [...values, id, userId],
    },
  });
}

export async function deleteRecurringTransaction(
  id: number,
  userId: number,
): Promise<void> {
  await callDataApi("Database/query", {
    body: {
      query: "DELETE FROM recurringTransactions WHERE id = ? AND userId = ?",
      params: [id, userId],
    },
  });
}

export async function getRecurringTransactionById(
  id: number,
  userId: number,
): Promise<RecurringTransaction | null> {
  try {
    const result = await callDataApi("Database/query", {
      body: {
        query:
          "SELECT * FROM recurringTransactions WHERE id = ? AND userId = ?",
        params: [id, userId],
      },
    });
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
    const result = await callDataApi("Database/query", {
      body: {
        query:
          "SELECT * FROM recurringTransactions WHERE isActive = 1 AND nextRunDate <= ? ORDER BY nextRunDate ASC",
        params: [now],
      },
    });
    return Array.isArray(result) ? (result as RecurringTransaction[]) : [];
  } catch (error) {
    rethrowReadFailure("getDueRecurringTransactions", error);
  }
}

export async function advanceRecurringTransaction(
  id: number,
  updates: Pick<
    InsertRecurringTransaction,
    "nextRunDate" | "lastRunDate" | "generatedCount" | "isActive"
  >,
): Promise<void> {
  await callDataApi("Database/query", {
    body: {
      query: `
        UPDATE recurringTransactions
        SET nextRunDate = ?, lastRunDate = ?, generatedCount = ?, isActive = ?
        WHERE id = ?
      `,
      params: [
        updates.nextRunDate,
        updates.lastRunDate ?? null,
        updates.generatedCount,
        updates.isActive,
        id,
      ],
    },
  });
}

// ============================================================================
// BUDGETS
// ============================================================================

export async function getUserBudgets(userId: number): Promise<Budget[]> {
  try {
    const result = await callDataApi("Database/query", {
      body: {
        query: "SELECT * FROM budgets WHERE userId = ? ORDER BY createdAt DESC",
        params: [userId],
      },
    });
    return Array.isArray(result) ? (result as Budget[]) : [];
  } catch (error) {
    rethrowReadFailure("getUserBudgets", error);
  }
}

export async function createBudget(data: InsertBudget): Promise<number> {
  const result = await callDataApi("Database/query", {
    body: {
      query: `
        INSERT INTO budgets (userId, categoryId, period, amount, startDate, endDate)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      params: [
        data.userId,
        data.categoryId,
        data.period,
        data.amount,
        data.startDate ?? null,
        data.endDate ?? null,
      ],
    },
  });
  return result && typeof result === "object" && "insertId" in result
    ? (result as { insertId: number }).insertId
    : 0;
}

export async function updateBudget(
  id: number,
  userId: number,
  data: Partial<InsertBudget>,
): Promise<void> {
  const updates = Object.entries(data)
    .map(([key]) => `${key} = ?`)
    .join(", ");
  const values = Object.values(data);

  if (updates.length === 0) {
    return;
  }

  await callDataApi("Database/query", {
    body: {
      query: `UPDATE budgets SET ${updates} WHERE id = ? AND userId = ?`,
      params: [...values, id, userId],
    },
  });
}

export async function deleteBudget(id: number, userId: number): Promise<void> {
  await callDataApi("Database/query", {
    body: {
      query: "DELETE FROM budgets WHERE id = ? AND userId = ?",
      params: [id, userId],
    },
  });
}

export async function getBudgetById(
  id: number,
  userId: number,
): Promise<Budget | null> {
  try {
    const result = await callDataApi("Database/query", {
      body: {
        query: "SELECT * FROM budgets WHERE id = ? AND userId = ?",
        params: [id, userId],
      },
    });
    const row = Array.isArray(result) ? result[0] : null;
    return row ? (row as Budget) : null;
  } catch (error) {
    rethrowReadFailure("getBudgetById", error);
  }
}

export interface BudgetProgressRow {
  budgetId: number;
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
  userId: number,
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
        const result = await callDataApi("Database/query", {
          body: {
            query:
              "SELECT amount FROM transactions WHERE userId = ? AND type = 'expense' AND categoryId = ? AND date >= ? AND date <= ?",
            params: [userId, budget.categoryId, start, end],
          },
        });

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
  userId: number,
  categoryId: number,
  period: "monthly" | "weekly",
  options?: { excludeId?: number },
): Promise<Budget | null> {
  try {
    const excludeClause = options?.excludeId != null ? " AND id <> ?" : "";
    const params: (number | string)[] = [userId, categoryId, period];
    if (options?.excludeId != null) {
      params.push(options.excludeId);
    }

    const result = await callDataApi("Database/query", {
      body: {
        query: `
          SELECT * FROM budgets
          WHERE userId = ? AND categoryId = ? AND period = ?
            AND (startDate IS NULL OR startDate <= NOW())
            AND (endDate IS NULL OR endDate >= NOW())
            ${excludeClause}
          LIMIT 1
        `,
        params,
      },
    });
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
  userId: number,
  year: number,
  month: number,
) {
  try {
    const result = await callDataApi("Database/query", {
      body: {
        query:
          "SELECT * FROM monthlySummaries WHERE userId = ? AND year = ? AND month = ?",
        params: [userId, year, month],
      },
    });
    return Array.isArray(result) ? result[0] : null;
  } catch (error) {
    rethrowReadFailure("getMonthlySummary", error);
  }
}

export async function createMonthlySummary(data: InsertMonthlySummary) {
  const result = await callDataApi("Database/query", {
    body: {
      query: `
        INSERT INTO monthlySummaries (userId, year, month, totalIncome, totalExpense, netBalance)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      params: [
        data.userId,
        data.year,
        data.month,
        data.totalIncome || 0,
        data.totalExpense || 0,
        data.netBalance || 0,
      ],
    },
  });
  return result && typeof result === "object" && "insertId" in result
    ? (result as { insertId: number }).insertId
    : 0;
}

export async function updateMonthlySummary(
  id: number,
  data: Partial<InsertMonthlySummary>,
) {
  const updates = Object.entries(data)
    .map(([key]) => `${key} = ?`)
    .join(", ");
  const values = Object.values(data);

  await callDataApi("Database/query", {
    body: {
      query: `UPDATE monthlySummaries SET ${updates} WHERE id = ?`,
      params: [...values, id],
    },
  });
}

// ============================================================================
// AGGREGATE QUERIES
// ============================================================================

/**
 * Derive per-account balances from all user transactions (JS reduce, no GROUP BY).
 */
export async function getAccountBalances(
  userId: number,
): Promise<Record<number, number>> {
  try {
    const result = await callDataApi("Database/query", {
      body: {
        query:
          "SELECT id, accountId, type, amount FROM transactions WHERE userId = ?",
        params: [userId],
      },
    });

    const rows = Array.isArray(result) ? result : [];
    const txnBalances = reduceAccountBalances(
      rows.map((row: Record<string, unknown>) => ({
        accountId:
          row.accountId == null ? null : Number(row.accountId as number),
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
export async function getMonthlyStats(
  userId: number,
  year: number,
  month: number,
) {
  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const result = await callDataApi("Database/query", {
      body: {
        query:
          "SELECT * FROM transactions WHERE userId = ? AND date >= ? AND date <= ?",
        params: [userId, startDate, endDate],
      },
    });

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
  userId: number,
  year: number,
  month: number,
  count = 6,
): Promise<MonthlyTrendPoint[]> {
  try {
    const startDate = new Date(year, month - count, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const result = await callDataApi("Database/query", {
      body: {
        query:
          "SELECT * FROM transactions WHERE userId = ? AND date >= ? AND date <= ?",
        params: [userId, startDate, endDate],
      },
    });

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
  categoryId: number;
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
  userId: number,
  year: number,
  month: number,
  lookbackMonths = 3,
  threshold = DEFAULT_ANOMALY_THRESHOLD,
): Promise<CategoryAnomalyResult[]> {
  try {
    const startDate = new Date(year, month - 1 - lookbackMonths, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const result = await callDataApi("Database/query", {
      body: {
        query:
          "SELECT * FROM transactions WHERE userId = ? AND type = 'expense' AND date >= ? AND date <= ?",
        params: [userId, startDate, endDate],
      },
    });

    const txns = Array.isArray(result) ? result : [];
    const monthSpend = new Map<string, Map<number, number>>();

    txns.forEach((txn: Record<string, unknown>) => {
      const txnDate = new Date(txn.date as string);
      const key = monthKeyFromDate(txnDate);
      const categoryId = txn.categoryId as number;
      const amount = parseFloat(txn.amount as string);
      const bucket = monthSpend.get(key) ?? new Map<number, number>();
      bucket.set(categoryId, (bucket.get(categoryId) ?? 0) + amount);
      monthSpend.set(key, bucket);
    });

    const targetKey = monthKey(year, month);
    const targetSpend = monthSpend.get(targetKey) ?? new Map<number, number>();
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
  userId: number,
  year: number,
  month: number,
) {
  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const result = await callDataApi("Database/query", {
      body: {
        query:
          "SELECT * FROM transactions WHERE userId = ? AND type = 'expense' AND date >= ? AND date <= ?",
        params: [userId, startDate, endDate],
      },
    });

    const txns = Array.isArray(result) ? result : [];
    const categoryMap = new Map<number, { total: number; count: number }>();

    txns.forEach((txn: Record<string, unknown>) => {
      const amount = parseFloat(txn.amount as string);
      const categoryId = txn.categoryId as number;
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
export async function getRecentTransactions(userId: number, limit: number = 7) {
  try {
    const result = await callDataApi("Database/query", {
      body: {
        query:
          "SELECT * FROM transactions WHERE userId = ? ORDER BY date DESC LIMIT ?",
        params: [userId, limit],
      },
    });
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

export async function getUserLoans(userId: number): Promise<Loan[]> {
  try {
    const result = await callDataApi("Database/query", {
      body: {
        query: "SELECT * FROM loans WHERE userId = ? ORDER BY createdAt DESC",
        params: [userId],
      },
    });
    return Array.isArray(result) ? (result as Loan[]) : [];
  } catch (error) {
    rethrowReadFailure("getUserLoans", error);
  }
}

export async function createLoan(data: InsertLoan): Promise<Loan | null> {
  const result = await callDataApi("Database/query", {
    body: {
      query: `
        INSERT INTO loans (
          userId, direction, counterparty, principal, rate, periodicity,
          installmentCount, endDate, nextDueDate, status, note
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
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
    },
  });
  const insertId =
    result && typeof result === "object" && "insertId" in result
      ? (result as { insertId: number }).insertId
      : 0;
  if (!insertId) {
    return null;
  }
  return getLoanById(insertId, data.userId);
}

export async function getLoanById(
  id: number,
  userId: number,
): Promise<Loan | null> {
  try {
    const result = await callDataApi("Database/query", {
      body: {
        query: "SELECT * FROM loans WHERE id = ? AND userId = ?",
        params: [id, userId],
      },
    });
    const row = Array.isArray(result) ? result[0] : null;
    return row ? (row as Loan) : null;
  } catch (error) {
    rethrowReadFailure("getLoanById", error);
  }
}

export async function updateLoan(
  id: number,
  userId: number,
  data: Partial<InsertLoan>,
): Promise<void> {
  const updates = Object.entries(data)
    .map(([key]) => `${key} = ?`)
    .join(", ");
  const values = Object.values(data);

  if (updates.length === 0) {
    return;
  }

  await callDataApi("Database/query", {
    body: {
      query: `UPDATE loans SET ${updates} WHERE id = ? AND userId = ?`,
      params: [...values, id, userId],
    },
  });
}

export async function deleteLoan(id: number, userId: number): Promise<void> {
  await callDataApi("Database/query", {
    body: {
      query: "DELETE FROM loans WHERE id = ? AND userId = ?",
      params: [id, userId],
    },
  });
}

export async function createRepayment(
  data: InsertRepayment,
): Promise<Repayment | null> {
  const loan = await getLoanById(data.loanId, data.userId);
  if (!loan) {
    return null;
  }

  const result = await callDataApi("Database/query", {
    body: {
      query: `
        INSERT INTO repayments (loanId, userId, amount, date, note)
        VALUES (?, ?, ?, ?, ?)
      `,
      params: [
        data.loanId,
        data.userId,
        data.amount,
        data.date,
        data.note ?? null,
      ],
    },
  });
  const insertId =
    result && typeof result === "object" && "insertId" in result
      ? (result as { insertId: number }).insertId
      : 0;
  if (!insertId) {
    return null;
  }
  return getRepaymentById(insertId, data.userId);
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

  const result = await callDataApi("Database/query", {
    body: {
      query: `
        INSERT INTO repayments (loanId, userId, amount, date, note)
        VALUES (?, ?, ?, ?, ?)
      `,
      params: [
        data.loanId,
        data.userId,
        data.amount,
        data.date,
        data.note ?? null,
      ],
    },
  });
  const insertId =
    result && typeof result === "object" && "insertId" in result
      ? (result as { insertId: number }).insertId
      : 0;
  if (!insertId) {
    return null;
  }

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
  id: number,
  userId: number,
): Promise<Repayment | null> {
  try {
    const result = await callDataApi("Database/query", {
      body: {
        query: "SELECT * FROM repayments WHERE id = ? AND userId = ?",
        params: [id, userId],
      },
    });
    const row = Array.isArray(result) ? result[0] : null;
    return row ? (row as Repayment) : null;
  } catch (error) {
    rethrowReadFailure("getRepaymentById", error);
  }
}

export async function getRepaymentsByLoan(
  loanId: number,
  userId: number,
): Promise<Repayment[]> {
  try {
    const result = await callDataApi("Database/query", {
      body: {
        query:
          "SELECT * FROM repayments WHERE loanId = ? AND userId = ? ORDER BY date DESC",
        params: [loanId, userId],
      },
    });
    return Array.isArray(result) ? (result as Repayment[]) : [];
  } catch (error) {
    rethrowReadFailure("getRepaymentsByLoan", error);
  }
}

export async function deleteRepayment(
  id: number,
  userId: number,
): Promise<void> {
  await callDataApi("Database/query", {
    body: {
      query: "DELETE FROM repayments WHERE id = ? AND userId = ?",
      params: [id, userId],
    },
  });
}

export async function getLoanWithBalance(
  id: number,
  userId: number,
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

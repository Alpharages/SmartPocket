import { eq, and, gte, lte, desc } from "drizzle-orm";
import { callDataApi } from "./_core/dataApi";
import {
  decryptCardNumber,
  encryptCardNumber,
  maskCardNumber,
} from "./_core/crypto";
import { DEFAULT_CATEGORIES } from "./_core/default-categories";
import { CATEGORY_DEFAULT_COLOR, getCategoryColorForName } from "@shared/theme";
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
  Category,
  CreditCard,
  Transaction,
  Budget,
  MonthlySummary,
  User,
  RecurringTransaction,
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
): Promise<{ aiEnabled: boolean }> {
  const result = await callDataApi("Database/query", {
    body: {
      query: "SELECT aiEnabled FROM users WHERE id = ?",
      params: [userId],
    },
  });

  const row = result && Array.isArray(result) ? result[0] : null;
  if (!row) {
    return { aiEnabled: false };
  }

  return { aiEnabled: coerceDbBoolean(row.aiEnabled) };
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
  } catch {
    return [];
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
        data.icon || "tag",
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

export async function updateCategory(
  id: number,
  data: Partial<InsertCategory>,
) {
  const updates = Object.entries(data)
    .map(([key]) => `${key} = ?`)
    .join(", ");
  const values = Object.values(data);

  await callDataApi("Database/query", {
    body: {
      query: `UPDATE categories SET ${updates} WHERE id = ?`,
      params: [...values, id],
    },
  });
}

export async function deleteCategory(id: number) {
  await callDataApi("Database/query", {
    body: {
      query: "DELETE FROM categories WHERE id = ?",
      params: [id],
    },
  });
}

export async function getCategoryById(id: number) {
  try {
    const result = await callDataApi("Database/query", {
      body: {
        query: "SELECT * FROM categories WHERE id = ?",
        params: [id],
      },
    });
    return Array.isArray(result) ? result[0] : null;
  } catch {
    return null;
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
  } catch {
    return [];
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
  return getCreditCardById(insertId);
}

export async function updateCreditCard(
  id: number,
  data: Partial<InsertCreditCard>,
): Promise<SafeCreditCard | null> {
  const payload: Partial<InsertCreditCard> = { ...data };
  if (payload.cardNumber !== undefined) {
    payload.cardNumber = encryptCardNumber(payload.cardNumber);
  }

  const updates = Object.entries(payload)
    .map(([key]) => `${key} = ?`)
    .join(", ");
  const values = Object.values(payload);

  if (updates.length > 0) {
    await callDataApi("Database/query", {
      body: {
        query: `UPDATE creditCards SET ${updates} WHERE id = ?`,
        params: [...values, id],
      },
    });
  }

  return getCreditCardById(id);
}

export async function deleteCreditCard(id: number) {
  await callDataApi("Database/query", {
    body: {
      query: "DELETE FROM creditCards WHERE id = ?",
      params: [id],
    },
  });
}

export async function getCreditCardById(
  id: number,
): Promise<SafeCreditCard | null> {
  try {
    const result = await callDataApi("Database/query", {
      body: {
        query: "SELECT * FROM creditCards WHERE id = ?",
        params: [id],
      },
    });
    const row = Array.isArray(result) ? result[0] : null;
    return row ? toSafeCreditCard(row as CreditCard) : null;
  } catch {
    return null;
  }
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
  } catch {
    return [];
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
  } catch {
    return [];
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
  } catch {
    return [];
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
  } catch {
    return [];
  }
}

export async function createTransaction(data: InsertTransaction) {
  const result = await callDataApi("Database/query", {
    body: {
      query: `
        INSERT INTO transactions (userId, categoryId, creditCardId, type, amount, description, date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        data.userId,
        data.categoryId,
        data.creditCardId || null,
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

export async function updateTransaction(
  id: number,
  data: Partial<InsertTransaction>,
) {
  const updates = Object.entries(data)
    .map(([key]) => `${key} = ?`)
    .join(", ");
  const values = Object.values(data);

  await callDataApi("Database/query", {
    body: {
      query: `UPDATE transactions SET ${updates} WHERE id = ?`,
      params: [...values, id],
    },
  });
}

export async function deleteTransaction(id: number) {
  await callDataApi("Database/query", {
    body: {
      query: "DELETE FROM transactions WHERE id = ?",
      params: [id],
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

export async function getTransactionById(id: number) {
  try {
    const result = await callDataApi("Database/query", {
      body: {
        query: "SELECT * FROM transactions WHERE id = ?",
        params: [id],
      },
    });
    return Array.isArray(result) ? result[0] : null;
  } catch {
    return null;
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
  } catch {
    return [];
  }
}

export async function createRecurringTransaction(
  data: InsertRecurringTransaction,
): Promise<number> {
  const result = await callDataApi("Database/query", {
    body: {
      query: `
        INSERT INTO recurringTransactions (
          userId, categoryId, creditCardId, type, amount, description, frequency, interval,
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

export async function updateRecurringTransaction(
  id: number,
  userId: number,
  data: Partial<InsertRecurringTransaction>,
): Promise<void> {
  const updates = Object.entries(data)
    .map(([key]) => `${key} = ?`)
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
  } catch {
    return null;
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
  } catch {
    return [];
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
  } catch {
    return [];
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
  } catch {
    return null;
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
  } catch {
    return null;
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
  } catch {
    return null;
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
  } catch {
    return { totalIncome: 0, totalExpense: 0, netBalance: 0 };
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
  } catch {
    return [];
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
  } catch {
    return [];
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
  } catch {
    return [];
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
  } catch {
    return [];
  }
}

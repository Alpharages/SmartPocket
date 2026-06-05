import { eq, and, gte, lte, desc } from "drizzle-orm";
import { callDataApi } from "./_core/dataApi";
import {
  CATEGORY_DEFAULT_COLOR,
  getCategoryColorForName,
} from "@shared/theme";
import {
  categories,
  creditCards,
  transactions,
  monthlySummaries,
  users,
  InsertCategory,
  InsertCreditCard,
  InsertTransaction,
  InsertMonthlySummary,
  Category,
  CreditCard,
  Transaction,
  MonthlySummary,
  User,
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

export async function getUserCreditCards(userId: number) {
  try {
    const result = await callDataApi("Database/query", {
      body: {
        query: "SELECT * FROM creditCards WHERE userId = ? ORDER BY name",
        params: [userId],
      },
    });
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
}

export async function createCreditCard(data: InsertCreditCard) {
  const result = await callDataApi("Database/query", {
    body: {
      query: `
        INSERT INTO creditCards (userId, name, cardNumber, cardholderName, expiryMonth, expiryYear, creditLimit, color, cardType)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        data.userId,
        data.name,
        data.cardNumber,
        data.cardholderName,
        data.expiryMonth,
        data.expiryYear,
        data.creditLimit,
        data.color || CATEGORY_DEFAULT_COLOR,
        data.cardType || "credit",
      ],
    },
  });
  return result && typeof result === "object" && "insertId" in result
    ? (result as { insertId: number }).insertId
    : 0;
}

export async function updateCreditCard(
  id: number,
  data: Partial<InsertCreditCard>,
) {
  const updates = Object.entries(data)
    .map(([key]) => `${key} = ?`)
    .join(", ");
  const values = Object.values(data);

  await callDataApi("Database/query", {
    body: {
      query: `UPDATE creditCards SET ${updates} WHERE id = ?`,
      params: [...values, id],
    },
  });
}

export async function deleteCreditCard(id: number) {
  await callDataApi("Database/query", {
    body: {
      query: "DELETE FROM creditCards WHERE id = ?",
      params: [id],
    },
  });
}

export async function getCreditCardById(id: number) {
  try {
    const result = await callDataApi("Database/query", {
      body: {
        query: "SELECT * FROM creditCards WHERE id = ?",
        params: [id],
      },
    });
    return Array.isArray(result) ? result[0] : null;
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

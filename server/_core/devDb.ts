import { encryptCardNumber } from "./crypto";

/**
 * Dev-only in-memory database shim.
 *
 * When the app runs without Manus Forge credentials (local dev), `dataApi.ts`
 * routes every `Database/query` call here instead of to the platform database.
 * This implements just enough of a MySQL-ish executor to satisfy the finite set
 * of statements issued by `server/db.ts` (SELECT / INSERT / UPDATE / DELETE plus
 * `INSERT ... ON DUPLICATE KEY UPDATE` for users).
 *
 * The store is in-memory and seeded with sample data for the dev user so the
 * built screens (dashboard, transactions, categories, cards, insights) are
 * immediately populated. State resets on server restart — this is a local QA /
 * development harness, not a persistence layer.
 */

type Row = Record<string, unknown>;

type TableName =
  | "users"
  | "categories"
  | "creditCards"
  | "transactions"
  | "budgets"
  | "monthlySummaries";

const DATE_COLUMNS = new Set([
  "createdAt",
  "updatedAt",
  "lastSignedIn",
  "date",
  "startDate",
  "endDate",
]);
const NUMERIC_COLUMNS = new Set([
  "id",
  "userId",
  "categoryId",
  "creditCardId",
  "year",
  "month",
  "expiryMonth",
  "expiryYear",
]);

const store: Record<TableName, Row[]> = {
  users: [],
  categories: [],
  creditCards: [],
  transactions: [],
  budgets: [],
  monthlySummaries: [],
};

const nextId: Record<TableName, number> = {
  users: 1,
  categories: 1,
  creditCards: 1,
  transactions: 1,
  budgets: 1,
  monthlySummaries: 1,
};

function insertRow(table: TableName, row: Row): number {
  const id = nextId[table]++;
  store[table].push({ id, ...row });
  return id;
}

// ---------------------------------------------------------------------------
// Seed: one dev user (id 1) + sample categories, a card, and transactions so
// the screens have realistic content for visual QA.
// ---------------------------------------------------------------------------
let seeded = false;
function seedOnce() {
  if (seeded) return;
  seeded = true;

  const now = new Date();
  insertRow("users", {
    openId: "dev_local_user",
    name: "Dev User",
    email: "dev@localhost",
    loginMethod: "dev",
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  });

  const cat = (
    name: string,
    type: "income" | "expense",
    color: string,
    icon: string,
  ) =>
    insertRow("categories", {
      userId: 1,
      name,
      type,
      color,
      icon,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    });

  const groceries = cat("Groceries", "expense", "#10B981", "cart");
  const dining = cat("Dining", "expense", "#F59E0B", "restaurant");
  cat("Transport", "expense", "#06B6D4", "car");
  const salary = cat("Salary", "income", "#6366F1", "cash");

  insertRow("creditCards", {
    userId: 1,
    name: "Everyday Visa",
    cardNumber: encryptCardNumber("4111111111111234"),
    cardholderName: "Dev User",
    expiryMonth: 8,
    expiryYear: 2028,
    creditLimit: "5000.00",
    currentBalance: "0.00",
    color: "#6366F1",
    cardType: "credit",
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  const txn = (
    categoryId: number,
    type: "income" | "expense",
    amount: string,
    description: string,
    daysAgo: number,
  ) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    insertRow("transactions", {
      userId: 1,
      categoryId,
      creditCardId: null,
      type,
      amount,
      description,
      date: d,
      createdAt: d,
      updatedAt: d,
    });
  };

  txn(salary, "income", "3200.00", "Monthly salary", 5);
  txn(groceries, "expense", "84.50", "Weekly groceries", 3);
  txn(dining, "expense", "42.00", "Dinner out", 2);
  txn(groceries, "expense", "23.75", "Snacks", 1);
}

// ---------------------------------------------------------------------------
// Value coercion + comparison helpers
// ---------------------------------------------------------------------------
function coerce(column: string, value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (DATE_COLUMNS.has(column)) {
    return value instanceof Date ? value : new Date(value as string);
  }
  if (NUMERIC_COLUMNS.has(column)) {
    return typeof value === "number" ? value : Number(value);
  }
  return value;
}

function compare(
  column: string,
  left: unknown,
  op: string,
  right: unknown,
): boolean {
  if (DATE_COLUMNS.has(column)) {
    const l =
      left instanceof Date
        ? left.getTime()
        : new Date(left as string).getTime();
    const r =
      right instanceof Date
        ? right.getTime()
        : new Date(right as string).getTime();
    if (op === "=") return l === r;
    if (op === ">=") return l >= r;
    if (op === "<=") return l <= r;
    return false;
  }
  if (NUMERIC_COLUMNS.has(column)) {
    const l = Number(left);
    const r = Number(right);
    if (op === "=") return l === r;
    if (op === ">=") return l >= r;
    if (op === "<=") return l <= r;
    return false;
  }
  // string / default
  if (op === "=") return String(left) === String(right);
  return false;
}

type Condition = {
  column: string;
  op: string;
  literal?: unknown;
  isParam: boolean;
};

/** Parse the WHERE body (already AND-split) into structured conditions. */
function parseConditions(whereBody: string): Condition[] {
  return whereBody
    .split(/\s+AND\s+/i)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const m = part.match(/^(\w+)\s*(>=|<=|=)\s*(.+)$/);
      if (!m) throw new Error(`devDb: unparseable condition "${part}"`);
      const [, column, op, rhsRaw] = m;
      const rhs = rhsRaw.trim();
      if (rhs === "?") return { column, op, isParam: true };
      // literal: quoted string or number
      const unquoted = rhs.replace(/^'(.*)'$/, "$1");
      const literal =
        unquoted === rhs && !Number.isNaN(Number(rhs)) ? Number(rhs) : unquoted;
      return { column, op, literal, isParam: false };
    });
}

function applyWhere(
  rows: Row[],
  conditions: Condition[],
  params: unknown[],
  cursor: { i: number },
): Row[] {
  // Bind params to conditions in order
  const bound = conditions.map((c) => ({
    ...c,
    value: c.isParam ? params[cursor.i++] : c.literal,
  }));
  return rows.filter((row) =>
    bound.every((c) =>
      compare(c.column, row[c.column], c.op, coerce(c.column, c.value)),
    ),
  );
}

function clone(row: Row): Row {
  return { ...row };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------
export async function devQuery(
  sqlRaw: string,
  params: unknown[] = [],
): Promise<unknown> {
  seedOnce();
  const sql = sqlRaw.trim().replace(/\s+/g, " ");

  // SELECT 1 — connectivity probe
  if (/^SELECT\s+1\s*$/i.test(sql)) {
    return [{ "1": 1 }];
  }

  // ---- INSERT ----
  let m = sql.match(
    /^INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]*)\)(.*)$/i,
  );
  if (m) {
    const table = m[1] as TableName;
    const columns = m[2].split(",").map((c) => c.trim());
    const tail = m[4] || "";
    const onDup = /ON\s+DUPLICATE\s+KEY\s+UPDATE/i.test(tail);

    const row: Row = {};
    columns.forEach((col, idx) => {
      row[col] = coerce(col, params[idx]);
    });
    applyInsertDefaults(table, row);

    if (onDup && table === "users") {
      const existing = store.users.find((u) => u.openId === row.openId);
      if (existing) {
        // MySQL ON DUPLICATE KEY UPDATE sets the listed columns to VALUES(col)
        for (const col of columns) {
          if (col === "openId") continue;
          existing[col] = row[col];
        }
        existing.updatedAt = new Date();
        return { insertId: existing.id as number, affectedRows: 2 };
      }
    }

    const insertId = insertRow(table, row);
    return { insertId, affectedRows: 1 };
  }

  // ---- UPDATE ----
  m = sql.match(/^UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+)$/i);
  if (m) {
    const table = m[1] as TableName;
    const setClause = m[2];
    const whereBody = m[3];
    const setCols = setClause
      .split(",")
      .map((s) => s.trim().replace(/\s*=\s*\?$/, ""));
    const cursor = { i: 0 };
    const setValues = setCols.map((col) => coerce(col, params[cursor.i++]));
    const conditions = parseConditions(whereBody);
    const matched = applyWhere(store[table], conditions, params, cursor);
    matched.forEach((row) => {
      setCols.forEach((col, idx) => {
        row[col] = setValues[idx];
      });
      row.updatedAt = new Date();
    });
    return { affectedRows: matched.length };
  }

  // ---- DELETE ----
  m = sql.match(/^DELETE\s+FROM\s+(\w+)\s+WHERE\s+(.+)$/i);
  if (m) {
    const table = m[1] as TableName;
    const conditions = parseConditions(m[2]);
    const cursor = { i: 0 };
    const doomed = new Set(
      applyWhere(store[table], conditions, params, cursor),
    );
    const before = store[table].length;
    store[table] = store[table].filter((row) => !doomed.has(row));
    return { affectedRows: before - store[table].length };
  }

  // ---- SELECT ----
  m = sql.match(
    /^SELECT\s+\*\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+(.+?))?(?:\s+LIMIT\s+\?)?(?:\s+OFFSET\s+\?)?\s*$/i,
  );
  if (m && /^SELECT/i.test(sql)) {
    const table = m[1] as TableName;
    const whereBody = m[2];
    const orderBy = m[3];
    const hasLimit = /\sLIMIT\s+\?/i.test(sql);
    const hasOffset = /\sOFFSET\s+\?/i.test(sql);

    const cursor = { i: 0 };
    let rows = whereBody
      ? applyWhere(store[table], parseConditions(whereBody), params, cursor)
      : [...store[table]];

    if (orderBy) {
      const [col, dirRaw] = orderBy.trim().split(/\s+/);
      const dir = (dirRaw || "ASC").toUpperCase() === "DESC" ? -1 : 1;
      rows = [...rows].sort((a, b) => {
        const av = a[col];
        const bv = b[col];
        if (DATE_COLUMNS.has(col)) {
          return (
            (new Date(av as string).getTime() -
              new Date(bv as string).getTime()) *
            dir
          );
        }
        if (NUMERIC_COLUMNS.has(col)) {
          return (Number(av) - Number(bv)) * dir;
        }
        return String(av).localeCompare(String(bv)) * dir;
      });
    }

    const limit = hasLimit ? Number(params[cursor.i++]) : undefined;
    const offset = hasOffset ? Number(params[cursor.i++]) : undefined;
    if (offset) rows = rows.slice(offset);
    if (limit !== undefined) rows = rows.slice(0, limit);

    return rows.map(clone);
  }

  throw new Error(`devDb: unsupported query: ${sql}`);
}

function applyInsertDefaults(table: TableName, row: Row): void {
  const now = new Date();
  if (!("createdAt" in row) || row.createdAt == null) row.createdAt = now;
  if (!("updatedAt" in row) || row.updatedAt == null) row.updatedAt = now;
  switch (table) {
    case "users":
      if (row.role == null) row.role = "user";
      if (row.lastSignedIn == null) row.lastSignedIn = now;
      break;
    case "categories":
      if (row.icon == null) row.icon = "tag";
      if (row.isDefault == null) row.isDefault = false;
      break;
    case "creditCards":
      if (row.currentBalance == null) row.currentBalance = "0";
      if (row.cardType == null) row.cardType = "credit";
      if (row.isActive == null) row.isActive = true;
      break;
    case "monthlySummaries":
      if (row.totalIncome == null) row.totalIncome = "0";
      if (row.totalExpense == null) row.totalExpense = "0";
      if (row.netBalance == null) row.netBalance = "0";
      break;
  }
}

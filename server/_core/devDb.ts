import { DEFAULT_CATEGORY_ICON } from "../../shared/theme";
import { ulid } from "../../shared/ulid";
import type { Id } from "../../drizzle/schema";

/**
 * Dev-only in-memory database shim.
 *
 * When the app runs without a DATABASE_URL (local dev), `db-query.ts`
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
  | "monthlySummaries"
  | "loans"
  | "repayments"
  | "accounts"
  | "transfers"
  | "recurringTransactions";

const DATE_COLUMNS = new Set([
  "createdAt",
  "updatedAt",
  "lastSignedIn",
  "date",
  "startDate",
  "endDate",
  "nextDueDate",
  "pinLockedUntil",
]);
// Ids left this set when they became ULIDs: `Number("01ARZ3ND…")` is NaN, and a
// NaN on both sides of `=` compares false, so every id-scoped WHERE in the app
// would have silently matched nothing.
const NUMERIC_COLUMNS = new Set([
  "year",
  "month",
  "expiryMonth",
  "expiryYear",
  "installmentCount",
  "pinFailedAttempts",
  "interval",
  "generatedCount",
  "occurrenceCount",
  "serverSeq",
]);

/**
 * Columns MySQL stores as `tinyint(1)`. The app writes them as SQL literals
 * (`dirty = 1`) and reads them back expecting the driver's coercion, so both
 * sides are normalised to a JS boolean here — otherwise `WHERE dirty = 1`
 * would compare the string "true" against "1" in the default branch of
 * `compare` and never match.
 */
const BOOLEAN_COLUMNS = new Set([
  "dirty",
  "isDefault",
  "isActive",
  "aiEnabled",
  "remindersEnabled",
]);

const store: Record<TableName, Row[]> = {
  users: [],
  categories: [],
  creditCards: [],
  transactions: [],
  budgets: [],
  monthlySummaries: [],
  loans: [],
  repayments: [],
  accounts: [],
  transfers: [],
  recurringTransactions: [],
};

/**
 * SP-073: `store[table]` for an unregistered table was `undefined`, so the
 * first `.filter` on it threw `Cannot read properties of undefined` from deep
 * inside `applyWhere` — a stack trace that named neither the table nor the
 * query. Any table added to `drizzle/schema.ts` without a matching entry here
 * fails the same way, so resolve through this and name the problem.
 */
function tableRows(table: TableName): Row[] {
  const rows = store[table];
  if (!rows) {
    throw new Error(
      `devDb: unknown table "${table}" — add it to TableName, store and nextId in server/_core/devDb.ts`,
    );
  }
  return rows;
}

/**
 * Ids arrive with the row now — `server/db.ts` mints a ULID and includes it in
 * the INSERT, exactly as it will against the on-device SQLite. One is minted
 * here only for the seed data below, which builds rows directly.
 */
function insertRow(table: TableName, row: Row): Id {
  const id = (row.id as Id | undefined) ?? ulid();
  tableRows(table).push({ ...row, id });
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
  // The dev user's id is captured rather than assumed to be 1 — ids are ULIDs
  // now, so nothing downstream can hard-code it.
  const devUserId = insertRow("users", {
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
      userId: devUserId,
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
    userId: devUserId,
    name: "Everyday Visa",
    // Plaintext on purpose. `decryptCardNumber` passes anything without the
    // "v1:" prefix straight through (legacy pre-encryption rows), so the dev
    // seed does not need a key at all — and cannot get one, since the
    // per-account key is read through `dbQuery`, which is what this
    // module *is*. It was also being called without `await`, so the seeded
    // value was a Promise rather than a card number.
    cardNumber: "4111111111111234",
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
    categoryId: Id,
    type: "income" | "expense",
    amount: string,
    description: string,
    daysAgo: number,
  ) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    insertRow("transactions", {
      userId: devUserId,
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
  if (BOOLEAN_COLUMNS.has(column)) {
    return value === true || value === 1 || value === "1";
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
  if (BOOLEAN_COLUMNS.has(column)) {
    const toBool = (v: unknown) => v === true || v === 1 || v === "1";
    return op === "=" && toBool(left) === toBool(right);
  }
  // string / default
  if (op === "=") return String(left) === String(right);
  return false;
}

type Condition =
  | {
      kind: "cmp";
      column: string;
      op: string;
      literal?: unknown;
      isParam: boolean;
    }
  | { kind: "isNull"; column: string; negate: boolean }
  // `(<col> IS NULL OR <col> <op> ?)` — the exact shape server/db.ts emits for
  // "not currently locked" guards (Story 13.6 R3). Not a general OR grammar.
  // SP-077: the RHS may also be the literal `NOW()`, which findActiveBudget
  // emits for its active-window guard. `source` says where the comparison
  // value comes from so bindConditions knows whether to consume a `?` param.
  | {
      kind: "orNullOrCmp";
      column: string;
      op: string;
      source: "param" | "now";
    }
  // SP-099: `(<colA> <op> ? OR <colB> <op> ?)` — the shape
  // getAccountTransferCount emits to match a transfer on either side of the
  // pair. Two distinct columns, so it is not the orNullOrCmp shape above.
  | {
      kind: "orTwoCols";
      a: { column: string; op: string };
      b: { column: string; op: string };
    };

/** Parse the WHERE body (already AND-split) into structured conditions. */
function parseConditions(whereBody: string): Condition[] {
  return whereBody
    .split(/\s+AND\s+/i)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part): Condition => {
      const orTwoCols = part.match(
        /^\((\w+)\s*(>=|<=|=)\s*\?\s+OR\s+(\w+)\s*(>=|<=|=)\s*\?\)$/i,
      );
      if (orTwoCols && orTwoCols[1] !== orTwoCols[3]) {
        const [, colA, opA, colB, opB] = orTwoCols;
        return {
          kind: "orTwoCols",
          a: { column: colA, op: opA },
          b: { column: colB, op: opB },
        };
      }

      const orGroup = part.match(
        /^\((\w+)\s+IS\s+NULL\s+OR\s+\1\s*(>=|<=|=)\s*(\?|NOW\(\))\)$/i,
      );
      if (orGroup) {
        const [, column, op, rhs] = orGroup;
        return {
          kind: "orNullOrCmp",
          column,
          op,
          source: rhs === "?" ? "param" : "now",
        };
      }

      const isNotNull = part.match(/^(\w+)\s+IS\s+NOT\s+NULL$/i);
      if (isNotNull) {
        return { kind: "isNull", column: isNotNull[1], negate: true };
      }

      const isNull = part.match(/^(\w+)\s+IS\s+NULL$/i);
      if (isNull) {
        return { kind: "isNull", column: isNull[1], negate: false };
      }

      const m = part.match(/^(\w+)\s*(>=|<=|=)\s*(.+)$/);
      if (!m) throw new Error(`devDb: unparseable condition "${part}"`);
      const [, column, op, rhsRaw] = m;
      const rhs = rhsRaw.trim();
      if (rhs === "?") return { kind: "cmp", column, op, isParam: true };
      // literal: quoted string or number
      const unquoted = rhs.replace(/^'(.*)'$/, "$1");
      const literal =
        unquoted === rhs && !Number.isNaN(Number(rhs)) ? Number(rhs) : unquoted;
      return { kind: "cmp", column, op, literal, isParam: false };
    });
}

type BoundCondition =
  | { kind: "cmp"; column: string; op: string; value: unknown }
  | { kind: "isNull"; column: string; negate: boolean }
  | { kind: "orNullOrCmp"; column: string; op: string; value: unknown }
  | {
      kind: "orTwoCols";
      a: { column: string; op: string; value: unknown };
      b: { column: string; op: string; value: unknown };
    };

// Params are bound to conditions exactly once, up front — NOT inside the
// per-row filter below. Each `?` in the WHERE text corresponds to one query-
// level value shared by every row being tested; consuming `cursor` per row
// (e.g. inside a short-circuiting `.every`) would desync it across rows.
function bindConditions(
  conditions: Condition[],
  params: unknown[],
  cursor: { i: number },
): BoundCondition[] {
  return conditions.map((c): BoundCondition => {
    if (c.kind === "isNull") return c;
    if (c.kind === "orTwoCols") {
      return {
        kind: "orTwoCols",
        a: { ...c.a, value: params[cursor.i++] },
        b: { ...c.b, value: params[cursor.i++] },
      };
    }
    if (c.kind === "orNullOrCmp") {
      // `NOW()` is a literal in the SQL text, so it consumes no `?` param —
      // advancing the cursor for it would desync every later placeholder.
      return {
        kind: "orNullOrCmp",
        column: c.column,
        op: c.op,
        value: c.source === "now" ? new Date() : params[cursor.i++],
      };
    }
    const value = c.isParam ? params[cursor.i++] : c.literal;
    return { kind: "cmp", column: c.column, op: c.op, value };
  });
}

function matchesBoundCondition(row: Row, condition: BoundCondition): boolean {
  if (condition.kind === "isNull") {
    const isNull =
      row[condition.column] === null || row[condition.column] === undefined;
    return condition.negate ? !isNull : isNull;
  }
  if (condition.kind === "orTwoCols") {
    const hit = (side: { column: string; op: string; value: unknown }) =>
      compare(
        side.column,
        row[side.column],
        side.op,
        coerce(side.column, side.value),
      );
    return hit(condition.a) || hit(condition.b);
  }
  if (condition.kind === "orNullOrCmp") {
    const cellIsNull =
      row[condition.column] === null || row[condition.column] === undefined;
    if (cellIsNull) return true;
    return compare(
      condition.column,
      row[condition.column],
      condition.op,
      coerce(condition.column, condition.value),
    );
  }
  return compare(
    condition.column,
    row[condition.column],
    condition.op,
    coerce(condition.column, condition.value),
  );
}

function applyWhere(
  rows: Row[],
  conditions: Condition[],
  params: unknown[],
  cursor: { i: number },
): Row[] {
  const bound = bindConditions(conditions, params, cursor);
  return rows.filter((row) =>
    bound.every((c) => matchesBoundCondition(row, c)),
  );
}

function clone(row: Row): Row {
  return { ...row };
}

// ---------------------------------------------------------------------------
// SET-clause expression evaluation (Story 13.6 R1/R3)
//
// MySQL evaluates multi-column UPDATE SET assignments left to right, and a
// later assignment sees the already-updated value of an earlier one — not
// "every assignment reads the pre-statement row" as standard SQL suggests.
// This mini-evaluator reproduces that so devDb can genuinely exercise the
// same off-by-one class of bug the real driver would (see
// server/db.ts recordFailedPinAttempt and the R1 finding it fixes). Scoped
// to exactly the expression forms server/db.ts emits — not a general parser.
// ---------------------------------------------------------------------------

/** Splits on top-level commas only — a `,` inside IF(...) must not split the clause. */
function splitTopLevelCommas(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((p) => p.trim());
}

/**
 * Evaluates a scalar SET-clause expression against `workingRow` — a row
 * mutated in place by earlier assignments in the same statement, so later
 * expressions see their effects (the left-to-right semantics this exists
 * for). Consumes `?` placeholders left to right regardless of which IF()
 * branch is ultimately used: a prepared statement substitutes params into
 * the query text before execution, so both branches' placeholders are
 * always present positionally.
 */
function evalSetValue(
  expr: string,
  workingRow: Row,
  params: unknown[],
  cursor: { i: number },
): unknown {
  const trimmed = expr.trim();
  if (trimmed === "?") return params[cursor.i++];
  if (/^NULL$/i.test(trimmed)) return null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);

  const ifMatch = trimmed.match(/^IF\s*\((.*)\)$/is);
  if (ifMatch) {
    const args = splitTopLevelCommas(ifMatch[1]);
    if (args.length !== 3) {
      throw new Error(`devDb: IF() expects 3 arguments, got "${trimmed}"`);
    }
    const [condText, thenText, elseText] = args;
    const condTrue = evalSetCondition(condText, workingRow, params, cursor);
    const thenValue = evalSetValue(thenText, workingRow, params, cursor);
    const elseValue = evalSetValue(elseText, workingRow, params, cursor);
    return condTrue ? thenValue : elseValue;
  }

  const addMatch = trimmed.match(/^(\w+)\s*\+\s*(\d+)$/);
  if (addMatch) {
    const [, col, amount] = addMatch;
    return Number(workingRow[col] ?? 0) + Number(amount);
  }

  if (/^\w+$/.test(trimmed)) return workingRow[trimmed];

  // `NOW()` was understood in a WHERE clause (SP-077) but not here, so any
  // statement that *assigned* it — `SET updatedAt = NOW()` — threw. MySQL
  // evaluates it natively and the SQLite engine rewrites it to a bound
  // parameter (sqlite-engine.ts's rewriteNow), so devDb was the only one of
  // the three backends that could not, which made a statement correct
  // everywhere else fail only in local development.
  if (/^NOW\(\)$/i.test(trimmed)) return new Date();

  throw new Error(`devDb: unsupported SET expression "${trimmed}"`);
}

function evalSetCondition(
  expr: string,
  workingRow: Row,
  params: unknown[],
  cursor: { i: number },
): boolean {
  const m = expr.trim().match(/^(.+?)\s*(>=|<=|=)\s*(.+)$/);
  if (!m) throw new Error(`devDb: unsupported SET condition "${expr}"`);
  const [, leftText, op, rightText] = m;
  const left = Number(evalSetValue(leftText, workingRow, params, cursor));
  const right = Number(evalSetValue(rightText, workingRow, params, cursor));
  if (op === ">=") return left >= right;
  if (op === "<=") return left <= right;
  return left === right;
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
        return { insertId: existing.id as Id, affectedRows: 2 };
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
    const setAssignments = splitTopLevelCommas(setClause).map((part) => {
      const eq = part.indexOf("=");
      return {
        column: part.slice(0, eq).trim(),
        expr: part.slice(eq + 1).trim(),
      };
    });
    // Param count for the SET clause is fixed by its TEXT (both IF() branches'
    // `?` are always consumed, regardless of which is taken — see
    // evalSetValue) — so WHERE params start right after it, independent of
    // any row's data.
    const setParamCount = (setClause.match(/\?/g) ?? []).length;
    const whereCursor = { i: setParamCount };
    const conditions = parseConditions(whereBody);
    const matched = applyWhere(
      tableRows(table),
      conditions,
      params,
      whereCursor,
    );
    // Only stand in for MySQL's `ON UPDATE CURRENT_TIMESTAMP` when the
    // statement did not assign `updatedAt` itself. Every synced write now sets
    // it explicitly, and overwriting that here would replace the timestamp
    // last-write-wins compares with devDb's own clock.
    const assignsUpdatedAt = setAssignments.some(
      (a) => a.column === "updatedAt",
    );
    matched.forEach((row) => {
      const setCursor = { i: 0 };
      for (const { column, expr } of setAssignments) {
        const rawValue = evalSetValue(expr, row, params, setCursor);
        row[column] = coerce(column, rawValue);
      }
      if (!assignsUpdatedAt) row.updatedAt = new Date();
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
      applyWhere(tableRows(table), conditions, params, cursor),
    );
    const before = tableRows(table).length;
    store[table] = tableRows(table).filter((row) => !doomed.has(row));
    return { affectedRows: before - tableRows(table).length };
  }

  // ---- SELECT COUNT(*) ----
  // SP-099: `SELECT COUNT(*) as x FROM t WHERE ...` fell through to the
  // "unsupported query" throw, so the account screen could not check whether an
  // account had linked activity and every delete failed with "Could not verify
  // linked activity". Four such counts exist in server/db.ts (categories,
  // account transactions, account transfers, accounts).
  m = sql.match(
    /^SELECT\s+COUNT\(\*\)\s+as\s+(\w+)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+?))?\s*$/i,
  );
  if (m) {
    const alias = m[1];
    const table = m[2] as TableName;
    const whereBody = m[3];
    const cursor = { i: 0 };
    const rows = whereBody
      ? applyWhere(tableRows(table), parseConditions(whereBody), params, cursor)
      : tableRows(table);
    return [{ [alias]: rows.length }];
  }

  // ---- SELECT ----
  // Column list may be `*` or an explicit `col1, col2, ...` (Story 13.6 R3 —
  // server/db.ts's getUserPinState selects explicit columns, matching the
  // getUserSettings convention).
  // SP-077: LIMIT/OFFSET may be a `?` placeholder *or* a literal (findActiveBudget
  // emits `LIMIT 1`). The literal form was not matched here, so it stayed glued
  // to the WHERE body and reached parseConditions as
  // `(endDate IS NULL OR endDate >= NOW()) LIMIT 1`.
  m = sql.match(
    /^SELECT\s+(\*|[\w]+(?:\s*,\s*[\w]+)*)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+(.+?))?(?:\s+LIMIT\s+(\?|\d+))?(?:\s+OFFSET\s+(\?|\d+))?\s*$/i,
  );
  if (m && /^SELECT/i.test(sql)) {
    const columnsRaw = m[1];
    const table = m[2] as TableName;
    const whereBody = m[3];
    const orderBy = m[4];
    const limitRaw = m[5];
    const offsetRaw = m[6];

    const cursor = { i: 0 };
    let rows = whereBody
      ? applyWhere(tableRows(table), parseConditions(whereBody), params, cursor)
      : [...tableRows(table)];

    if (orderBy) {
      // `ORDER BY date DESC, id DESC` used to be split on whitespace alone, so
      // the direction token came out as "DESC," — which never equals "DESC" —
      // and the whole clause silently sorted ascending on the first column.
      // The tiebreaker matters now that ids are time-ordered ULIDs.
      const terms = orderBy
        .split(",")
        .map((term) => term.trim())
        .filter(Boolean)
        .map((term) => {
          const [col, dirRaw] = term.split(/\s+/);
          return {
            col,
            dir: (dirRaw || "ASC").toUpperCase() === "DESC" ? -1 : 1,
          };
        });

      rows = [...rows].sort((a, b) => {
        for (const { col, dir } of terms) {
          const av = a[col];
          const bv = b[col];
          let cmp: number;
          if (DATE_COLUMNS.has(col)) {
            cmp =
              new Date(av as string).getTime() -
              new Date(bv as string).getTime();
          } else if (NUMERIC_COLUMNS.has(col)) {
            cmp = Number(av) - Number(bv);
          } else {
            cmp = String(av).localeCompare(String(bv));
          }
          if (cmp !== 0) return cmp * dir;
        }
        return 0;
      });
    }

    // A literal consumes no `?`, so only advance the cursor for placeholders.
    const limit =
      limitRaw === undefined
        ? undefined
        : limitRaw === "?"
          ? Number(params[cursor.i++])
          : Number(limitRaw);
    const offset =
      offsetRaw === undefined
        ? undefined
        : offsetRaw === "?"
          ? Number(params[cursor.i++])
          : Number(offsetRaw);
    if (offset) rows = rows.slice(offset);
    if (limit !== undefined) rows = rows.slice(0, limit);

    const cloned = rows.map(clone);
    if (columnsRaw.trim() === "*") return cloned;

    const wantedColumns = columnsRaw.split(",").map((c) => c.trim());
    return cloned.map((row) => {
      const projected: Row = {};
      for (const col of wantedColumns) projected[col] = row[col];
      return projected;
    });
  }

  throw new Error(`devDb: unsupported query: ${sql}`);
}

function applyInsertDefaults(table: TableName, row: Row): void {
  const now = new Date();
  if (!("createdAt" in row) || row.createdAt == null) row.createdAt = now;
  if (!("updatedAt" in row) || row.updatedAt == null) row.updatedAt = now;
  // Mirrors the schema defaults: a freshly inserted row is live and unpushed.
  if (table !== "users") {
    if (row.deletedAt === undefined) row.deletedAt = null;
    if (row.dirty === undefined) row.dirty = true;
    if (row.serverSeq === undefined) row.serverSeq = null;
  }
  switch (table) {
    case "users":
      if (row.role == null) row.role = "user";
      if (row.lastSignedIn == null) row.lastSignedIn = now;
      break;
    case "categories":
      if (row.icon == null) row.icon = DEFAULT_CATEGORY_ICON;
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
    case "loans":
      if (row.status == null) row.status = "active";
      break;
    case "accounts":
      if (row.currency == null) row.currency = "USD";
      if (row.isDefault == null) row.isDefault = false;
      break;
  }
}

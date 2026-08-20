import { beforeEach, describe, expect, it, vi } from "vitest";
import { isUlid } from "@shared/ulid";

type Row = Record<string, unknown>;

const dbQuery = vi.fn();

vi.mock("@/server/_core/db-query", () => ({
  dbQuery: (...args: unknown[]) => dbQuery(...args),
}));

/**
 * A minimal fake covering exactly the four query shapes
 * server/migrate-ulid-ids.ts emits — not a general SQL engine (devDb.ts
 * already is one; this migration's queries are far more regular than the
 * app's, so a purpose-built fake is clearer than reusing it).
 */
function installFakeDb(initialTables: Record<string, Row[]>) {
  const tables: Record<string, Row[]> = {};
  for (const [table, rows] of Object.entries(initialTables)) {
    tables[table] = rows.map((row) => ({ ...row }));
  }

  dbQuery.mockImplementation(
    async (
      _api: string,
      opts: { body: { query: string; params: unknown[] } },
    ) => {
      const sql = opts.body.query.trim();
      const params = opts.body.params ?? [];

      let m = sql.match(/^SELECT id FROM (\w+)$/);
      if (m) {
        const [, table] = m;
        return tables[table].map((row) => ({ id: row.id }));
      }

      m = sql.match(/^SELECT id, (\w+) FROM (\w+)$/);
      if (m) {
        const [, column, table] = m;
        return tables[table].map((row) => ({
          id: row.id,
          [column]: row[column],
        }));
      }

      m = sql.match(/^UPDATE (\w+) SET (\w+) = \? WHERE id = \?$/);
      if (m) {
        const [, table, column] = m;
        const [value, id] = params;
        const row = tables[table].find((r) => r.id === id);
        if (row) row[column] = value;
        return undefined;
      }

      throw new Error(`Unhandled fake query: ${sql}`);
    },
  );

  return tables;
}

describe("assignUlidIds", () => {
  beforeEach(() => {
    dbQuery.mockReset();
    vi.resetModules();
  });

  it("mints a unique ULID per row and writes it to id_ulid", async () => {
    const tables = installFakeDb({
      users: [{ id: 1 }, { id: 2 }, { id: 3 }],
    });
    const { assignUlidIds } = await import("@/server/migrate-ulid-ids");

    const map = await assignUlidIds("users");

    expect(map.size).toBe(3);
    for (const [oldId, newId] of map) {
      expect(isUlid(newId)).toBe(true);
      const row = tables.users.find((r) => r.id === oldId);
      expect(row?.id_ulid).toBe(newId);
    }
    // Every minted id is distinct.
    expect(new Set(map.values()).size).toBe(3);
  });

  it("mints fresh ids on a re-run rather than reusing the prior ones", async () => {
    installFakeDb({ users: [{ id: 1 }] });
    const { assignUlidIds } = await import("@/server/migrate-ulid-ids");

    const first = await assignUlidIds("users");
    const second = await assignUlidIds("users");

    expect(first.get(1)).not.toBe(second.get(1));
  });
});

describe("remapForeignKey", () => {
  beforeEach(() => {
    dbQuery.mockReset();
    vi.resetModules();
  });

  it("rewrites the FK shadow column using the supplied map", async () => {
    const tables = installFakeDb({
      categories: [
        { id: 10, userId: 1 },
        { id: 11, userId: 2 },
      ],
    });
    const { remapForeignKey } = await import("@/server/migrate-ulid-ids");
    const usersMap = new Map([
      [1, "01USERAAAAAAAAAAAAAAAAAAAA"],
      [2, "01USERBBBBBBBBBBBBBBBBBBBB"],
    ]);

    const count = await remapForeignKey("categories", "userId", usersMap, {
      nullable: false,
    });

    expect(count).toBe(2);
    expect(tables.categories.find((r) => r.id === 10)?.userId_ulid).toBe(
      "01USERAAAAAAAAAAAAAAAAAAAA",
    );
    expect(tables.categories.find((r) => r.id === 11)?.userId_ulid).toBe(
      "01USERBBBBBBBBBBBBBBBBBBBB",
    );
  });

  it("skips a null value on a nullable FK without writing or throwing", async () => {
    const tables = installFakeDb({
      transactions: [{ id: 20, creditCardId: null }],
    });
    const { remapForeignKey } = await import("@/server/migrate-ulid-ids");

    const count = await remapForeignKey(
      "transactions",
      "creditCardId",
      new Map(),
      { nullable: true },
    );

    expect(count).toBe(0);
    expect(
      tables.transactions.find((r) => r.id === 20)?.creditCardId_ulid,
    ).toBeUndefined();
  });

  it("throws when a required FK is null before the migration touches it", async () => {
    installFakeDb({ categories: [{ id: 10, userId: null }] });
    const { remapForeignKey } = await import("@/server/migrate-ulid-ids");

    await expect(
      remapForeignKey("categories", "userId", new Map(), { nullable: false }),
    ).rejects.toThrow(/is NULL but the column is declared NOT NULL/);
  });

  it("throws OrphanForeignKeyError for a value with no entry in the map", async () => {
    installFakeDb({
      categories: [{ id: 10, userId: 999 }],
    });
    const { remapForeignKey, OrphanForeignKeyError } =
      await import("@/server/migrate-ulid-ids");

    let caught: unknown;
    try {
      await remapForeignKey("categories", "userId", new Map(), {
        nullable: false,
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(OrphanForeignKeyError);
    const error = caught as InstanceType<typeof OrphanForeignKeyError>;
    expect(error.table).toBe("categories");
    expect(error.column).toBe("userId");
    expect(error.rowId).toBe(10);
    expect(error.danglingValue).toBe(999);
    expect(error.message).toMatch(/dangling foreign key/);
  });
});

describe("migrateUlidIds", () => {
  beforeEach(() => {
    dbQuery.mockReset();
    vi.resetModules();
  });

  it("backfills every table in FK-safe order and reports accurate counts", async () => {
    const tables = installFakeDb({
      users: [{ id: 1 }],
      categories: [{ id: 10, userId: 1 }],
      creditCards: [{ id: 20, userId: 1 }],
      accounts: [
        { id: 30, userId: 1 },
        { id: 31, userId: 1 },
      ],
      loans: [{ id: 40, userId: 1 }],
      transactions: [
        { id: 50, userId: 1, categoryId: 10, creditCardId: 20, accountId: 30 },
        {
          id: 51,
          userId: 1,
          categoryId: 10,
          creditCardId: null,
          accountId: null,
        },
      ],
      recurringTransactions: [
        { id: 60, userId: 1, categoryId: 10, creditCardId: null },
      ],
      budgets: [{ id: 70, userId: 1, categoryId: 10 }],
      monthlySummaries: [{ id: 80, userId: 1 }],
      repayments: [{ id: 90, loanId: 40, userId: 1 }],
      transfers: [{ id: 100, userId: 1, fromAccountId: 30, toAccountId: 31 }],
    });

    const { migrateUlidIds } = await import("@/server/migrate-ulid-ids");
    const summary = await migrateUlidIds();

    expect(summary.idsAssigned).toEqual({
      users: 1,
      categories: 1,
      creditCards: 1,
      accounts: 2,
      loans: 1,
      transactions: 2,
      recurringTransactions: 1,
      budgets: 1,
      monthlySummaries: 1,
      repayments: 1,
      transfers: 1,
    });
    expect(summary.foreignKeysRemapped).toEqual({
      "categories.userId": 1,
      "creditCards.userId": 1,
      "accounts.userId": 2,
      "loans.userId": 1,
      "transactions.userId": 2,
      "transactions.categoryId": 2,
      "transactions.creditCardId": 1, // the second row's null is skipped
      "transactions.accountId": 1,
      "recurringTransactions.userId": 1,
      "recurringTransactions.categoryId": 1,
      "recurringTransactions.creditCardId": 0,
      "budgets.userId": 1,
      "budgets.categoryId": 1,
      "monthlySummaries.userId": 1,
      "repayments.loanId": 1,
      "repayments.userId": 1,
      "transfers.userId": 1,
      "transfers.fromAccountId": 1,
      "transfers.toAccountId": 1,
    });

    // Cross-table consistency: a transaction's remapped FKs point at the same
    // new ids assigned to the rows they reference.
    const user = tables.users[0];
    const category = tables.categories[0];
    const card = tables.creditCards[0];
    const account30 = tables.accounts.find((r) => r.id === 30)!;
    const account31 = tables.accounts.find((r) => r.id === 31)!;
    const txWithCard = tables.transactions.find((r) => r.id === 50)!;
    const txWithoutCard = tables.transactions.find((r) => r.id === 51)!;
    const transfer = tables.transfers[0];
    const repayment = tables.repayments[0];
    const loan = tables.loans[0];

    expect(txWithCard.userId_ulid).toBe(user.id_ulid);
    expect(txWithCard.categoryId_ulid).toBe(category.id_ulid);
    expect(txWithCard.creditCardId_ulid).toBe(card.id_ulid);
    expect(txWithCard.accountId_ulid).toBe(account30.id_ulid);
    expect(txWithoutCard.creditCardId_ulid).toBeUndefined();
    expect(txWithoutCard.accountId_ulid).toBeUndefined();

    expect(transfer.fromAccountId_ulid).toBe(account30.id_ulid);
    expect(transfer.toAccountId_ulid).toBe(account31.id_ulid);
    expect(repayment.loanId_ulid).toBe(loan.id_ulid);

    // Every minted id, across every table, is well-formed and globally unique.
    const allIds = Object.values(tables)
      .flat()
      .map((row) => row.id_ulid as string)
      .filter(Boolean);
    allIds.forEach((id) => expect(isUlid(id)).toBe(true));
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("propagates an orphan foreign key as a thrown error rather than silently continuing", async () => {
    installFakeDb({
      users: [{ id: 1 }],
      categories: [{ id: 10, userId: 999 }], // dangling: no user 999
      creditCards: [],
      accounts: [],
      loans: [],
      transactions: [],
      recurringTransactions: [],
      budgets: [],
      monthlySummaries: [],
      repayments: [],
      transfers: [],
    });

    const { migrateUlidIds, OrphanForeignKeyError } =
      await import("@/server/migrate-ulid-ids");

    await expect(migrateUlidIds()).rejects.toBeInstanceOf(
      OrphanForeignKeyError,
    );
  });
});

describe("formatUlidMigrationSummary", () => {
  it("reports the assigned and remapped counts", async () => {
    const { formatUlidMigrationSummary } =
      await import("@/server/migrate-ulid-ids");

    const output = formatUlidMigrationSummary({
      idsAssigned: { users: 3 },
      foreignKeysRemapped: { "categories.userId": 5 },
    });

    expect(output).toMatch(/users: 3/);
    expect(output).toMatch(/categories\.userId: 5/);
    expect(output).toMatch(/0012_ulid_ids_contract\.sql/);
  });
});

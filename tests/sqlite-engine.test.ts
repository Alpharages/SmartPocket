import { beforeEach, describe, expect, it, vi } from "vitest";
import { testId } from "./helpers/ids";
import { isUlid } from "@shared/ulid";
import {
  createSqliteDataApi,
  runMigrations,
  translateStatement,
} from "@/server/_core/sqlite-engine";
import { createNodeSqliteDriver } from "@/server/_core/sqlite-node-driver";

describe("translateStatement", () => {
  it("rewrites NOW() to a bound parameter without desyncing a later placeholder", () => {
    const sql = `
      SELECT * FROM budgets
      WHERE userId = ? AND categoryId = ? AND period = ?
        AND (startDate IS NULL OR startDate <= NOW())
        AND (endDate IS NULL OR endDate >= NOW())
        AND id <> ?
      LIMIT 1
    `;
    const { sql: out, params } = translateStatement(sql, [
      "user-1",
      "cat-1",
      "monthly",
      "exclude-1",
    ]);

    expect(out).not.toContain("NOW()");
    // Every original placeholder plus the two NOW() replacements are still
    // "?", and — the point of the test — the trailing `id <> ?` placeholder
    // still receives "exclude-1", not one of the NOW() values.
    expect(out.match(/\?/g)).toHaveLength(6);
    expect(params).toEqual([
      "user-1",
      "cat-1",
      "monthly",
      expect.any(String),
      expect.any(String),
      "exclude-1",
    ]);
    // Both NOW() calls resolve to the same instant, and that instant is a
    // valid ISO string (parseable, round-trips).
    expect(params[3]).toBe(params[4]);
    expect(new Date(params[3] as string).toISOString()).toBe(params[3]);
  });

  it("leaves a statement with no NOW() and no upsert untouched", () => {
    const { sql, params } = translateStatement(
      "SELECT * FROM categories WHERE userId = ? AND deletedAt IS NULL",
      ["user-1"],
    );
    expect(sql).toBe(
      "SELECT * FROM categories WHERE userId = ? AND deletedAt IS NULL",
    );
    expect(params).toEqual(["user-1"]);
  });

  it("marshals boolean and Date params, and undefined to null", () => {
    const now = new Date("2026-06-01T00:00:00.000Z");
    const { params } = translateStatement("UPDATE t SET a = ?, b = ?, c = ?", [
      true,
      now,
      undefined,
    ]);
    expect(params).toEqual([1, "2026-06-01T00:00:00.000Z", null]);
  });

  it("rewrites ON DUPLICATE KEY UPDATE into ON CONFLICT DO UPDATE with excluded.col", () => {
    const sql = `
        INSERT INTO users (id, openId, name)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name)
      `;
    const { sql: out } = translateStatement(sql, [testId(1), "open-1", "Alex"]);

    expect(out).toMatch(/ON CONFLICT \(openId\) DO UPDATE SET/);
    expect(out).toMatch(/name = excluded\.name/);
    expect(out).not.toMatch(/VALUES\(name\)/);
    expect(out).not.toMatch(/ON DUPLICATE KEY UPDATE/i);
  });

  it("throws for an upsert against a table with no configured conflict column", () => {
    expect(() =>
      translateStatement(
        "INSERT INTO widgets (id) VALUES (?) ON DUPLICATE KEY UPDATE id = VALUES(id)",
        ["1"],
      ),
    ).toThrow(/no ON CONFLICT column configured/);
  });
});

describe("createSqliteDataApi", () => {
  let callDataApi: ReturnType<typeof createSqliteDataApi>;

  beforeEach(async () => {
    const driver = createNodeSqliteDriver();
    await runMigrations(driver);
    callDataApi = createSqliteDataApi(driver);
  });

  it("runs an INSERT and reports affectedRows, with insertId absent (ids are minted client-side)", async () => {
    const id = testId(1);
    const now = new Date("2026-06-01T00:00:00.000Z");
    const result = await callDataApi("Database/query", {
      body: {
        query:
          "INSERT INTO categories (id, userId, name, type, color, icon, isDefault, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params: [
          id,
          testId(2),
          "Groceries",
          "expense",
          "#10B981",
          "cart",
          true,
          now,
          now,
        ],
      },
    });

    expect(result).toEqual({ insertId: null, affectedRows: 1 });
  });

  it("round-trips a row: dates come back as Date instances, booleans as 0/1", async () => {
    const id = testId(1);
    const userId = testId(2);
    const now = new Date("2026-06-01T12:30:00.000Z");
    await callDataApi("Database/query", {
      body: {
        query:
          "INSERT INTO categories (id, userId, name, type, color, icon, isDefault, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params: [
          id,
          userId,
          "Groceries",
          "expense",
          "#10B981",
          "cart",
          true,
          now,
          now,
        ],
      },
    });

    const rows = (await callDataApi("Database/query", {
      body: {
        query: "SELECT * FROM categories WHERE id = ? AND deletedAt IS NULL",
        params: [id],
      },
    })) as Array<Record<string, unknown>>;

    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.id).toBe(id);
    expect(row.isDefault).toBe(1);
    expect(row.createdAt).toBeInstanceOf(Date);
    expect((row.createdAt as Date).toISOString()).toBe(now.toISOString());
    expect(row.deletedAt).toBeNull();
  });

  it("excludes tombstoned rows and reports the tombstone write's affectedRows", async () => {
    const id = testId(1);
    const now = new Date("2026-06-01T00:00:00.000Z");
    await callDataApi("Database/query", {
      body: {
        query:
          "INSERT INTO categories (id, userId, name, type, color, icon, isDefault, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params: [
          id,
          testId(2),
          "Groceries",
          "expense",
          "#10B981",
          "cart",
          false,
          now,
          now,
        ],
      },
    });

    const deleteResult = await callDataApi("Database/query", {
      body: {
        query:
          "UPDATE categories SET deletedAt = ?, updatedAt = ?, dirty = 1 WHERE id = ? AND deletedAt IS NULL",
        params: [now, now, id],
      },
    });
    expect(deleteResult).toEqual({ insertId: null, affectedRows: 1 });

    const rows = (await callDataApi("Database/query", {
      body: {
        query: "SELECT * FROM categories WHERE id = ? AND deletedAt IS NULL",
        params: [id],
      },
    })) as unknown[];
    expect(rows).toHaveLength(0);

    // Re-running the same tombstone write is a no-op (0 rows matched) —
    // proves the `AND deletedAt IS NULL` guard makes deletes idempotent.
    const secondDelete = (await callDataApi("Database/query", {
      body: {
        query:
          "UPDATE categories SET deletedAt = ?, updatedAt = ?, dirty = 1 WHERE id = ? AND deletedAt IS NULL",
        params: [now, now, id],
      },
    })) as { affectedRows: number };
    expect(secondDelete.affectedRows).toBe(0);
  });

  it("upserts a user without duplicating the id on a second call for the same openId", async () => {
    const firstId = testId(1);
    const now = new Date("2026-06-01T00:00:00.000Z");
    await callDataApi("Database/query", {
      body: {
        query: `
          INSERT INTO users (id, openId, name, createdAt, updatedAt, lastSignedIn)
          VALUES (?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            name = VALUES(name)
        `,
        params: [firstId, "open-1", "First Name", now, now, now],
      },
    });

    // A second upsert for the same openId with a *different* candidate id —
    // the real caller (server/db.ts's upsertUser) always mints a fresh ULID
    // per call, so this is the realistic shape of a returning-user sign-in.
    const secondId = testId(2);
    await callDataApi("Database/query", {
      body: {
        query: `
          INSERT INTO users (id, openId, name, createdAt, updatedAt, lastSignedIn)
          VALUES (?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            name = VALUES(name)
        `,
        params: [secondId, "open-1", "Updated Name", now, now, now],
      },
    });

    const rows = (await callDataApi("Database/query", {
      body: {
        query: "SELECT * FROM users WHERE openId = ?",
        params: ["open-1"],
      },
    })) as Array<Record<string, unknown>>;

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(firstId); // never overwritten
    expect(rows[0].name).toBe("Updated Name"); // but other fields do update
  });
});

describe("server/db.ts against the SQLite engine end to end", () => {
  beforeEach(async () => {
    vi.resetModules();
    const driver = createNodeSqliteDriver();
    await runMigrations(driver);
    const sqliteDataApi = createSqliteDataApi(driver);
    vi.doMock("@/server/_core/dataApi", () => ({
      callDataApi: sqliteDataApi,
    }));
  });

  it("creates, reads, updates and soft-deletes a category through the real db.ts functions", async () => {
    const db = await import("@/server/db");
    const userId = testId(1);

    const categoryId = await db.createCategory({
      userId,
      name: "Groceries",
      type: "expense",
      color: "#10B981",
      icon: "cart",
      isDefault: false,
    });
    expect(isUlid(categoryId)).toBe(true);

    const created = await db.getCategoryById(categoryId, userId);
    expect(created).toMatchObject({ name: "Groceries", type: "expense" });

    await db.updateCategory(categoryId, userId, { name: "Food & Dining" });
    const updated = await db.getCategoryById(categoryId, userId);
    expect(updated?.name).toBe("Food & Dining");
    // updateCategory's TOUCH_SET must have moved updatedAt forward.
    expect((updated!.updatedAt as Date).getTime()).toBeGreaterThanOrEqual(
      (created!.updatedAt as Date).getTime(),
    );

    await db.deleteCategory(categoryId, userId);
    expect(await db.getCategoryById(categoryId, userId)).toBeNull();
    // The full-list read also excludes the tombstoned row.
    expect(await db.getUserCategories(userId)).toEqual([]);
  });

  it("creates a transaction linked to a category and account, and reads it back with real Date fields", async () => {
    const db = await import("@/server/db");
    const userId = testId(1);

    const categoryId = await db.createCategory({
      userId,
      name: "Salary",
      type: "income",
      color: "#6366F1",
      icon: "cash",
      isDefault: false,
    });
    const account = await db.createAccount({
      userId,
      name: "Checking",
      type: "bank",
      currency: "USD",
      isDefault: true,
    });
    expect(account).not.toBeNull();

    const date = new Date("2026-06-10T00:00:00.000Z");
    const txnId = await db.createTransaction({
      userId,
      categoryId,
      type: "income",
      amount: "3200.00",
      description: "Monthly salary",
      date,
      accountId: account!.id,
    });

    const txns = await db.getUserTransactions(userId);
    expect(txns).toHaveLength(1);
    expect(txns[0]).toMatchObject({
      id: txnId,
      amount: "3200.00",
      description: "Monthly salary",
    });
    expect((txns[0] as { date: Date }).date).toBeInstanceOf(Date);
    expect((txns[0] as { date: Date }).date.toISOString()).toBe(
      date.toISOString(),
    );

    const balances = await db.getAccountBalances(userId);
    expect(balances[account!.id]).toBe(3200);
  });

  it("keeps findActiveBudget's NOW()-bounded window working against real SQLite", async () => {
    const db = await import("@/server/db");
    const userId = testId(1);
    const categoryId = await db.createCategory({
      userId,
      name: "Dining",
      type: "expense",
      color: "#F59E0B",
      icon: "restaurant",
      isDefault: false,
    });

    await db.createBudget({
      userId,
      categoryId,
      period: "monthly",
      amount: "300.00",
      startDate: null,
      endDate: null,
    });

    const active = await db.findActiveBudget(userId, categoryId, "monthly");
    expect(active).not.toBeNull();
    expect(active?.amount).toBe("300.00");
  });

  it("bulk-inserts transactions (CSV import path) with defaulted timestamps per row", async () => {
    const db = await import("@/server/db");
    const userId = testId(1);
    const categoryId = await db.createCategory({
      userId,
      name: "Groceries",
      type: "expense",
      color: "#10B981",
      icon: "cart",
      isDefault: false,
    });

    const count = await db.createTransactionsBulk([
      {
        userId,
        categoryId,
        type: "expense",
        amount: "10.00",
        description: "Row 1",
        date: new Date("2026-06-01"),
      },
      {
        userId,
        categoryId,
        type: "expense",
        amount: "20.00",
        description: "Row 2",
        date: new Date("2026-06-02"),
      },
      {
        userId,
        categoryId,
        type: "expense",
        amount: "30.00",
        description: "Row 3",
        date: new Date("2026-06-03"),
      },
    ]);

    expect(count).toBe(3);
    const rows = await db.getUserTransactions(userId);
    expect(rows).toHaveLength(3);
    for (const row of rows as Array<{ createdAt: Date; updatedAt: Date }>) {
      expect(row.createdAt).toBeInstanceOf(Date);
      expect(row.updatedAt).toBeInstanceOf(Date);
    }
    expect(
      rows.map((r) => (r as { description: string }).description).sort(),
    ).toEqual(["Row 1", "Row 2", "Row 3"]);
  });

  it("upserts the same user twice via oauth-style upsertUser without duplicating the row", async () => {
    const db = await import("@/server/db");

    await db.upsertUser({
      openId: "oauth-user-1",
      name: "Alex",
      email: "alex@example.com",
      loginMethod: "manus",
      lastSignedIn: new Date("2026-06-01"),
    });
    const firstFetch = await db.getUserByOpenId("oauth-user-1");

    await db.upsertUser({
      openId: "oauth-user-1",
      name: "Alex Updated",
      loginMethod: "manus",
      lastSignedIn: new Date("2026-06-02"),
    });
    const secondFetch = await db.getUserByOpenId("oauth-user-1");

    expect(secondFetch.id).toBe(firstFetch.id);
    expect(secondFetch.name).toBe("Alex Updated");
  });
});

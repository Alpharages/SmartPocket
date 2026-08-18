import type { Id } from "@/drizzle/schema";
import { describe, expect, it } from "vitest";

import { devQuery } from "@/server/_core/devDb";
import { testId } from "./helpers/ids";
import { isUlid } from "@shared/ulid";

describe("devDb budgets", () => {
  it("inserts and lists budgets", async () => {
    const insert = (await devQuery(
      `
        INSERT INTO budgets (userId, categoryId, period, amount, startDate, endDate)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [testId(1), testId(2), "monthly", "500.00", null, null],
    )) as { insertId: Id };

    expect(isUlid(insert.insertId)).toBe(true);

    const rows = (await devQuery(
      "SELECT * FROM budgets WHERE userId = ? AND deletedAt IS NULL ORDER BY createdAt DESC",
      [testId(1)],
    )) as Array<Record<string, unknown>>;

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: insert.insertId,
      userId: testId(1),
      categoryId: testId(2),
      period: "monthly",
      amount: "500.00",
    });
  });
});

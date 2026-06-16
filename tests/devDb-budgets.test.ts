import { describe, expect, it } from "vitest";

import { devQuery } from "@/server/_core/devDb";

describe("devDb budgets", () => {
  it("inserts and lists budgets", async () => {
    const insert = (await devQuery(
      `
        INSERT INTO budgets (userId, categoryId, period, amount, startDate, endDate)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [1, 2, "monthly", "500.00", null, null],
    )) as { insertId: number };

    expect(insert.insertId).toBeGreaterThan(0);

    const rows = (await devQuery(
      "SELECT * FROM budgets WHERE userId = ? ORDER BY createdAt DESC",
      [1],
    )) as Array<Record<string, unknown>>;

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: insert.insertId,
      userId: 1,
      categoryId: 2,
      period: "monthly",
      amount: "500.00",
    });
  });
});

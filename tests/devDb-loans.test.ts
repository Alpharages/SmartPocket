import { describe, expect, it } from "vitest";

import { devQuery } from "@/server/_core/devDb";

describe("devDb loans", () => {
  it("inserts and lists loans", async () => {
    const nextDue = new Date("2026-07-19T00:00:00.000Z");

    const insert = (await devQuery(
      `
        INSERT INTO loans (
          userId, direction, counterparty, principal, rate, periodicity,
          installmentCount, endDate, nextDueDate, status, note
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        1,
        "lend",
        "Alex",
        "250.00",
        "5.00",
        "monthly",
        12,
        null,
        nextDue,
        "active",
        null,
      ],
    )) as { insertId: number };

    expect(insert.insertId).toBeGreaterThan(0);

    const rows = (await devQuery(
      "SELECT * FROM loans WHERE userId = ? ORDER BY createdAt DESC",
      [1],
    )) as Array<Record<string, unknown>>;

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: insert.insertId,
      userId: 1,
      direction: "lend",
      counterparty: "Alex",
      principal: "250.00",
      periodicity: "monthly",
      installmentCount: 12,
      status: "active",
    });

    const byId = (await devQuery(
      "SELECT * FROM loans WHERE id = ? AND userId = ?",
      [insert.insertId, 1],
    )) as Array<Record<string, unknown>>;

    expect(byId).toHaveLength(1);
    expect(byId[0]?.id).toBe(insert.insertId);
  });

  it("inserts repayments for a loan", async () => {
    const loanInsert = (await devQuery(
      `
        INSERT INTO loans (
          userId, direction, counterparty, principal, rate, periodicity,
          installmentCount, endDate, nextDueDate, status, note
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        1,
        "borrow",
        null,
        "1000.00",
        null,
        "none",
        null,
        null,
        null,
        "active",
        null,
      ],
    )) as { insertId: number };

    const repaymentInsert = (await devQuery(
      `
        INSERT INTO repayments (loanId, userId, amount, date, note)
        VALUES (?, ?, ?, ?, ?)
      `,
      [loanInsert.insertId, 1, "100.00", new Date("2026-06-01"), null],
    )) as { insertId: number };

    expect(repaymentInsert.insertId).toBeGreaterThan(0);

    const rows = (await devQuery(
      "SELECT * FROM repayments WHERE loanId = ? AND userId = ? ORDER BY date DESC",
      [loanInsert.insertId, 1],
    )) as Array<Record<string, unknown>>;

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      loanId: loanInsert.insertId,
      userId: 1,
      amount: "100.00",
    });
  });
});

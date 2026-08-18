import type { Id } from "@/drizzle/schema";
import { describe, expect, it } from "vitest";

import { devQuery } from "@/server/_core/devDb";
import { testId } from "./helpers/ids";
import { isUlid } from "@shared/ulid";

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
        testId(1),
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
    )) as { insertId: Id };

    // The id is minted by devQuery itself (no `id` column supplied) — assert
    // the shape rather than a specific value, exactly as the real INSERT does.
    expect(isUlid(insert.insertId)).toBe(true);

    const rows = (await devQuery(
      "SELECT * FROM loans WHERE userId = ? AND deletedAt IS NULL ORDER BY createdAt DESC",
      [testId(1)],
    )) as Array<Record<string, unknown>>;

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: insert.insertId,
      userId: testId(1),
      direction: "lend",
      counterparty: "Alex",
      principal: "250.00",
      periodicity: "monthly",
      installmentCount: 12,
      status: "active",
    });

    const byId = (await devQuery(
      "SELECT * FROM loans WHERE id = ? AND userId = ? AND deletedAt IS NULL",
      [insert.insertId, testId(1)],
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
        testId(1),
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
    )) as { insertId: Id };

    const repaymentInsert = (await devQuery(
      `
        INSERT INTO repayments (loanId, userId, amount, date, note)
        VALUES (?, ?, ?, ?, ?)
      `,
      [loanInsert.insertId, testId(1), "100.00", new Date("2026-06-01"), null],
    )) as { insertId: Id };

    expect(isUlid(repaymentInsert.insertId)).toBe(true);

    const rows = (await devQuery(
      "SELECT * FROM repayments WHERE loanId = ? AND userId = ? AND deletedAt IS NULL ORDER BY date DESC",
      [loanInsert.insertId, testId(1)],
    )) as Array<Record<string, unknown>>;

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      loanId: loanInsert.insertId,
      userId: testId(1),
      amount: "100.00",
    });
  });
});

import { describe, expect, it } from "vitest";

import { devQuery } from "@/server/_core/devDb";

describe("devDb accounts", () => {
  it("inserts and lists accounts", async () => {
    const insert = (await devQuery(
      `
        INSERT INTO accounts (userId, name, type, currency, isDefault)
        VALUES (?, ?, ?, ?, ?)
      `,
      [1, "Cash", "cash", "USD", true],
    )) as { insertId: number };

    expect(insert.insertId).toBeGreaterThan(0);

    const rows = (await devQuery(
      "SELECT * FROM accounts WHERE userId = ? ORDER BY name",
      [1],
    )) as Array<Record<string, unknown>>;

    expect(rows.some((row) => row.id === insert.insertId)).toBe(true);
    expect(rows.find((row) => row.id === insert.insertId)).toMatchObject({
      userId: 1,
      name: "Cash",
      type: "cash",
      currency: "USD",
      isDefault: true,
    });
  });
});

import { describe, expect, it } from "vitest";

import {
  applyTransferLegs,
  reduceAccountBalances,
} from "@/lib/account-balances";
import { testId } from "../helpers/ids";

describe("reduceAccountBalances", () => {
  it("sums income and subtracts expense per account independently", () => {
    const balances = reduceAccountBalances([
      { accountId: testId(1), type: "income", amount: "100.00" },
      { accountId: testId(1), type: "expense", amount: "25.50" },
      { accountId: testId(2), type: "income", amount: "50.00" },
      { accountId: testId(2), type: "expense", amount: "10.00" },
    ]);

    expect(balances[testId(1)]).toBeCloseTo(74.5);
    expect(balances[testId(2)]).toBeCloseTo(40);
  });

  it("ignores rows without accountId", () => {
    const balances = reduceAccountBalances([
      { accountId: null, type: "income", amount: "999.00" },
      { accountId: testId(1), type: "income", amount: "10.00" },
    ]);

    expect(balances[testId(1)]).toBe(10);
    expect(balances[testId(2)]).toBeUndefined();
  });

  it("treats NaN amounts as zero", () => {
    const balances = reduceAccountBalances([
      { accountId: testId(1), type: "income", amount: "not-a-number" },
      { accountId: testId(1), type: "expense", amount: "5.00" },
    ]);

    expect(balances[testId(1)]).toBe(-5);
  });

  it("supports negative net balances", () => {
    const balances = reduceAccountBalances([
      { accountId: testId(3), type: "expense", amount: "120.00" },
      { accountId: testId(3), type: "income", amount: "40.00" },
    ]);

    expect(balances[testId(3)]).toBe(-80);
  });
});

describe("applyTransferLegs", () => {
  it("moves money from source to destination (AC1, AC5)", () => {
    const txnBalances = reduceAccountBalances([
      { accountId: testId(1), type: "income", amount: "100.00" },
      { accountId: testId(2), type: "income", amount: "20.00" },
    ]);

    const balances = applyTransferLegs(txnBalances, [
      { fromAccountId: testId(1), toAccountId: testId(2), amount: "50.00" },
    ]);

    expect(balances[testId(1)]).toBe(50);
    expect(balances[testId(2)]).toBe(70);
    expect(balances[testId(1)] + balances[testId(2)]).toBe(120);
  });

  it("treats NaN transfer amounts as zero", () => {
    const balances = applyTransferLegs({ [testId(1)]: 100 }, [
      {
        fromAccountId: testId(1),
        toAccountId: testId(2),
        amount: "not-a-number",
      },
    ]);

    expect(balances[testId(1)]).toBe(100);
    expect(balances[testId(2)]).toBeUndefined();
  });
});

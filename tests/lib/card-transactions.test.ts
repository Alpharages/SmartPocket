import { describe, expect, it } from "vitest";

import {
  parseCardRouteId,
  sumCardTransactionTotal,
} from "@/lib/card-transactions";

describe("sumCardTransactionTotal", () => {
  it("sums decimal string amounts without string concatenation", () => {
    const total = sumCardTransactionTotal([
      { amount: "10.50" },
      { amount: "5.25" },
    ]);
    expect(total).toBe(15.75);
  });

  it("treats invalid amounts as zero", () => {
    const total = sumCardTransactionTotal([
      { amount: "10.00" },
      { amount: "abc" },
      { amount: "" },
    ]);
    expect(total).toBe(10);
  });
});

describe("parseCardRouteId", () => {
  it("parses a valid numeric id", () => {
    expect(parseCardRouteId("42")).toBe(42);
  });

  it("returns NaN for non-numeric, zero, or negative ids", () => {
    expect(Number.isNaN(parseCardRouteId("abc"))).toBe(true);
    expect(Number.isNaN(parseCardRouteId("0"))).toBe(true);
    expect(Number.isNaN(parseCardRouteId("-1"))).toBe(true);
    expect(Number.isNaN(parseCardRouteId(undefined))).toBe(true);
  });
});

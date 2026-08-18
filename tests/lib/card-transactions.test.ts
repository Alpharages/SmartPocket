import { describe, expect, it } from "vitest";
import { testId } from "../helpers/ids";

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
  it("returns the segment when it is a well-formed ULID", () => {
    expect(parseCardRouteId(testId(42))).toBe(testId(42));
    expect(parseCardRouteId("01ARZ3NDEKTSV4RRFFQ69G5FAV")).toBe(
      "01ARZ3NDEKTSV4RRFFQ69G5FAV",
    );
  });

  it("takes the first segment when the router hands back an array", () => {
    expect(parseCardRouteId([testId(42), testId(43)])).toBe(testId(42));
  });

  it("returns null for anything that is not a ULID", () => {
    expect(parseCardRouteId("abc")).toBeNull();
    // A leftover deep link from before the id migration.
    expect(parseCardRouteId("42")).toBeNull();
    expect(parseCardRouteId("0")).toBeNull();
    expect(parseCardRouteId("-1")).toBeNull();
    expect(parseCardRouteId(undefined)).toBeNull();
    // Right length, but uses letters Crockford base32 excludes.
    expect(parseCardRouteId("01ARZ3NDEKTSV4RRFFQ69G5FAI")).toBeNull();
  });
});

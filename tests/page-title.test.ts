import { describe, expect, it } from "vitest";
import { getPageTitle } from "@/lib/_core/page-title";

// SP-079: document.title was empty on all 22 routes.
describe("getPageTitle", () => {
  it("names each primary screen and always includes the app name", () => {
    expect(getPageTitle("/dashboard", "SmartPocket")).toBe(
      "Home · SmartPocket",
    );
    expect(getPageTitle("/transactions", "SmartPocket")).toBe(
      "Activity · SmartPocket",
    );
    expect(getPageTitle("/settings", "SmartPocket")).toBe(
      "Settings · SmartPocket",
    );
  });

  it("does not repeat the app name on the root route", () => {
    expect(getPageTitle("/", "SmartPocket")).toBe("SmartPocket");
  });

  it("resolves dynamic detail routes", () => {
    expect(getPageTitle("/transaction/42", "SmartPocket")).toBe(
      "Transaction · SmartPocket",
    );
    expect(getPageTitle("/loan/7", "SmartPocket")).toBe("Loan · SmartPocket");
    expect(getPageTitle("/card/3", "SmartPocket")).toBe("Card · SmartPocket");
  });

  it("ignores query strings, hashes and trailing slashes", () => {
    expect(getPageTitle("/settings/", "SmartPocket")).toBe(
      "Settings · SmartPocket",
    );
    expect(getPageTitle("/budgets?from=home", "SmartPocket")).toBe(
      "Budgets · SmartPocket",
    );
    expect(getPageTitle("/loans#top", "SmartPocket")).toBe(
      "Loans · SmartPocket",
    );
  });

  it("falls back to the app name for an unknown route", () => {
    expect(getPageTitle("/nope/nowhere", "SmartPocket")).toBe("SmartPocket");
  });

  it("never returns an empty title", () => {
    for (const p of ["", "/", "/dashboard", "/x", "/card/1"]) {
      expect(getPageTitle(p, "SmartPocket").length).toBeGreaterThan(0);
    }
  });
});

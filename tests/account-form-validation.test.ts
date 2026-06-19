import { describe, expect, it } from "vitest";
import {
  getAccountTypeLabel,
  isAccountFormValid,
} from "@/lib/account-form-validation";

describe("account form validation", () => {
  it("accepts valid account form values", () => {
    expect(
      isAccountFormValid({
        name: "Main Bank",
        type: "bank",
        currency: "USD",
      }),
    ).toBe(true);
  });

  it("rejects empty name", () => {
    expect(
      isAccountFormValid({
        name: "   ",
        type: "cash",
        currency: "USD",
      }),
    ).toBe(false);
  });

  it("rejects unsupported currency", () => {
    expect(
      isAccountFormValid({
        name: "Wallet",
        type: "wallet",
        // @ts-expect-error invalid currency for validation test
        currency: "ZZZ",
      }),
    ).toBe(false);
  });

  it("labels account types for accessibility", () => {
    expect(getAccountTypeLabel("bank")).toBe("Bank");
    expect(getAccountTypeLabel("wallet")).toBe("Wallet");
  });
});

import { describe, expect, it } from "vitest";
import {
  isCardFormValid,
  maskCardLastFour,
  type CardFormValues,
} from "@/lib/card-form-validation";

const validBase: CardFormValues = {
  cardName: "My Visa",
  cardNumber: "1234567890123456",
  cardholderName: "John Doe",
  expiryMonth: "6",
  expiryYear: "2027",
  creditLimit: "5000",
  cardType: "credit",
};

describe("isCardFormValid", () => {
  describe("required fields", () => {
    it("returns false when cardName is empty", () => {
      expect(
        isCardFormValid({ ...validBase, cardName: "" }, "add"),
      ).toBe(false);
    });

    it("returns false when cardholderName is empty", () => {
      expect(
        isCardFormValid({ ...validBase, cardholderName: "  " }, "add"),
      ).toBe(false);
    });

    it("returns false when cardType is empty", () => {
      expect(
        isCardFormValid({ ...validBase, cardType: "" }, "add"),
      ).toBe(false);
    });

    it("returns false in add mode when cardNumber is empty", () => {
      expect(
        isCardFormValid({ ...validBase, cardNumber: "" }, "add"),
      ).toBe(false);
    });

    it("returns true in edit mode without cardNumber in values", () => {
      expect(
        isCardFormValid({ ...validBase, cardNumber: "" }, "edit"),
      ).toBe(true);
    });
  });

  describe("expiry month boundaries", () => {
    it("accepts month 1", () => {
      expect(
        isCardFormValid({ ...validBase, expiryMonth: "1" }, "add"),
      ).toBe(true);
    });

    it("accepts month 12", () => {
      expect(
        isCardFormValid({ ...validBase, expiryMonth: "12" }, "add"),
      ).toBe(true);
    });

    it("rejects month 0", () => {
      expect(
        isCardFormValid({ ...validBase, expiryMonth: "0" }, "add"),
      ).toBe(false);
    });

    it("rejects month 13", () => {
      expect(
        isCardFormValid({ ...validBase, expiryMonth: "13" }, "add"),
      ).toBe(false);
    });
  });

  describe("expiry year boundaries", () => {
    it("accepts year 2024", () => {
      expect(
        isCardFormValid({ ...validBase, expiryYear: "2024" }, "add"),
      ).toBe(true);
    });

    it("accepts year 2099", () => {
      expect(
        isCardFormValid({ ...validBase, expiryYear: "2099" }, "add"),
      ).toBe(true);
    });

    it("rejects year 2023", () => {
      expect(
        isCardFormValid({ ...validBase, expiryYear: "2023" }, "add"),
      ).toBe(false);
    });

    it("rejects year 2100", () => {
      expect(
        isCardFormValid({ ...validBase, expiryYear: "2100" }, "add"),
      ).toBe(false);
    });
  });

  describe("creditLimit regex", () => {
    it('accepts whole number "5000"', () => {
      expect(
        isCardFormValid({ ...validBase, creditLimit: "5000" }, "add"),
      ).toBe(true);
    });

    it('accepts two decimal places "5000.50"', () => {
      expect(
        isCardFormValid({ ...validBase, creditLimit: "5000.50" }, "add"),
      ).toBe(true);
    });

    it('rejects three decimal places "5000.555"', () => {
      expect(
        isCardFormValid({ ...validBase, creditLimit: "5000.555" }, "add"),
      ).toBe(false);
    });

    it('rejects non-numeric "abc"', () => {
      expect(
        isCardFormValid({ ...validBase, creditLimit: "abc" }, "add"),
      ).toBe(false);
    });
  });
});

describe("maskCardLastFour", () => {
  it("masks all but the last four digits", () => {
    expect(maskCardLastFour("1234567890123456")).toBe("•••• •••• •••• 3456");
  });
});

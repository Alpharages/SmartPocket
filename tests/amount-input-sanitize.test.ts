import { describe, expect, it } from "vitest";
import { sanitizeAmountInput } from "@shared/money";

// SP-076: the amount field accepted "abc!@#" while typing; inputMode is only a
// keyboard hint and does not filter characters.
describe("sanitizeAmountInput", () => {
  it("drops letters and symbols", () => {
    expect(sanitizeAmountInput("abc!@#")).toBe("");
    expect(sanitizeAmountInput("12abc")).toBe("12");
    expect(sanitizeAmountInput("1a2b3")).toBe("123");
    expect(sanitizeAmountInput("-5")).toBe("5");
    expect(sanitizeAmountInput("$12.50")).toBe("12.50");
  });

  it("keeps a valid amount untouched", () => {
    expect(sanitizeAmountInput("12.34")).toBe("12.34");
    expect(sanitizeAmountInput("0")).toBe("0");
    expect(sanitizeAmountInput("1000")).toBe("1000");
  });

  it("allows in-progress decimal entry", () => {
    expect(sanitizeAmountInput("0.")).toBe("0.");
    expect(sanitizeAmountInput("12.")).toBe("12.");
  });

  it("collapses extra decimal points", () => {
    expect(sanitizeAmountInput("1.2.3")).toBe("1.23");
    expect(sanitizeAmountInput("...")).toBe(".");
  });

  it("caps the fraction at two places", () => {
    expect(sanitizeAmountInput("1.999")).toBe("1.99");
    expect(sanitizeAmountInput("10.12345")).toBe("10.12");
  });
});

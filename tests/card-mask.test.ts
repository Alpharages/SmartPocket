import { describe, expect, it } from "vitest";

import { maskCardNumber } from "@/server/_core/crypto";

describe("maskCardNumber", () => {
  it("returns the last four digits of a PAN", () => {
    expect(maskCardNumber("4111111111111111")).toBe("1111");
  });

  it("handles min(13) and max(19) length PANs", () => {
    expect(maskCardNumber("4111111111111")).toBe("1111");
    expect(maskCardNumber("4111111111111111111")).toBe("1111");
  });

  it("returns what exists when shorter than four characters", () => {
    expect(maskCardNumber("123")).toBe("123");
    expect(maskCardNumber("")).toBe("");
  });

  it("trims whitespace before masking", () => {
    expect(maskCardNumber("  4111111111111111  ")).toBe("1111");
  });
});

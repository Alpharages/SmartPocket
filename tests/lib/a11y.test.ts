import { describe, expect, it } from "vitest";

import { MAX_FONT_SCALE } from "@/lib/_core/a11y";

describe("MAX_FONT_SCALE", () => {
  it("caps numeric text scaling at exactly the 200% dynamic-type ceiling (AC5)", () => {
    expect(MAX_FONT_SCALE).toBe(2);
  });
});

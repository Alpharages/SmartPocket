import { describe, expect, it } from "vitest";

import { MAX_FONT_SCALE, minContrastScrim } from "@/lib/_core/a11y";
import { contrastRatio } from "@/lib/_core/contrast";
import { compositeOver } from "@/lib/_core/glass";

describe("MAX_FONT_SCALE", () => {
  it("caps numeric text scaling at exactly the 200% dynamic-type ceiling (AC5)", () => {
    expect(MAX_FONT_SCALE).toBe(2);
  });
});

describe("minContrastScrim", () => {
  it("returns scrim: null when the raw fill already clears the target", () => {
    const { ink, scrim } = minContrastScrim("#FFFFFF", 4.5);
    expect(scrim).toBeNull();
    expect(contrastRatio(ink, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });

  it("finds a scrim opacity that brings a failing fill up to the target", () => {
    // A mid-gray fill clears neither ink at 4.5:1 raw (white ~4.17:1, dark ~4.25:1).
    const fill = "#7C7C7C";
    const { ink, scrim } = minContrastScrim(fill, 4.5);
    expect(scrim).not.toBeNull();
    expect(scrim).toMatch(/^rgba\(/);
    const match = scrim!.match(/^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/)!;
    const [, r, g, b, alpha] = match;
    const hex = `#${[r, g, b].map((c) => Number(c).toString(16).padStart(2, "0")).join("")}`;
    const scrimmed = compositeOver(hex, Number(alpha), fill);
    expect(contrastRatio(ink, scrimmed)).toBeGreaterThanOrEqual(4.5);
  });

  it("picks the ink (light or dark) with the better raw contrast against the fill", () => {
    expect(minContrastScrim("#0B0F19", 4.5).ink).toBe("#FFFFFF");
    expect(minContrastScrim("#F8FAFC", 4.5).ink).toBe("#111827");
  });
});

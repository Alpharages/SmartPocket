import { describe, it, expect } from "vitest";
import {
  CategoryColors,
  ThemeColors,
  CATEGORY_DEFAULT_COLOR,
  Colors,
} from "@/lib/_core/theme";

/**
 * Parse a hex color string to RGB values.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

/**
 * Calculate relative luminance of an sRGB color (WCAG 2.1).
 */
function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Calculate WCAG contrast ratio between two hex colors.
 */
function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("Theme Tokens", () => {
  describe("Category Color Palette", () => {
    const lightBg = "#F8FAFC";
    const darkBg = "#0B0F19";
    const whiteText = "#FFFFFF";

    it("should contain 10 category color tokens", () => {
      expect(CategoryColors.length).toBe(10);
    });

    it("should never contain the retired teal #0a7ea4", () => {
      const allHexes = CategoryColors.flatMap((c) => [c.light, c.dark]);
      for (const hex of allHexes) {
        expect(hex.toLowerCase()).not.toBe("#0a7ea4");
      }
    });

    it("should have unique light-mode hex values", () => {
      const lightHexes = CategoryColors.map((c) => c.light);
      const unique = new Set(lightHexes);
      expect(unique.size).toBe(lightHexes.length);
    });

    it("should have unique dark-mode hex values", () => {
      const darkHexes = CategoryColors.map((c) => c.dark);
      const unique = new Set(darkHexes);
      expect(unique.size).toBe(darkHexes.length);
    });

    it("should meet WCAG AA for UI elements (≥3:1) against light background", () => {
      for (const token of CategoryColors) {
        const ratio = contrastRatio(token.light, lightBg);
        expect(
          ratio,
          `${token.name} light (${token.light}) vs ${lightBg} = ${ratio.toFixed(2)}:1`
        ).toBeGreaterThanOrEqual(3);
      }
    });

    it("should meet WCAG AA for UI elements (≥3:1) against dark background", () => {
      for (const token of CategoryColors) {
        const ratio = contrastRatio(token.dark, darkBg);
        expect(
          ratio,
          `${token.name} dark (${token.dark}) vs ${darkBg} = ${ratio.toFixed(2)}:1`
        ).toBeGreaterThanOrEqual(3);
      }
    });

    it("should meet WCAG AA for text (≥4.5:1) with white text on light variant", () => {
      for (const token of CategoryColors) {
        const ratio = contrastRatio(token.light, whiteText);
        expect(
          ratio,
          `white text on ${token.name} light (${token.light}) = ${ratio.toFixed(2)}:1`
        ).toBeGreaterThanOrEqual(4.5);
      }
    });

    it("should default to the first token (indigo)", () => {
      expect(CATEGORY_DEFAULT_COLOR).toBe("#4F46E5");
    });
  });

  describe("Semantic Color Reservation", () => {
    it("should reserve success for income/positive semantics only", () => {
      expect(ThemeColors.success.light).toBe("#047857");
      expect(ThemeColors.success.dark).toBe("#34D399");
    });

    it("should reserve error for expense/destructive semantics only", () => {
      expect(ThemeColors.error.light).toBe("#DC2626");
      expect(ThemeColors.error.dark).toBe("#FCA5A5");
    });
  });

  describe("WCAG AA Contrast — All Theme Pairings", () => {
    const fgBgPairs: { name: string; fg: string; bg: string }[] = [];

    for (const scheme of ["light", "dark"] as const) {
      const palette = Colors[scheme];
      const bg = palette.background;
      const surface = palette.surface;

      // Foreground tokens that render as text on background or surface
      const textTokens = [
        { key: "text", value: palette.text },
        { key: "foreground", value: palette.foreground },
        { key: "muted", value: palette.muted },
        { key: "primary", value: palette.primary },
        { key: "success", value: palette.success },
        { key: "warning", value: palette.warning },
        { key: "error", value: palette.error },
        { key: "accent", value: palette.accent },
        { key: "secondary", value: palette.secondary },
      ];

      for (const { key, value } of textTokens) {
        fgBgPairs.push({
          name: `${scheme}:${key} on background`,
          fg: value,
          bg,
        });
        fgBgPairs.push({
          name: `${scheme}:${key} on surface`,
          fg: value,
          bg: surface,
        });
      }
    }

    it.each(fgBgPairs)(
      "should meet AA for normal text (≥4.5:1) — $name",
      ({ fg, bg }) => {
        const ratio = contrastRatio(fg, bg);
        expect(
          ratio,
          `contrast ratio ${ratio.toFixed(2)}:1 for ${fg} on ${bg}`,
        ).toBeGreaterThanOrEqual(4.5);
      },
    );
  });

  describe("WCAG AA Contrast — Category Colors on Surface", () => {
    for (const scheme of ["light", "dark"] as const) {
      const surface = Colors[scheme].surface;

      it(`should meet AA for UI elements (≥3:1) on ${scheme} surface`, () => {
        for (const token of CategoryColors) {
          const color = scheme === "dark" ? token.dark : token.light;
          const ratio = contrastRatio(color, surface);
          expect(
            ratio,
            `${token.name} (${color}) on ${scheme} surface (${surface}) = ${ratio.toFixed(2)}:1`,
          ).toBeGreaterThanOrEqual(3);
        }
      });
    }
  });
});

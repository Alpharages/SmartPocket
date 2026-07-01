import { describe, expect, it } from "vitest";

import {
  THEME_IDS,
  getThemeTokens,
  getCategoryColors,
  type ColorScheme,
  type ThemeId,
} from "@/lib/_core/theme";
import { contrastRatio, readableTextOn } from "@/lib/_core/contrast";

/**
 * Story 12.2 (RDR-2) — verification of record for AC 5/6.
 *
 * Iterates EVERY theme × {light, dark} × token pairing and fails the build on any
 * sub-AA pair. This is the gate the token values are tuned against, not a manual
 * spreadsheet. Reuses the shared WCAG helpers in lib/_core/contrast.ts.
 *
 * Thresholds (WCAG 2.1 AA):
 * - body text / icons on their surface: ≥ 4.5:1
 * - non-text UI (category swatches on a background): ≥ 3:1
 * - on-color text (chip/pill label via readableTextOn): ≥ 4.5:1
 */

const SCHEMES: ColorScheme[] = ["light", "dark"];

// Tokens that render as text/icons directly on background or surface.
const TEXT_TOKENS = [
  "foreground",
  "muted",
  "primary",
  "success",
  "warning",
  "error",
  "accent",
  "secondary",
] as const;

describe("Story 12.2 — WCAG AA contrast matrix (all themes × variants)", () => {
  for (const themeId of THEME_IDS) {
    for (const scheme of SCHEMES) {
      const { colors, category } = getThemeTokens(themeId, scheme);
      const bg = colors.background;
      const surface = colors.surface;

      describe(`${themeId} · ${scheme}`, () => {
        for (const token of TEXT_TOKENS) {
          it(`${token} text meets AA (≥4.5:1) on background and surface`, () => {
            for (const [surfName, surfColor] of [
              ["background", bg],
              ["surface", surface],
            ] as const) {
              const ratio = contrastRatio(colors[token], surfColor);
              expect(
                ratio,
                `${themeId}/${scheme}: ${token} (${colors[token]}) on ${surfName} (${surfColor}) = ${ratio.toFixed(2)}:1`,
              ).toBeGreaterThanOrEqual(4.5);
            }
          });
        }

        it("income (success) and expense (error) are present, distinct, and semantic", () => {
          expect(colors.success).toBeTruthy();
          expect(colors.error).toBeTruthy();
          expect(colors.success.toLowerCase()).not.toBe(
            colors.error.toLowerCase(),
          );
        });

        it("category map has 10 tokens with unique light and dark hexes", () => {
          expect(category).toHaveLength(10);
          const lights = category.map((c) => c.light.toLowerCase());
          const darks = category.map((c) => c.dark.toLowerCase());
          expect(new Set(lights).size).toBe(10);
          expect(new Set(darks).size).toBe(10);
        });

        it("every category color meets AA (≥3:1 vs bg/surface, ≥4.5:1 vs its on-color text)", () => {
          for (const token of category) {
            const swatch = scheme === "dark" ? token.dark : token.light;
            for (const [surfName, surfColor] of [
              ["background", bg],
              ["surface", surface],
            ] as const) {
              const uiRatio = contrastRatio(swatch, surfColor);
              expect(
                uiRatio,
                `${themeId}/${scheme}: category ${token.name} (${swatch}) on ${surfName} (${surfColor}) = ${uiRatio.toFixed(2)}:1`,
              ).toBeGreaterThanOrEqual(3);
            }
            const ink = readableTextOn(swatch);
            const textRatio = contrastRatio(ink, swatch);
            expect(
              textRatio,
              `${themeId}/${scheme}: on-color text ${ink} on category ${token.name} (${swatch}) = ${textRatio.toFixed(2)}:1`,
            ).toBeGreaterThanOrEqual(4.5);
          }
        });
      });
    }
  }

  it("getCategoryColors(themeId) returns each theme's own distinct map", () => {
    const maps = THEME_IDS.map((id: ThemeId) =>
      getCategoryColors(id)
        .map((c) => c.light)
        .join(","),
    );
    // No two themes share an identical category palette.
    expect(new Set(maps).size).toBe(THEME_IDS.length);
  });

  it("obsidian dark resolves to its authored identity (QA scenario)", () => {
    const obsidian = getThemeTokens("obsidian", "dark");
    expect(obsidian.colors.background).toBe("#0F172A");
    expect(obsidian.colors.success).toBe("#34D399"); // income
    expect(obsidian.colors.error).toBe("#F87171"); // expense
    expect(obsidian.gradient.colors).toEqual(["#16213E", "#0F172A"]);
    // distinct from the other two themes' backgrounds
    expect(obsidian.colors.background).not.toBe(
      getThemeTokens("aurora", "dark").colors.background,
    );
    expect(obsidian.colors.background).not.toBe(
      getThemeTokens("spectrum", "dark").colors.background,
    );
  });
});

import { describe, expect, it } from "vitest";

import { THEME_IDS, type ColorScheme, getThemeTokens } from "@/lib/_core/theme";
import { meetsAA, readableTextOn } from "@/lib/_core/contrast";
import {
  glassInkRequirements,
  resolveGradientInk,
  resolveOpaqueGlassFill,
  compositeOver,
} from "@/lib/_core/glass";

/**
 * Story 12.10 (RDR-9) — the canonical AA gate. Iterates every theme ×
 * variant (6 combinations) and asserts every rendered text/UI pairing this
 * app actually composites — semantic tokens, category colors, AND text over
 * glass/gradient surfaces — clears WCAG 2.1 AA via the shared `meetsAA()`
 * predicate. Semantic-token and category-color coverage already exists in
 * `tests/theme-aa-contrast.test.ts` (Story 12.2) and the glass/gradient
 * scrim math in `tests/lib/glass.test.ts` (Story 12.3); this suite is the
 * single place that asserts the FULL picture together using the new
 * `meetsAA()` predicate, so a reviewer only needs one file to confirm AC1/AC6.
 */

const SCHEMES: ColorScheme[] = ["light", "dark"];

/** Effective gradient stops after the resolved scrim (if any) is layered on. */
function scrimmedStops(
  stops: readonly string[],
  scrim: string | null,
): string[] {
  if (!scrim) return [...stops];
  const match = scrim.match(/^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/);
  if (!match) return [scrim];
  const [, r, g, b, alpha] = match;
  const hex = `#${[r, g, b].map((c) => Number(c).toString(16).padStart(2, "0")).join("")}`;
  return stops.map((stop) => compositeOver(hex, Number(alpha), stop));
}

describe("Story 12.10 — AA contrast matrix (semantic + category + glass + gradient, all 6 combinations)", () => {
  for (const themeId of THEME_IDS) {
    for (const scheme of SCHEMES) {
      describe(`${themeId} · ${scheme}`, () => {
        const tokens = getThemeTokens(themeId, scheme);
        const { colors, glass, gradient, category } = tokens;

        it("semantic text tokens meet AA (>=4.5:1) on background and surface", () => {
          const textTokens = [
            "foreground",
            "muted",
            "primary",
            "success",
            "warning",
            "error",
            "accent",
            "secondary",
          ] as const;
          for (const token of textTokens) {
            for (const bg of [colors.background, colors.surface]) {
              expect(
                meetsAA(colors[token], bg),
                `${token} (${colors[token]}) on ${bg}`,
              ).toBe(true);
            }
          }
        });

        it("category colors meet AA (>=3:1 UI, >=4.5:1 on-color text)", () => {
          for (const cat of category) {
            const swatch = scheme === "dark" ? cat.dark : cat.light;
            for (const bg of [colors.background, colors.surface]) {
              expect(
                meetsAA(swatch, bg, true),
                `${cat.name} (${swatch}) on ${bg}`,
              ).toBe(true);
            }
            const ink = readableTextOn(swatch);
            expect(meetsAA(ink, swatch)).toBe(true);
          }
        });

        it("text over the resolved on-glass fill meets each ink's AA bar", () => {
          const requirements = glassInkRequirements(colors);
          const fill = resolveOpaqueGlassFill(
            glass,
            colors.surface,
            requirements,
          );
          for (const [ink, minRatio] of requirements) {
            expect(
              meetsAA(ink, fill, minRatio === 3),
              `ink ${ink} on on-glass fill ${fill}`,
            ).toBe(true);
          }
        });

        it("text over the hero gradient (post-scrim where applied) meets AA (>=4.5:1)", () => {
          const { ink, scrim } = resolveGradientInk(gradient.colors);
          for (const stop of scrimmedStops(gradient.colors, scrim)) {
            expect(meetsAA(ink, stop), `ink ${ink} on stop ${stop}`).toBe(true);
          }
        });
      });
    }
  }
});

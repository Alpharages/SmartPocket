/**
 * Accessibility policy helpers (Story 12.10, RDR-9).
 *
 * Complements `lib/_core/contrast.ts` (WCAG math) and `lib/_core/glass.ts`
 * (the glass/gradient AA guarantees) with the remaining a11y-specific policy:
 * how far numeric/amount text is allowed to scale with OS dynamic type, and a
 * general-purpose scrim finder for a single translucent fill.
 */

import { ON_LIGHT_INK, contrastRatio, readableTextOn } from "./contrast";
import { compositeOver, toRgba } from "./glass";

/**
 * Cap applied via `maxFontSizeMultiplier` to numeric/amount text (balance
 * hero, StatCard, the add-transaction amount field) — the exact 200% dynamic
 * type ceiling AC5 requires the app to support, applied as a ceiling here so
 * a fixed-width currency figure scales with the OS setting without clipping
 * or wrapping past what its container can hold. Other text (labels, body
 * copy) scales without this cap.
 */
export const MAX_FONT_SCALE = 2;

/**
 * Finds the lightest scrim (black under white ink, white under dark ink, in
 * 5% steps) that brings `readableTextOn(fill)` text up to `targetRatio`
 * against `fill` — the single-background counterpart to
 * `resolveGradientInk`'s per-stop scrim search in `lib/_core/glass.ts`
 * (which picks one ink across multiple gradient stops; this picks one ink
 * for one fill). Returns `scrim: null` when the raw fill already clears the
 * bar.
 */
export function minContrastScrim(
  fill: string,
  targetRatio: number,
): { ink: string; scrim: string | null } {
  const ink = readableTextOn(fill);
  if (contrastRatio(ink, fill) >= targetRatio) return { ink, scrim: null };
  const scrimBase = ink === ON_LIGHT_INK ? "#000000" : "#FFFFFF";
  for (let step = 1; step < 20; step++) {
    const opacity = step / 20;
    const scrimmed = compositeOver(scrimBase, opacity, fill);
    if (contrastRatio(ink, scrimmed) >= targetRatio) {
      return { ink, scrim: toRgba(scrimBase, opacity) };
    }
  }
  return { ink, scrim: scrimBase };
}

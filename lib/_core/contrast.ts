/**
 * WCAG 2.1 contrast utilities — single source of truth shared by theme-token
 * tests and the UI primitives that render text on a filled control.
 *
 * Why this exists: filled/active controls (Button income/destructive/primary,
 * the selected Pill/segment) must NOT hardcode white text. A dark-theme "light
 * tint" token (e.g. primary #818CF8, success #34D399, error #FCA5A5) is tuned
 * as a foreground-on-dark and only reaches ~1.9–3.0:1 behind white — failing
 * AA — yet clears AA comfortably behind near-black ink. `readableTextOn` picks
 * whichever ink maximises contrast against the fill, so AC1 holds on both
 * themes without changing the tokens (which are still correct as foregrounds).
 */

/** Parse a 3- or 6-digit hex color to RGB. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const bigint = parseInt(full, 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

/** Relative luminance of an sRGB hex color (WCAG 2.1). */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** WCAG contrast ratio between two hex colors (1–21). */
export function contrastRatio(a: string, b: string): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Near-black ink (= foreground.light) used as the dark text candidate. */
export const ON_DARK_INK = "#111827";
/** White, the light text candidate. */
export const ON_LIGHT_INK = "#FFFFFF";

/**
 * Pick the higher-contrast text color for text rendered directly on `fill`.
 * Returns `light` (white) or `dark` (near-black ink) — whichever maximises WCAG
 * contrast against the fill. Non-hex fills (e.g. "transparent") fall back to
 * white, matching the previous behaviour for variants that never used a fill.
 */
export function readableTextOn(
  fill: string,
  light: string = ON_LIGHT_INK,
  dark: string = ON_DARK_INK,
): string {
  if (!HEX_RE.test(fill)) return light;
  return contrastRatio(light, fill) >= contrastRatio(dark, fill) ? light : dark;
}

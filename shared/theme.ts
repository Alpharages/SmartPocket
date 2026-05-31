/**
 * Server-safe theme constants.
 *
 * This file contains only raw values (no React Native imports) so that both
 * client and server code can import it. It is the SINGLE SOURCE OF TRUTH for
 * the category color tokens and their assignment/resolution helpers — the
 * client theme module (`lib/_core/theme.ts`) re-exports everything here rather
 * than redefining it. Client-side theme resolution (platform-aware fonts,
 * runtime palette building, etc.) lives in `lib/_core/theme.ts`.
 */

import themeConfig from "../theme.config";

type Scheme = "light" | "dark";

/**
 * Category color token: a named light/dark hex pair.
 */
export type CategoryColorToken = {
  name: string;
  light: string;
  dark: string;
};

export const CategoryColors: readonly CategoryColorToken[] =
  themeConfig.categoryColors;

/**
 * All light-mode category hex values as a flat array.
 * Useful for color pickers and deterministic assignment.
 */
export const CATEGORY_COLOR_LIGHT_VALUES = CategoryColors.map((c) => c.light);

/**
 * All dark-mode category hex values, index-aligned with the light values.
 */
export const CATEGORY_COLOR_DARK_VALUES = CategoryColors.map((c) => c.dark);

/**
 * Default category color used when none is supplied.
 * This is the first token in the category palette (indigo).
 */
export const CATEGORY_DEFAULT_COLOR = CategoryColors[0].light;

/** Reverse lookup: stored light hex -> dark variant. Light values are unique. */
const LIGHT_TO_DARK = new Map(
  CategoryColors.map((c) => [c.light.toLowerCase(), c.dark] as const),
);

/**
 * Deterministic category color assignment by numeric ID/index.
 * Returns a stable hex for the given index, wrapping when it exceeds the
 * palette length. Pass `scheme` to get the theme-appropriate variant.
 */
export function getCategoryColorByIndex(
  index: number,
  scheme: Scheme = "light",
): string {
  const values =
    scheme === "dark"
      ? CATEGORY_COLOR_DARK_VALUES
      : CATEGORY_COLOR_LIGHT_VALUES;
  return values[index % values.length];
}

/**
 * Resolve a stored category color to the variant for the current theme.
 * Stored colors are canonical light-mode hexes; in dark mode this maps a known
 * palette token to its dark variant. Unknown/legacy/custom colors (e.g. the
 * retired teal still present on old rows) are returned unchanged.
 */
export function resolveCategoryColor(
  stored: string,
  scheme: Scheme = "light",
): string {
  if (scheme !== "dark" || !stored) return stored;
  return LIGHT_TO_DARK.get(stored.toLowerCase()) ?? stored;
}

/**
 * Hash a string (e.g. category name) to a consistent palette index.
 * Simple djb2-style hash — deterministic and fast.
 */
export function hashToPaletteIndex(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return hash % CATEGORY_COLOR_LIGHT_VALUES.length;
}

/**
 * Get a deterministic category color by hashing the category name.
 * Used to seed a distinct palette color for new categories when no explicit
 * color is chosen, so categories don't all collide on the default token.
 */
export function getCategoryColorForName(
  name: string,
  scheme: Scheme = "light",
): string {
  return getCategoryColorByIndex(hashToPaletteIndex(name), scheme);
}

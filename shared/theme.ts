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
import type { ThemeId } from "../theme.config";

type Scheme = "light" | "dark";

/**
 * Category color token: a named light/dark hex pair.
 */
export type CategoryColorToken = {
  name: string;
  light: string;
  dark: string;
};

/** First-run / fallback theme identity — mirrors theme.config's default. */
export const DEFAULT_THEME_ID = themeConfig.DEFAULT_THEME_ID;

/**
 * Per-theme category color map (Story 12.2, RDR-2). Each theme owns a distinct
 * 10-token map tuned to its identity; the resolver/selector helpers below thread
 * an optional `themeId` (defaulting to the default theme) so every pre-existing
 * caller keeps today's behavior while new callers can request a theme's map.
 */
export function getCategoryColors(
  themeId: ThemeId = DEFAULT_THEME_ID,
): readonly CategoryColorToken[] {
  return themeConfig.themes[themeId]?.category ?? themeConfig.categoryColors;
}

/**
 * Default theme's category map. Kept as `CategoryColors` (the pre-12.2 export)
 * so existing consumers and tests are untouched — it now aliases the default
 * theme's per-theme map.
 */
export const CategoryColors: readonly CategoryColorToken[] = getCategoryColors();

/**
 * All light-mode category hex values (default theme) as a flat array.
 * Useful for color pickers and deterministic assignment.
 */
export const CATEGORY_COLOR_LIGHT_VALUES = CategoryColors.map((c) => c.light);

/**
 * All dark-mode category hex values (default theme), index-aligned with light.
 */
export const CATEGORY_COLOR_DARK_VALUES = CategoryColors.map((c) => c.dark);

/**
 * Default category color used when none is supplied.
 * This is the first token in the default theme's category palette.
 */
export const CATEGORY_DEFAULT_COLOR = CategoryColors[0].light;

/** Default Ionicons glyph for categories without an explicit icon. */
export const DEFAULT_CATEGORY_ICON = "pricetag-outline";

/**
 * Normalize a stored category icon name. Maps the legacy default `"tag"` (not a
 * valid Ionicons name) to {@link DEFAULT_CATEGORY_ICON}.
 */
export function resolveCategoryIcon(icon?: string | null): string {
  if (!icon || icon === "tag") return DEFAULT_CATEGORY_ICON;
  return icon;
}

/**
 * Reverse lookup: stored light hex -> dark variant, per theme. Light values are
 * unique within a theme. Built lazily and memoised so custom stored colors from
 * any theme's palette resolve to that theme's dark variant.
 */
const lightToDarkByTheme = new Map<ThemeId, Map<string, string>>();
function lightToDark(themeId: ThemeId): Map<string, string> {
  let map = lightToDarkByTheme.get(themeId);
  if (!map) {
    map = new Map(
      getCategoryColors(themeId).map(
        (c) => [c.light.toLowerCase(), c.dark] as const,
      ),
    );
    lightToDarkByTheme.set(themeId, map);
  }
  return map;
}

/**
 * Deterministic category color assignment by numeric ID/index.
 * Returns a stable hex for the given index, wrapping when it exceeds the
 * palette length. Pass `scheme` to get the theme-appropriate variant and
 * `themeId` to select a theme's palette (defaults to the default theme).
 */
export function getCategoryColorByIndex(
  index: number,
  scheme: Scheme = "light",
  themeId: ThemeId = DEFAULT_THEME_ID,
): string {
  const palette = getCategoryColors(themeId);
  const token = palette[index % palette.length];
  return scheme === "dark" ? token.dark : token.light;
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
  themeId: ThemeId = DEFAULT_THEME_ID,
): string {
  if (scheme !== "dark" || !stored) return stored;
  return lightToDark(themeId).get(stored.toLowerCase()) ?? stored;
}

/**
 * Hash a string (e.g. category name) to a consistent palette index.
 * Simple djb2-style hash — deterministic and fast.
 */
export function hashToPaletteIndex(
  input: string,
  themeId: ThemeId = DEFAULT_THEME_ID,
): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return hash % getCategoryColors(themeId).length;
}

/**
 * Get a deterministic category color by hashing the category name.
 * Used to seed a distinct palette color for new categories when no explicit
 * color is chosen, so categories don't all collide on the default token.
 */
export function getCategoryColorForName(
  name: string,
  scheme: Scheme = "light",
  themeId: ThemeId = DEFAULT_THEME_ID,
): string {
  return getCategoryColorByIndex(hashToPaletteIndex(name, themeId), scheme, themeId);
}

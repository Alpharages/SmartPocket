/**
 * Thin re-exports so consumers don't need to know about internal theme plumbing.
 * Full implementation lives in lib/_core/theme.ts.
 */
export {
  Colors,
  Fonts,
  SchemeColors,
  ThemeColors,
  Spacing,
  Radius,
  Typography,
  Elevation,
  THEMES,
  THEME_IDS,
  DEFAULT_THEME_ID,
  getThemeTokens,
  CategoryColors,
  CATEGORY_COLOR_LIGHT_VALUES,
  CATEGORY_COLOR_DARK_VALUES,
  CATEGORY_DEFAULT_COLOR,
  DEFAULT_CATEGORY_ICON,
  getCategoryColors,
  getCategoryColorByIndex,
  getCategoryColorForName,
  hashToPaletteIndex,
  resolveCategoryColor,
  resolveCategoryIcon,
  type ColorScheme,
  type ThemeId,
  type ThemeColorPalette,
  type ResolvedThemeTokens,
  type CategoryColorToken,
} from "@/lib/_core/theme";

// Per-theme token shapes (Story 12.2, RDR-2) — surfaced so glass/hero consumers
// (Stories 12.3/12.4) import from the barrel rather than reaching into theme.config.
export type { GradientToken, GlassToken } from "@/theme.config";

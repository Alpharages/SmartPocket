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

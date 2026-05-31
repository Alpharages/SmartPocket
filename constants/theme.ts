/**
 * Thin re-exports so consumers don't need to know about internal theme plumbing.
 * Full implementation lives in lib/_core/theme.ts.
 */
export {
  Colors,
  Fonts,
  SchemeColors,
  ThemeColors,
  CategoryColors,
  CATEGORY_COLOR_LIGHT_VALUES,
  CATEGORY_COLOR_DARK_VALUES,
  CATEGORY_DEFAULT_COLOR,
  getCategoryColorByIndex,
  getCategoryColorForName,
  hashToPaletteIndex,
  resolveCategoryColor,
  type ColorScheme,
  type ThemeColorPalette,
  type CategoryColorToken,
} from "@/lib/_core/theme";

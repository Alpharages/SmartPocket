import { Platform } from "react-native";

import themeConfig from "@/theme.config";
import type { ThemeId as ThemeIdType, ThemeTokenSet } from "@/theme.config";

export type ColorScheme = "light" | "dark";

/** Theme identity axis (Story 12.1, RDR-1) — orthogonal to light/dark mode. */
export type ThemeId = ThemeIdType;

/** Full theme registry — each entry is a complete, swappable token set. */
export const THEMES = themeConfig.themes;

/** First-run default theme identity (Aurora Glass — Epic 12's hero theme). */
export const DEFAULT_THEME_ID: ThemeId = themeConfig.DEFAULT_THEME_ID;

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];

export const ThemeColors = themeConfig.themeColors;

export const Spacing = themeConfig.spacing;

export const Radius = themeConfig.radius;

export const Typography = themeConfig.typography;

export const Elevation = themeConfig.elevation;

export const Motion = themeConfig.motion;

// Maximum content widths (px) used to cap and center mobile-first layouts on
// web so they don't stretch edge-to-edge. Native layouts stay unconstrained.
// Single source of truth — screens/sheets reference these instead of inlining
// the same literals.
export const ContentMaxWidth = {
  dashboard: 1120,
  screen: 960,
  sheet: 560,
  modal: 640,
  card: 420,
} as const;

type ThemeColorTokens = typeof ThemeColors;
type ThemeColorName = keyof ThemeColorTokens;
type SchemePalette = Record<ColorScheme, Record<ThemeColorName, string>>;
type SchemePaletteItem = SchemePalette[ColorScheme];

function buildSchemePalette(colors: ThemeColorTokens): SchemePalette {
  const palette: SchemePalette = {
    light: {} as SchemePalette["light"],
    dark: {} as SchemePalette["dark"],
  };

  (Object.keys(colors) as ThemeColorName[]).forEach((name) => {
    const swatch = colors[name];
    palette.light[name] = swatch.light;
    palette.dark[name] = swatch.dark;
  });

  return palette;
}

export const SchemeColors = buildSchemePalette(ThemeColors);

export type ResolvedThemeTokens = {
  themeId: ThemeId;
  colorScheme: ColorScheme;
  colors: Record<ThemeColorName, string>;
  gradient: ThemeTokenSet["gradient"];
  glass: ThemeTokenSet["glass"];
  elevation: ThemeTokenSet["elevation"];
  motion: ThemeTokenSet["motion"];
};

/** Resolves a theme identity + color scheme to its complete token set. */
export function getThemeTokens(
  themeId: ThemeId,
  colorScheme: ColorScheme,
): ResolvedThemeTokens {
  const theme = THEMES[themeId] ?? THEMES[DEFAULT_THEME_ID];
  return {
    themeId,
    colorScheme,
    colors: buildSchemePalette(theme.color)[colorScheme],
    gradient: theme.gradient,
    glass: theme.glass,
    elevation: theme.elevation,
    motion: theme.motion,
  };
}

type RuntimePalette = SchemePaletteItem & {
  text: string;
  background: string;
  tint: string;
  icon: string;
  tabIconDefault: string;
  tabIconSelected: string;
  border: string;
  accent?: string;
  secondary?: string;
};

function buildRuntimePalette(scheme: ColorScheme): RuntimePalette {
  const base = SchemeColors[scheme];
  return {
    ...base,
    text: base.foreground,
    background: base.background,
    tint: base.primary,
    icon: base.muted,
    tabIconDefault: base.muted,
    tabIconSelected: base.primary,
    border: base.border,
  };
}

export const Colors = {
  light: buildRuntimePalette("light"),
  dark: buildRuntimePalette("dark"),
} satisfies Record<ColorScheme, RuntimePalette>;

export type ThemeColorPalette = (typeof Colors)[ColorScheme];

// Category color tokens and their assignment/resolution helpers live in the
// server-safe `shared/theme` module (single source of truth). Re-exported here
// so client code can keep importing them from `@/constants/theme`.
export {
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
  type CategoryColorToken,
} from "@/shared/theme";

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

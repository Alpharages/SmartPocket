import { Platform, type ViewStyle } from "react-native";

import themeConfig from "@/theme.config";
import type {
  CategoryColorToken,
  GlassToken,
  GradientToken,
  ThemeId as ThemeIdType,
} from "@/theme.config";

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

type ElevationLevel = keyof typeof Elevation;

// Native shadow specs per elevation tier — mirrors the ad-hoc shadow/elevation
// literals already used across the app's cards.
const NATIVE_ELEVATION_SHADOWS: Record<
  ElevationLevel,
  { offset: number; opacity: number; radius: number; elevation: number }
> = {
  none: { offset: 0, opacity: 0, radius: 0, elevation: 0 },
  sm: { offset: 2, opacity: 0.04, radius: 6, elevation: 2 },
  md: { offset: 2, opacity: 0.12, radius: 8, elevation: 4 },
  lg: { offset: 8, opacity: 0.25, radius: 16, elevation: 8 },
};

/**
 * Resolves a theme elevation level to a platform-appropriate shadow style —
 * a `boxShadow` CSS string (the `Elevation` token) on web, RN shadow/elevation
 * numeric props on native — so primitives read shadows from theme tokens
 * instead of hardcoding shadow literals per component (Story 12.3, AC4).
 * `shadowColor` stays caller-supplied since some surfaces want a colored glow
 * (e.g. the StatCard hero's primary-tinted shadow) rather than a neutral one.
 */
export function getElevationStyle(
  level: ElevationLevel,
  shadowColor: string,
): ViewStyle {
  if (Platform.OS === "web") {
    return level === "none" ? {} : { boxShadow: Elevation[level] };
  }
  const spec = NATIVE_ELEVATION_SHADOWS[level];
  if (spec.elevation === 0) return { elevation: 0 };
  return {
    shadowColor,
    shadowOffset: { width: 0, height: spec.offset },
    shadowOpacity: spec.opacity,
    shadowRadius: spec.radius,
    elevation: spec.elevation,
  };
}

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
  /** Hero gradient for the resolved variant (flattened from the theme's light/dark pair). */
  gradient: GradientToken;
  /** Glass params for the resolved variant. */
  glass: GlassToken;
  /** This theme's category color map (each token still carries light + dark). */
  category: readonly CategoryColorToken[];
  elevation: (typeof THEMES)[ThemeId]["elevation"];
  motion: (typeof THEMES)[ThemeId]["motion"];
};

/** Resolves a theme identity + color scheme to its complete token set. */
export function getThemeTokens(
  themeId: ThemeId,
  colorScheme: ColorScheme,
): ResolvedThemeTokens {
  const resolvedId = THEMES[themeId] ? themeId : DEFAULT_THEME_ID;
  const theme = THEMES[resolvedId];
  return {
    themeId: resolvedId,
    colorScheme,
    colors: buildSchemePalette(theme.color)[colorScheme],
    gradient: theme.gradient[colorScheme],
    glass: theme.glass[colorScheme],
    category: theme.category,
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
  getCategoryColors,
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

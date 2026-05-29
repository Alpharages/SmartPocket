/** @type {const} */
const themeColors = {
  // Refined minimal palette - softer, more premium feel
  primary: { light: "#4F46E5", dark: "#818CF8" }, // Deep Indigo
  background: { light: "#F8FAFC", dark: "#0B0F19" }, // Soft white / Deep void
  surface: { light: "#FFFFFF", dark: "#151B2B" }, // Pure white / Elevated dark
  foreground: { light: "#111827", dark: "#F1F5F9" }, // Near black / Soft white
  muted: { light: "#6B7280", dark: "#9CA3AF" }, // Neutral gray
  border: { light: "#E5E7EB", dark: "#2D3748" }, // Subtle borders
  success: { light: "#059669", dark: "#34D399" }, // Forest green
  warning: { light: "#D97706", dark: "#FBBF24" }, // Warm amber
  error: { light: "#DC2626", dark: "#FCA5A5" }, // Clean red
  accent: { light: "#DB2777", dark: "#F472B6" }, // Rose accent
  secondary: { light: "#7C3AED", dark: "#A78BFA" }, // Violet
};

/** @type {const} */
const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
};

/** @type {const} */
const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 9999,
};

/** @type {const} */
const typography = {
  display: { fontSize: 36, lineHeight: 40, fontWeight: "700" },
  h1: { fontSize: 30, lineHeight: 36, fontWeight: "700" },
  h2: { fontSize: 24, lineHeight: 32, fontWeight: "600" },
  h3: { fontSize: 20, lineHeight: 28, fontWeight: "600" },
  body: { fontSize: 16, lineHeight: 24, fontWeight: "400" },
  label: { fontSize: 14, lineHeight: 20, fontWeight: "500" },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "400" },
  number: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
};

/**
 * Elevation shadows. The shadow color derives from the `foreground` token via
 * `var(--color-foreground)` (set per-theme in lib/theme-provider.tsx), so shadows
 * adapt to light/dark automatically — a dark shadow on light surfaces, a soft light
 * shadow on dark surfaces — instead of a fixed black. `color-mix` applies the alpha.
 * @type {const}
 */
const elevation = {
  none: "0 0 0 0 transparent",
  sm: "0 1px 2px 0 color-mix(in srgb, var(--color-foreground) 8%, transparent)",
  md: "0 4px 6px -1px color-mix(in srgb, var(--color-foreground) 12%, transparent), 0 2px 4px -2px color-mix(in srgb, var(--color-foreground) 10%, transparent)",
  lg: "0 10px 15px -3px color-mix(in srgb, var(--color-foreground) 12%, transparent), 0 4px 6px -4px color-mix(in srgb, var(--color-foreground) 10%, transparent)",
};

module.exports = { themeColors, spacing, radius, typography, elevation };

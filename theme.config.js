/** @type {const} */
const themeColors = {
  // Refined minimal palette - softer, more premium feel
  primary: { light: "#4F46E5", dark: "#818CF8" }, // Deep Indigo
  background: { light: "#F8FAFC", dark: "#0B0F19" }, // Soft white / Deep void
  surface: { light: "#FFFFFF", dark: "#151B2B" }, // Pure white / Elevated dark
  foreground: { light: "#111827", dark: "#F1F5F9" }, // Near black / Soft white
  muted: { light: "#6B7280", dark: "#9CA3AF" }, // Neutral gray
  border: { light: "#E5E7EB", dark: "#2D3748" }, // Subtle borders
  success: { light: "#047857", dark: "#34D399" }, // Forest green — semantic only (income/positive)
  warning: { light: "#B45309", dark: "#FBBF24" }, // Warm amber
  error: { light: "#DC2626", dark: "#FCA5A5" }, // Clean red — semantic only (expense/destructive)
  accent: { light: "#BE185D", dark: "#F472B6" }, // Rose accent — rare, small highlights
  secondary: { light: "#7C3AED", dark: "#A78BFA" }, // Violet
  overlay: { light: "#000000", dark: "#000000" }, // Backdrop / modal scrim
};

/**
 * Data-driven category color token map.
 * Each token provides light/dark variants tuned for WCAG AA:
 * - ≥ 4.5:1 against white text (used on category chips/pills)
 * - ≥ 3:1 against light (#F8FAFC) and dark (#0B0F19) backgrounds for UI elements
 *
 * The palette wraps when categories exceed its length.
 */
/** @type {const} */
const categoryColors = [
  { name: "indigo", light: "#4F46E5", dark: "#818CF8" },
  { name: "emerald", light: "#047857", dark: "#34D399" },
  { name: "rose", light: "#E11D48", dark: "#FB7185" },
  { name: "amber", light: "#B45309", dark: "#FCD34D" },
  { name: "violet", light: "#7C3AED", dark: "#A78BFA" },
  { name: "cyan", light: "#0E7490", dark: "#22D3EE" },
  { name: "orange", light: "#C2410C", dark: "#FB923C" },
  { name: "pink", light: "#DB2777", dark: "#F472B6" },
  { name: "blue", light: "#2563EB", dark: "#60A5FA" },
  { name: "teal", light: "#0F766E", dark: "#2DD4BF" },
];

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
  // Dense micro-labels (month badge, card-label chip) that sit below the
  // caption scale. Preserves the prior 10px literal as a named token.
  micro: { fontSize: 10, lineHeight: 14, fontWeight: "400" },
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

/** Sheet / modal motion — ~250ms fade + slide (Story 1.9). */
const motion = {
  sheet: {
    durationMs: 250,
    /** Maps to Reanimated Easing.out(Easing.cubic) in Sheet.tsx */
    easing: "easeOutCubic",
    backdropOpacity: 0.65,
    dragDismissThreshold: 0.35,
  },
};

module.exports = {
  themeColors,
  categoryColors,
  spacing,
  radius,
  typography,
  elevation,
  motion,
};

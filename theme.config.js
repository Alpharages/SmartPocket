/** @type {const} */
const themeColors = {
  // Refined minimal palette - softer, more premium feel
  primary: { light: "#4F46E5", dark: "#818CF8" }, // Deep Indigo
  background: { light: "#F8FAFC", dark: "#0B0F19" }, // Soft white / Deep void
  surface: { light: "#FFFFFF", dark: "#151B2B" }, // Pure white / Elevated dark
  foreground: { light: "#111827", dark: "#F1F5F9" }, // Near black / Soft white
  muted: { light: "#6B7280", dark: "#9CA3AF" }, // Neutral gray
  border: { light: "#E5E7EB", dark: "#2D3748" }, // Subtle borders
  success: { light: "#047857", dark: "#6EE7B7" }, // Forest green — semantic only (income/positive)
  warning: { light: "#B45309", dark: "#FBBF24" }, // Warm amber
  error: { light: "#DC2626", dark: "#FCA5A5" }, // Clean red — semantic only (expense/destructive)
  accent: { light: "#BE185D", dark: "#F472B6" }, // Rose accent — rare, small highlights
  secondary: { light: "#7C3AED", dark: "#A78BFA" }, // Violet
  overlay: { light: "#000000", dark: "#000000" }, // Backdrop / modal scrim
};

/**
 * Data-driven category color token map (Aurora — cool indigo/violet/cyan-led).
 * Each token provides light/dark variants tuned for WCAG AA:
 * - ≥ 4.5:1 against its on-color text (used on category chips/pills)
 * - ≥ 3:1 against the theme's light and dark backgrounds for UI elements
 *
 * The palette wraps when categories exceed its length. This is Aurora's map and
 * the top-level `categoryColors` alias (the default theme) — Obsidian and
 * Spectrum own their own maps in the registry below (Story 12.2, RDR-2).
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

/**
 * Tailwind `boxShadow` tokens for NativeWind className utilities (`shadow-sm`, etc.).
 * NativeWind's native CSS pipeline cannot parse `color-mix()` inside shadow values —
 * it truncates at the comma and emits invalid CSS (`color-mix(in;`), which breaks Metro.
 * Use fixed rgba approximations here; keep theme-aware `elevation` for StyleSheet/web.
 * @type {const}
 */
const tailwindBoxShadow = {
  none: "0 0 0 0 transparent",
  sm: "0 1px 2px 0 rgba(17, 24, 39, 0.08)",
  md: "0 4px 6px -1px rgba(17, 24, 39, 0.12), 0 2px 4px -2px rgba(17, 24, 39, 0.10)",
  lg: "0 10px 15px -3px rgba(17, 24, 39, 0.12), 0 4px 6px -4px rgba(17, 24, 39, 0.10)",
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

// ===========================================================================
// Theme registry (Story 12.2, RDR-2)
// ---------------------------------------------------------------------------
// Each theme is a complete, swappable token set: color {light,dark} for every
// semantic token, a hero `gradient` and `glass` params PER variant, `elevation`
// (shared), `motion` (shared), and a per-theme `category` map. `income`/`expense`
// (success/error) stay strictly semantic — green income, red expense — in every
// cell. AA is verified programmatically by tests/theme-aa-contrast.test.ts.
//
// `aurora` reuses the shipped Refined Indigo palette (kept as the top-level
// aliases so tailwind.config.js / shared/theme.ts / existing tests are untouched
// — Lore: "restructure config additively, keep pre-existing exports as live
// aliases"). Obsidian and Spectrum are authored distinctly below.
// ===========================================================================

/** Aurora Glass — indigo→violet→cyan aurora over deep void, translucent glass. */
const auroraTheme = {
  color: themeColors,
  gradient: {
    dark: { colors: ["#6366F1", "#A855F7", "#22D3EE"], angle: 135 },
    light: { colors: ["#818CF8", "#C4B5FD", "#67E8F9"], angle: 135 },
  },
  glass: {
    dark: { blur: 24, tint: "#FFFFFF", surfaceOpacity: 0.08, borderOpacity: 0.16 },
    light: { blur: 20, tint: "#FFFFFF", surfaceOpacity: 0.6, borderOpacity: 0.4 },
  },
  elevation,
  motion,
  category: categoryColors,
};

/** Obsidian & Gold — near-black navy with gold accents (light = ivory & gold). */
const obsidianTheme = {
  color: {
    primary: { light: "#854D0E", dark: "#EAB308" }, // deep gold text / bright gold on navy
    background: { light: "#FBF7EC", dark: "#0F172A" }, // ivory / navy
    surface: { light: "#FFFDF8", dark: "#1E293B" }, // warm white / elevated navy
    foreground: { light: "#1E293B", dark: "#E2E8F0" }, // navy ink / soft slate
    muted: { light: "#57534E", dark: "#94A3B8" }, // warm gray / slate
    border: { light: "#E7E0CF", dark: "#334155" }, // warm border / slate border
    success: { light: "#047857", dark: "#34D399" }, // income green — semantic only
    warning: { light: "#B45309", dark: "#FBBF24" },
    error: { light: "#DC2626", dark: "#F87171" }, // expense red — semantic only
    accent: { light: "#A16207", dark: "#F59E0B" }, // gold accent
    secondary: { light: "#9A3412", dark: "#FCD34D" }, // bronze / amber
    overlay: { light: "#000000", dark: "#000000" },
  },
  gradient: {
    dark: { colors: ["#16213E", "#0F172A"], angle: 135 }, // navy with gold-radial feel
    light: { colors: ["#FDF7E8", "#F5EAD0"], angle: 135 }, // ivory & warm gold
  },
  glass: {
    dark: { blur: 24, tint: "#CA8A04", surfaceOpacity: 0.06, borderOpacity: 0.2 },
    light: { blur: 18, tint: "#CA8A04", surfaceOpacity: 0.12, borderOpacity: 0.3 },
  },
  elevation,
  motion,
  category: [
    { name: "gold", light: "#A16207", dark: "#EAB308" },
    { name: "amber", light: "#B45309", dark: "#FCD34D" },
    { name: "bronze", light: "#9A3412", dark: "#F59E0B" },
    { name: "terracotta", light: "#C2410C", dark: "#FB923C" },
    { name: "olive", light: "#4D7C0F", dark: "#A3E635" },
    { name: "teal", light: "#0F766E", dark: "#2DD4BF" },
    { name: "sky", light: "#0369A1", dark: "#38BDF8" },
    { name: "indigo", light: "#4338CA", dark: "#818CF8" },
    { name: "plum", light: "#86198F", dark: "#E879F9" },
    { name: "rose", light: "#BE123C", dark: "#FB7185" },
  ],
};

/** Midnight Spectrum — vivid purple→pink→gold spectrum over a dark base. */
const spectrumTheme = {
  color: {
    primary: { light: "#7C3AED", dark: "#A78BFA" }, // vivid purple
    background: { light: "#FAF5FF", dark: "#120A24" }, // light purple tint / purple-black
    surface: { light: "#FFFFFF", dark: "#1E1338" }, // white / elevated purple
    foreground: { light: "#1E1B2E", dark: "#F5F3FF" }, // ink / near-white
    muted: { light: "#6B6785", dark: "#A5A0C0" }, // purple-gray
    border: { light: "#EDE4F5", dark: "#332648" },
    success: { light: "#047857", dark: "#34D399" }, // income green — semantic only
    warning: { light: "#B45309", dark: "#FBBF24" },
    error: { light: "#DC2626", dark: "#F87171" }, // expense red — semantic only
    accent: { light: "#BE185D", dark: "#F472B6" }, // hot pink (deepened for AA on light)
    secondary: { light: "#A16207", dark: "#F59E0B" }, // gold
    overlay: { light: "#000000", dark: "#000000" },
  },
  gradient: {
    dark: { colors: ["#7C3AED", "#DB2777", "#F59E0B"], angle: 135 },
    light: { colors: ["#A78BFA", "#F472B6", "#FBBF24"], angle: 135 },
  },
  glass: {
    dark: { blur: 28, tint: "#A855F7", surfaceOpacity: 0.1, borderOpacity: 0.22 },
    light: { blur: 20, tint: "#A855F7", surfaceOpacity: 0.14, borderOpacity: 0.3 },
  },
  elevation,
  motion,
  category: [
    { name: "violet", light: "#6D28D9", dark: "#A78BFA" },
    { name: "purple", light: "#7C3AED", dark: "#C084FC" },
    { name: "fuchsia", light: "#A21CAF", dark: "#E879F9" },
    { name: "pink", light: "#DB2777", dark: "#F472B6" },
    { name: "rose", light: "#BE123C", dark: "#FB7185" },
    { name: "amber", light: "#B45309", dark: "#FBBF24" },
    { name: "gold", light: "#A16207", dark: "#F59E0B" },
    { name: "cyan", light: "#0E7490", dark: "#22D3EE" },
    { name: "blue", light: "#1D4ED8", dark: "#60A5FA" },
    { name: "emerald", light: "#047857", dark: "#34D399" },
  ],
};

/** @type {const} */
const themes = {
  aurora: auroraTheme,
  obsidian: obsidianTheme,
  spectrum: spectrumTheme,
};

const DEFAULT_THEME_ID = "aurora";

module.exports = {
  themes,
  DEFAULT_THEME_ID,
  themeColors,
  categoryColors,
  spacing,
  radius,
  typography,
  elevation,
  tailwindBoxShadow,
  motion,
};

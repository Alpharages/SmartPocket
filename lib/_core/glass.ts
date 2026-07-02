import { Platform } from "react-native";
import type { GlassToken } from "@/theme.config";
import { ON_DARK_INK, ON_LIGHT_INK, contrastRatio, hexToRgb } from "./contrast";

let globalDisableBlur = false;
const disableBlurListeners = new Set<() => void>();

/** 12.11's low-cost-fallback toggle — force every GlassSurface to the opaque
 * fallback regardless of platform capability. Per-call `disableBlur` props
 * still win locally; this is the app-wide perf switch. Flipping it notifies
 * subscribers so mounted surfaces re-render (see `useGlassCapability`). */
export function setGlobalDisableBlur(disabled: boolean): void {
  if (disabled === globalDisableBlur) return;
  globalDisableBlur = disabled;
  for (const listener of disableBlurListeners) listener();
}

/** Snapshot read for `useSyncExternalStore`. */
export function getGlobalDisableBlur(): boolean {
  return globalDisableBlur;
}

/** Subscribe to global-toggle flips — `useSyncExternalStore` contract. */
export function subscribeGlobalDisableBlur(listener: () => void): () => void {
  disableBlurListeners.add(listener);
  return () => disableBlurListeners.delete(listener);
}

/** Whether a real backdrop blur may be rendered here. Native (iOS/Android)
 * supports `expo-blur` unconditionally; web only when `backdrop-filter` is
 * actually supported by the engine. `disableBlur` (per-instance) and the
 * 12.11 global perf toggle both force the opaque fallback — the fallback is
 * always the safe default branch. */
export function canUseBlur(disableBlur?: boolean): boolean {
  if (disableBlur ?? globalDisableBlur) return false;
  if (Platform.OS === "web") {
    return (
      typeof CSS !== "undefined" &&
      typeof CSS.supports === "function" &&
      (CSS.supports("backdrop-filter", "blur(1px)") ||
        CSS.supports("-webkit-backdrop-filter", "blur(1px)"))
    );
  }
  return true;
}

/** Alpha-composite a hex foreground over a hex background. */
export function compositeOver(
  fgHex: string,
  fgAlpha: number,
  bgHex: string,
): string {
  const fg = hexToRgb(fgHex);
  const bg = hexToRgb(bgHex);
  const mix = (a: number, b: number) =>
    Math.round(a * fgAlpha + b * (1 - fgAlpha));
  return `#${[mix(fg.r, bg.r), mix(fg.g, bg.g), mix(fg.b, bg.b)]
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")}`;
}

/** A hex color as an rgba() string at the given alpha — for border/overlay
 * tints where an opaque hex composite isn't what's wanted (e.g. borders on
 * top of a blur). */
export function toRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** An ink rendered on a glass surface and the WCAG bar it must clear. */
export type InkRequirement = readonly [ink: string, minRatio: number];

/**
 * The inks GlassSurface consumers actually render, with their AA bars:
 * foreground/muted are body text (4.5:1); success/error color amounts at
 * text-lg bold and 16px icons — the 3:1 large-text/UI-component bar.
 * Story 12.10's full a11y pass re-audits these bars per surface.
 */
export function glassInkRequirements(colors: {
  foreground: string;
  muted: string;
  success: string;
  error: string;
}): InkRequirement[] {
  return [
    [colors.foreground, 4.5],
    [colors.muted, 4.5],
    [colors.success, 3],
    [colors.error, 3],
  ];
}

/**
 * Resolves the opaque fallback fill for a glass surface: the theme's glass
 * tint blended over the surface color at the authored `surfaceOpacity`,
 * boosted toward fully opaque tint until every ink requirement clears its
 * bar — the fallback must stay readable even when the authored opacity alone
 * doesn't (AC7). Boosting toward the tint assumes the tint is the
 * high-contrast direction; when it isn't (e.g. a white tint under a
 * near-white foreground) the loop exits still failing, so a post-loop guard
 * returns whichever candidate fill maximises the worst ink margin instead of
 * silently shipping an unreadable surface.
 */
export function resolveOpaqueGlassFill(
  glass: GlassToken,
  surface: string,
  inks: readonly InkRequirement[],
): string {
  const meets = (fill: string) =>
    inks.every(([ink, min]) => contrastRatio(fill, ink) >= min);
  let opacity = glass.surfaceOpacity;
  let fill = compositeOver(glass.tint, opacity, surface);
  while (!meets(fill) && opacity < 1) {
    opacity = Math.min(1, opacity + 0.1);
    fill = compositeOver(glass.tint, opacity, surface);
  }
  if (meets(fill)) return fill;
  const worstMargin = (candidate: string) =>
    Math.min(...inks.map(([ink, min]) => contrastRatio(candidate, ink) / min));
  return [fill, surface, glass.tint].reduce((best, candidate) =>
    worstMargin(candidate) > worstMargin(best) ? candidate : best,
  );
}

/** The AA-safe ink for text over a gradient, plus the minimal scrim (if any)
 * needed to get every stop past 4.5:1. */
export type GradientInk = {
  ink: string;
  /** rgba() overlay to layer over the gradient, or null when the raw stops
   * already clear AA for the chosen ink. */
  scrim: string | null;
};

/**
 * Picks the ink (white or near-black, mirroring `readableTextOn`) with the
 * better worst-stop contrast across the gradient, then — when even that ink
 * can't clear 4.5:1 against every stop — finds the lightest scrim (black
 * under white ink, white under dark ink, in 0.05 steps) that gets the worst
 * stop past the bar (AC7: text over gradients meets AA in every theme ×
 * variant, enforced by math, not eyeballed).
 */
export function resolveGradientInk(stops: readonly string[]): GradientInk {
  const minContrast = (ink: string, backgrounds: readonly string[]) =>
    Math.min(...backgrounds.map((stop) => contrastRatio(ink, stop)));
  const ink =
    minContrast(ON_LIGHT_INK, stops) >= minContrast(ON_DARK_INK, stops)
      ? ON_LIGHT_INK
      : ON_DARK_INK;
  if (minContrast(ink, stops) >= 4.5) return { ink, scrim: null };
  const scrimBase = ink === ON_LIGHT_INK ? "#000000" : "#FFFFFF";
  for (let step = 1; step < 20; step++) {
    const opacity = step / 20;
    const scrimmed = stops.map((stop) =>
      compositeOver(scrimBase, opacity, stop),
    );
    if (minContrast(ink, scrimmed) >= 4.5) {
      return { ink, scrim: toRgba(scrimBase, opacity) };
    }
  }
  // ponytail: full scrim — only reachable if a theme authors stops that match
  // the winning ink itself; the theme-matrix test would catch that regression.
  return { ink, scrim: scrimBase };
}

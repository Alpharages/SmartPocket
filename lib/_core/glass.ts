import { Platform } from "react-native";
import type { GlassToken } from "@/theme.config";
import { contrastRatio, hexToRgb } from "./contrast";

let globalDisableBlur = false;

/** 12.11's low-cost-fallback toggle — force every GlassSurface to the opaque
 * fallback regardless of platform capability. Per-call `disableBlur` props
 * still win locally; this is the app-wide perf switch. */
export function setGlobalDisableBlur(disabled: boolean): void {
  globalDisableBlur = disabled;
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

/**
 * Resolves the opaque fallback fill for a glass surface: the theme's glass
 * tint blended over the surface color at the authored `surfaceOpacity`,
 * boosted toward fully opaque tint if the result would fail AA (>=4.5:1)
 * against the theme's foreground text — the fallback must stay readable
 * even when the authored opacity alone doesn't clear the bar (AC7).
 */
export function resolveOpaqueGlassFill(
  glass: GlassToken,
  surface: string,
  foreground: string,
): string {
  let opacity = glass.surfaceOpacity;
  let fill = compositeOver(glass.tint, opacity, surface);
  while (contrastRatio(fill, foreground) < 4.5 && opacity < 1) {
    opacity = Math.min(1, opacity + 0.1);
    fill = compositeOver(glass.tint, opacity, surface);
  }
  return fill;
}

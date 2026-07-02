import { afterEach, describe, expect, it, vi } from "vitest";
import { Platform } from "react-native";

import { contrastRatio } from "@/lib/_core/contrast";
import {
  canUseBlur,
  compositeOver,
  glassInkRequirements,
  resolveGradientInk,
  resolveOpaqueGlassFill,
  setGlobalDisableBlur,
  subscribeGlobalDisableBlur,
  toRgba,
} from "@/lib/_core/glass";
import { THEME_IDS, getThemeTokens } from "@/lib/_core/theme";

afterEach(() => {
  Platform.OS = "ios";
  setGlobalDisableBlur(false);
  delete (globalThis as { CSS?: unknown }).CSS;
});

describe("canUseBlur", () => {
  it("is true on native (iOS/Android) by default", () => {
    Platform.OS = "ios";
    expect(canUseBlur()).toBe(true);
    Platform.OS = "android";
    expect(canUseBlur()).toBe(true);
  });

  it("is false on web when backdrop-filter support can't be detected", () => {
    Platform.OS = "web";
    expect(canUseBlur()).toBe(false);
  });

  it("is true on web when CSS.supports reports backdrop-filter support", () => {
    Platform.OS = "web";
    (globalThis as { CSS?: unknown }).CSS = {
      supports: (prop: string) => prop === "backdrop-filter",
    };
    expect(canUseBlur()).toBe(true);
  });

  it("is false when the per-instance disableBlur prop is set", () => {
    expect(canUseBlur(true)).toBe(false);
  });

  it("is false when the global 12.11 perf toggle is disabled", () => {
    setGlobalDisableBlur(true);
    expect(canUseBlur()).toBe(false);
  });

  it("lets the per-instance prop override the global toggle back on", () => {
    setGlobalDisableBlur(true);
    expect(canUseBlur(false)).toBe(true);
  });
});

describe("compositeOver / toRgba", () => {
  it("composites a fully-opaque foreground as itself", () => {
    expect(compositeOver("#FF0000", 1, "#00FF00")).toBe("#ff0000");
  });

  it("composites a fully-transparent foreground as the background", () => {
    expect(compositeOver("#FF0000", 0, "#00FF00")).toBe("#00ff00");
  });

  it("blends midway between foreground and background", () => {
    expect(compositeOver("#FFFFFF", 0.5, "#000000")).toBe("#808080");
  });

  it("renders a hex color as an rgba() string at the given alpha", () => {
    expect(toRgba("#FF0000", 0.5)).toBe("rgba(255, 0, 0, 0.5)");
  });
});

describe("resolveOpaqueGlassFill", () => {
  it("boosts opacity toward the tint until foreground contrast clears AA", () => {
    // Near-black tint at a very low authored opacity over a white surface —
    // the naive composite stays too light to clear AA against a near-white
    // foreground, forcing the boost loop to darken it toward the tint.
    const glass = {
      blur: 20,
      tint: "#111827",
      surfaceOpacity: 0.05,
      borderOpacity: 0.2,
    };
    const surface = "#FFFFFF";
    const foreground = "#F1F5F9";
    const naive = compositeOver(glass.tint, glass.surfaceOpacity, surface);
    expect(contrastRatio(naive, foreground)).toBeLessThan(4.5);

    const fill = resolveOpaqueGlassFill(glass, surface, [[foreground, 4.5]]);
    expect(contrastRatio(fill, foreground)).toBeGreaterThanOrEqual(4.5);
  });

  it("returns the authored composite unchanged when it already meets AA", () => {
    const glass = {
      blur: 24,
      tint: "#000000",
      surfaceOpacity: 0.9,
      borderOpacity: 0.2,
    };
    const fill = resolveOpaqueGlassFill(glass, "#FFFFFF", [["#F1F5F9", 4.5]]);
    expect(fill).toBe(
      compositeOver(glass.tint, glass.surfaceOpacity, "#FFFFFF"),
    );
  });

  it("falls back to a readable candidate when boosting toward the tint walks the wrong way", () => {
    // White tint under a near-white foreground: every boost step moves the
    // fill TOWARD the foreground, so the loop exits at opacity=1 still
    // failing — the post-loop guard must pick the dark surface instead of
    // silently returning an unreadable near-white fill.
    const glass = {
      blur: 20,
      tint: "#FFFFFF",
      surfaceOpacity: 0.9,
      borderOpacity: 0.2,
    };
    const surface = "#0B1020";
    const foreground = "#F1F5F9";
    const fill = resolveOpaqueGlassFill(glass, surface, [[foreground, 4.5]]);
    expect(contrastRatio(fill, foreground)).toBeGreaterThanOrEqual(4.5);
    expect(fill).toBe(surface);
  });

  it("meets every consumer ink's bar for all themes × schemes", () => {
    for (const themeId of THEME_IDS) {
      for (const scheme of ["light", "dark"] as const) {
        const tokens = getThemeTokens(themeId, scheme);
        const requirements = glassInkRequirements(tokens.colors);
        const fill = resolveOpaqueGlassFill(
          tokens.glass,
          tokens.colors.surface,
          requirements,
        );
        for (const [ink, min] of requirements) {
          expect(
            contrastRatio(fill, ink),
            `${themeId}/${scheme} ink ${ink}`,
          ).toBeGreaterThanOrEqual(min);
        }
      }
    }
  });
});

describe("resolveGradientInk", () => {
  /** Effective backdrop stops after the resolved scrim (if any) is applied. */
  function effectiveStops(
    stops: readonly string[],
    scrim: string | null,
  ): string[] {
    if (!scrim) return [...stops];
    const match = scrim.match(/^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/);
    if (!match) return [scrim]; // fully-opaque hex scrim covers the stops
    const [, r, g, b, alpha] = match;
    const hex = `#${[r, g, b]
      .map((c) => Number(c).toString(16).padStart(2, "0"))
      .join("")}`;
    return stops.map((stop) => compositeOver(hex, Number(alpha), stop));
  }

  it.each(THEME_IDS)(
    "ink clears >=4.5:1 against every (scrimmed) stop for %s in light and dark",
    (themeId) => {
      for (const scheme of ["light", "dark"] as const) {
        const { colors } = getThemeTokens(themeId, scheme).gradient;
        const { ink, scrim } = resolveGradientInk(colors);
        for (const stop of effectiveStops(colors, scrim)) {
          expect(
            contrastRatio(ink, stop),
            `${themeId}/${scheme} stop ${stop}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    },
  );

  it("skips the scrim when the raw stops already clear AA", () => {
    // Obsidian light is ivory — near-black ink passes every stop raw.
    const { scrim } = resolveGradientInk(
      getThemeTokens("obsidian", "light").gradient.colors,
    );
    expect(scrim).toBeNull();
  });

  it("adds a minimal scrim when neither ink clears every stop raw", () => {
    // Spectrum dark's gold stop fails both inks raw — a scrim must kick in.
    const { scrim } = resolveGradientInk(
      getThemeTokens("spectrum", "dark").gradient.colors,
    );
    expect(scrim).toMatch(/^rgba\(/);
  });
});

describe("setGlobalDisableBlur subscriptions", () => {
  it("notifies subscribers on flips and stops after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeGlobalDisableBlur(listener);
    setGlobalDisableBlur(true);
    expect(listener).toHaveBeenCalledTimes(1);
    setGlobalDisableBlur(true); // no-op: unchanged value must not notify
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    setGlobalDisableBlur(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

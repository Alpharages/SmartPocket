import { afterEach, describe, expect, it } from "vitest";
import { Platform } from "react-native";

import { contrastRatio } from "@/lib/_core/contrast";
import {
  canUseBlur,
  compositeOver,
  resolveOpaqueGlassFill,
  setGlobalDisableBlur,
  toRgba,
} from "@/lib/_core/glass";

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

    const fill = resolveOpaqueGlassFill(glass, surface, foreground);
    expect(contrastRatio(fill, foreground)).toBeGreaterThanOrEqual(4.5);
  });

  it("returns the authored composite unchanged when it already meets AA", () => {
    const glass = {
      blur: 24,
      tint: "#000000",
      surfaceOpacity: 0.9,
      borderOpacity: 0.2,
    };
    const fill = resolveOpaqueGlassFill(glass, "#FFFFFF", "#F1F5F9");
    expect(fill).toBe(
      compositeOver(glass.tint, glass.surfaceOpacity, "#FFFFFF"),
    );
  });
});

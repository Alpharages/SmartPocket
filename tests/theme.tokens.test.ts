import { describe, it, expect } from "vitest";

/**
 * Theme Token Tests
 *
 * Verifies the extended design token set from Story 1.1:
 * - spacing, radius, typography, elevation tokens in theme.config.js
 * - tailwind.config.js wiring
 * - runtime exports in lib/_core/theme.ts
 */

describe("Theme Tokens", () => {
  describe("theme.config.js exports", () => {
    it("should export spacing tokens with exact values", async () => {
      const themeConfig = await import("@/theme.config");
      expect(themeConfig.spacing).toBeDefined();
      expect(themeConfig.spacing).toEqual({
        xs: 4,
        sm: 8,
        md: 12,
        lg: 16,
        xl: 20,
        "2xl": 24,
      });
    });

    it("should export radius tokens with exact values", async () => {
      const themeConfig = await import("@/theme.config");
      expect(themeConfig.radius).toBeDefined();
      expect(themeConfig.radius).toEqual({
        sm: 8,
        md: 12,
        lg: 16,
        full: 9999,
      });
    });

    it("should export typography tokens with fontSize, lineHeight, and fontWeight", async () => {
      const themeConfig = await import("@/theme.config");
      expect(themeConfig.typography).toBeDefined();
      expect(themeConfig.typography.display).toBeDefined();
      expect(themeConfig.typography.display).toEqual({
        fontSize: 36,
        lineHeight: 40,
        fontWeight: "700",
      });
      expect(themeConfig.typography.number).toBeDefined();
      expect(themeConfig.typography.number).toEqual({
        fontSize: 16,
        lineHeight: 24,
        fontWeight: "600",
        fontVariant: ["tabular-nums"],
      });
    });

    it("should export elevation tokens with all levels", async () => {
      const themeConfig = await import("@/theme.config");
      expect(themeConfig.elevation).toBeDefined();
      expect(Object.keys(themeConfig.elevation)).toEqual([
        "none",
        "sm",
        "md",
        "lg",
      ]);
    });

    it("should derive the elevation shadow color from the foreground token (theme-aware), not hardcoded black", async () => {
      const themeConfig = await import("@/theme.config");
      const { none, sm, md, lg } = themeConfig.elevation;
      // sm/md/lg pull their color from the foreground CSS var so they adapt to light/dark
      for (const shadow of [sm, md, lg]) {
        expect(shadow).toContain("var(--color-foreground)");
        // no fixed/opaque black literal
        expect(shadow).not.toMatch(/rgb\(0 0 0/);
      }
      // `none` carries no visible color
      expect(none).toBe("0 0 0 0 transparent");
    });
  });

  describe("motion tokens (Story 12.9)", () => {
    it("should expose the full motion surface: press, sheet, screen, countUp, celebration", async () => {
      const themeConfig = await import("@/theme.config");
      expect(themeConfig.motion.press).toEqual({
        scale: 0.97,
        durationMs: 120,
      });
      expect(themeConfig.motion.sheet).toEqual({
        durationMs: 250,
        easing: "easeOutCubic",
        backdropOpacity: 0.65,
        dragDismissThreshold: 0.35,
      });
      expect(themeConfig.motion.screen).toEqual({
        durationMs: 280,
        easing: "easeOutCubic",
      });
      expect(themeConfig.motion.countUp).toEqual({
        durationMs: 700,
        easing: "easeOut",
      });
      expect(themeConfig.motion.celebration).toEqual({
        durationMs: 220,
        scaleFrom: 0.85,
        easing: "easeOutBack",
      });
    });

    it("should keep motion.sheet unchanged so Sheet.tsx's existing behavior is untouched", async () => {
      const themeConfig = await import("@/theme.config");
      expect(themeConfig.motion.sheet.durationMs).toBe(250);
    });

    it("should surface the same motion object on lib/_core/theme.ts's Motion export", async () => {
      const themeConfig = await import("@/theme.config");
      const theme = await import("@/lib/_core/theme");
      expect(theme.Motion).toBe(themeConfig.motion);
    });
  });

  describe("lib/_core/theme.ts runtime exports", () => {
    it("should export Spacing runtime tokens", async () => {
      const theme = await import("@/lib/_core/theme");
      expect(theme.Spacing).toBeDefined();
      expect(theme.Spacing.xs).toBe(4);
      expect(theme.Spacing["2xl"]).toBe(24);
    });

    it("should export Radius runtime tokens", async () => {
      const theme = await import("@/lib/_core/theme");
      expect(theme.Radius).toBeDefined();
      expect(theme.Radius.sm).toBe(8);
      expect(theme.Radius.full).toBe(9999);
    });

    it("should export Typography runtime tokens", async () => {
      const theme = await import("@/lib/_core/theme");
      expect(theme.Typography).toBeDefined();
      expect(theme.Typography.display).toBeDefined();
      expect(theme.Typography.number).toBeDefined();
      expect(theme.Typography.number.fontVariant).toEqual(["tabular-nums"]);
    });

    it("should export Elevation runtime tokens", async () => {
      const theme = await import("@/lib/_core/theme");
      expect(theme.Elevation).toBeDefined();
      expect(theme.Elevation.none).toBeDefined();
      expect(theme.Elevation.sm).toBeDefined();
    });
  });

  describe("tailwind.config.js theme extensions", () => {
    it("should extend spacing from theme config", async () => {
      const tailwindConfig: any = await import("@/tailwind.config");
      const spacing = tailwindConfig.theme?.extend?.spacing;
      expect(spacing).toBeDefined();
      expect(spacing.md).toBe("12px");
      expect(spacing.xl).toBe("20px");
    });

    it("should extend borderRadius from theme config", async () => {
      const tailwindConfig: any = await import("@/tailwind.config");
      const radius = tailwindConfig.theme?.extend?.borderRadius;
      expect(radius).toBeDefined();
      expect(radius.md).toBe("12px");
      expect(radius.full).toBe("9999px");
    });

    it("should extend fontSize from theme config", async () => {
      const tailwindConfig: any = await import("@/tailwind.config");
      const fontSize = tailwindConfig.theme?.extend?.fontSize;
      expect(fontSize).toBeDefined();
      expect(fontSize.display).toBeDefined();
      // Tailwind fontSize format: [size, lineHeight] or [size, { lineHeight, fontWeight }]
      expect(Array.isArray(fontSize.display)).toBe(true);
    });

    it("should NOT carry fontVariant in the fontSize tuple (Tailwind drops it; use the tabular-nums utility)", async () => {
      const tailwindConfig: any = await import("@/tailwind.config");
      const fontSize = tailwindConfig.theme?.extend?.fontSize;
      const numberOptions = fontSize.number?.[1];
      expect(numberOptions).toBeDefined();
      // fontVariant is intentionally omitted — Tailwind's fontSize plugin would drop it
      expect(numberOptions.fontVariant).toBeUndefined();
      expect(numberOptions.lineHeight).toBe("24px");
      expect(numberOptions.fontWeight).toBe("600");
    });

    it("should extend boxShadow from theme config", async () => {
      const tailwindConfig: any = await import("@/tailwind.config");
      const boxShadow = tailwindConfig.theme?.extend?.boxShadow;
      expect(boxShadow).toBeDefined();
      expect(boxShadow.sm).toBeDefined();
      expect(boxShadow.md).toBeDefined();
      expect(boxShadow.lg).toBeDefined();
    });

    it("should use NativeWind-compatible boxShadow values (no color-mix)", async () => {
      const themeConfig = await import("@/theme.config");
      for (const shadow of Object.values(themeConfig.tailwindBoxShadow)) {
        expect(shadow).not.toContain("color-mix(");
      }
    });
  });
});

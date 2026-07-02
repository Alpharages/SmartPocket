import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";
import { Text } from "react-native";

import { GlassSurface } from "@/components/ui/GlassSurface";
import { ThemeContext } from "@/lib/theme-provider";
import { THEME_IDS, getThemeTokens, type ThemeId } from "@/lib/_core/theme";
import { contrastRatio } from "@/lib/_core/contrast";
import { resolveOpaqueGlassFill } from "@/lib/_core/glass";

let renderer: ReactTestRenderer | null = null;

function render(ui: React.ReactElement): ReactTestInstance {
  act(() => {
    renderer = TestRenderer.create(ui);
  });
  return renderer!.root;
}

function renderWithTheme(
  ui: React.ReactElement,
  themeId: ThemeId,
  colorScheme: "light" | "dark",
): ReactTestInstance {
  const theme = getThemeTokens(themeId, colorScheme);
  return render(
    <ThemeContext.Provider
      value={{
        colorScheme,
        themePreference: colorScheme,
        setThemePreference: async () => {},
        setColorScheme: () => {},
        themeId,
        setThemeId: async () => {},
        theme,
        isReady: true,
      }}
    >
      {ui}
    </ThemeContext.Provider>,
  );
}

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = null;
});

describe("GlassSurface", () => {
  it("renders a real blur backdrop when blur is supported (default)", () => {
    const root = render(
      <GlassSurface testID="surface">
        <Text>Content</Text>
      </GlassSurface>,
    );
    expect(
      root.find((n) => n.props.testID === "glass-surface-blur"),
    ).toBeTruthy();
    expect(
      root.findAll(
        (n) =>
          typeof n.type === "string" &&
          n.props.testID === "glass-surface-fallback",
      ),
    ).toHaveLength(0);
  });

  it("renders the opaque fallback when disableBlur is set", () => {
    const root = render(
      <GlassSurface testID="surface" disableBlur>
        <Text>Content</Text>
      </GlassSurface>,
    );
    expect(
      root.findAll(
        (n) =>
          typeof n.type === "string" && n.props.testID === "glass-surface-blur",
      ),
    ).toHaveLength(0);
    expect(
      root.find((n) => n.props.testID === "glass-surface-fallback"),
    ).toBeTruthy();
  });

  it("passes children through untouched", () => {
    const root = render(
      <GlassSurface disableBlur>
        <Text>Hello glass</Text>
      </GlassSurface>,
    );
    expect(
      root.findAll((n) => String(n.type) === "Text").length,
    ).toBeGreaterThan(0);
  });

  it("passes accessibility props through to the outer surface", () => {
    const root = render(
      <GlassSurface
        disableBlur
        testID="glass-card"
        accessibilityLabel="Balance card"
        accessible
      >
        <Text>Content</Text>
      </GlassSurface>,
    );
    const outer = root.find((n) => n.props.testID === "glass-card");
    expect(outer.props.accessibilityLabel).toBe("Balance card");
    expect(outer.props.accessible).toBe(true);
  });

  it("renders without a ThemeProvider ancestor (defaults to aurora/light)", () => {
    expect(() =>
      render(
        <GlassSurface disableBlur>
          <Text>No provider</Text>
        </GlassSurface>,
      ),
    ).not.toThrow();
  });

  describe("AA on the opaque fallback (AC7)", () => {
    it.each(THEME_IDS)(
      "meets >=4.5:1 contrast against foreground for %s in light and dark",
      (themeId) => {
        for (const scheme of ["light", "dark"] as const) {
          const tokens = getThemeTokens(themeId, scheme);
          const fill = resolveOpaqueGlassFill(
            tokens.glass,
            tokens.colors.surface,
            tokens.colors.foreground,
          );
          expect(
            contrastRatio(fill, tokens.colors.foreground),
          ).toBeGreaterThanOrEqual(4.5);
        }
      },
    );

    it("renders the AA-safe fill as the fallback surface's background", () => {
      const root = renderWithTheme(
        <GlassSurface testID="surface" disableBlur>
          <Text>Content</Text>
        </GlassSurface>,
        "obsidian",
        "dark",
      );
      const tokens = getThemeTokens("obsidian", "dark");
      const expectedFill = resolveOpaqueGlassFill(
        tokens.glass,
        tokens.colors.surface,
        tokens.colors.foreground,
      );
      const fallback = root.find(
        (n) => n.props.testID === "glass-surface-fallback",
      );
      const flat = Array.isArray(fallback.props.style)
        ? Object.assign({}, ...fallback.props.style.filter(Boolean))
        : fallback.props.style;
      expect(flat.backgroundColor).toBe(expectedFill);
    });
  });
});

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
import {
  glassInkRequirements,
  resolveOpaqueGlassFill,
  setGlobalDisableBlur,
} from "@/lib/_core/glass";

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
  setGlobalDisableBlur(false);
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

  it("switches mounted surfaces to the fallback when the global toggle flips", () => {
    const root = render(
      <GlassSurface testID="surface">
        <Text>Content</Text>
      </GlassSurface>,
    );
    expect(
      root.find((n) => n.props.testID === "glass-surface-blur"),
    ).toBeTruthy();

    act(() => {
      setGlobalDisableBlur(true);
    });

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

  it("rounds the border overlay with the borderRadius passed via style", () => {
    const root = render(
      <GlassSurface testID="surface" disableBlur style={{ borderRadius: 16 }}>
        <Text>Content</Text>
      </GlassSurface>,
    );
    const bordered = root.findAll((n) => {
      if (typeof n.type !== "string") return false;
      const flat = Array.isArray(n.props.style)
        ? Object.assign({}, ...n.props.style.filter(Boolean))
        : (n.props.style ?? {});
      return flat.borderWidth === 1;
    });
    expect(bordered).toHaveLength(1);
    const flat = Object.assign(
      {},
      ...(bordered[0].props.style as object[]).filter(Boolean),
    );
    expect(flat.borderRadius).toBe(16);
  });

  describe("AA on the opaque fallback (AC7)", () => {
    it.each(THEME_IDS)(
      "meets every consumer ink's bar for %s in light and dark",
      (themeId) => {
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
        glassInkRequirements(tokens.colors),
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

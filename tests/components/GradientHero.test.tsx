import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";
import { Text } from "react-native";

import { GradientHero } from "@/components/ui/GradientHero";
import { ThemeContext } from "@/lib/theme-provider";
import { getThemeTokens, type ThemeId } from "@/lib/_core/theme";
import { resolveGradientInk } from "@/lib/_core/glass";

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

describe("GradientHero", () => {
  it("renders LinearGradient with the default (aurora/light) theme's gradient stops", () => {
    const root = render(
      <GradientHero testID="hero">
        <Text>Balance</Text>
      </GradientHero>,
    );
    const gradient = root.find(
      (n) => n.props.testID === "gradient-hero-gradient",
    );
    const expected = getThemeTokens("aurora", "light").gradient;
    expect(gradient.props.colors).toEqual(expected.colors);
  });

  it("renders the active theme's gradient stops from context", () => {
    const root = renderWithTheme(
      <GradientHero testID="hero">
        <Text>Balance</Text>
      </GradientHero>,
      "spectrum",
      "dark",
    );
    const gradient = root.find(
      (n) => n.props.testID === "gradient-hero-gradient",
    );
    const expected = getThemeTokens("spectrum", "dark").gradient;
    expect(gradient.props.colors).toEqual(expected.colors);
  });

  it("falls back to a solid first-stop color when disableGradient is set", () => {
    const root = renderWithTheme(
      <GradientHero testID="hero" disableGradient>
        <Text>Balance</Text>
      </GradientHero>,
      "obsidian",
      "light",
    );
    expect(
      root.findAll((n) => n.props.testID === "gradient-hero-gradient"),
    ).toHaveLength(0);
    const fallback = root.find(
      (n) => n.props.testID === "gradient-hero-fallback",
    );
    const flat = Array.isArray(fallback.props.style)
      ? Object.assign({}, ...fallback.props.style.filter(Boolean))
      : fallback.props.style;
    const expected = getThemeTokens("obsidian", "light").gradient;
    expect(flat.backgroundColor).toBe(expected.colors[0]);
  });

  it("passes children through untouched", () => {
    const root = render(
      <GradientHero>
        <Text>Hero content</Text>
      </GradientHero>,
    );
    expect(
      root.findAll((n) => String(n.type) === "Text").length,
    ).toBeGreaterThan(0);
  });

  it("renders without a ThemeProvider ancestor (defaults to aurora/light)", () => {
    expect(() =>
      render(
        <GradientHero>
          <Text>No provider</Text>
        </GradientHero>,
      ),
    ).not.toThrow();
  });

  describe("AA contrast scrim (AC7)", () => {
    it("layers the resolved scrim over the gradient when the stops need it", () => {
      // Spectrum dark's gold stop fails both inks raw — resolveGradientInk
      // returns a scrim and GradientHero must render it.
      const root = renderWithTheme(
        <GradientHero testID="hero">
          <Text>Balance</Text>
        </GradientHero>,
        "spectrum",
        "dark",
      );
      const { scrim } = resolveGradientInk(
        getThemeTokens("spectrum", "dark").gradient.colors,
      );
      expect(scrim).not.toBeNull();
      const overlay = root.find(
        (n) => n.props.testID === "gradient-hero-scrim",
      );
      const flat = Array.isArray(overlay.props.style)
        ? Object.assign({}, ...overlay.props.style.filter(Boolean))
        : overlay.props.style;
      expect(flat.backgroundColor).toBe(scrim);
    });

    it("renders no scrim when the raw stops already clear AA", () => {
      // Obsidian dark's navy stops give white ink 15:1+ — no scrim needed.
      const root = renderWithTheme(
        <GradientHero testID="hero">
          <Text>Balance</Text>
        </GradientHero>,
        "obsidian",
        "dark",
      );
      expect(
        root.findAll((n) => n.props.testID === "gradient-hero-scrim"),
      ).toHaveLength(0);
    });

    it("applies the scrim to the solid fallback branch too", () => {
      const root = renderWithTheme(
        <GradientHero testID="hero" disableGradient>
          <Text>Balance</Text>
        </GradientHero>,
        "spectrum",
        "dark",
      );
      expect(
        root.find((n) => n.props.testID === "gradient-hero-fallback"),
      ).toBeTruthy();
      expect(
        root.find((n) => n.props.testID === "gradient-hero-scrim"),
      ).toBeTruthy();
    });
  });
});

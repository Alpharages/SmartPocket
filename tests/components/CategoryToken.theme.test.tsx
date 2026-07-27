import React from "react";
import { describe, expect, it, vi } from "vitest";
import TestRenderer, { act } from "react-test-renderer";

import { CategoryToken } from "@/components/ui/CategoryToken";
import { ThemeContext } from "@/lib/theme-provider";
import { getThemeTokens } from "@/lib/_core/theme";

const mockColors = {
  primary: "#4F46E5",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  foreground: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  success: "#059669",
  warning: "#D97706",
  error: "#DC2626",
  accent: "#DB2777",
  secondary: "#7C3AED",
  text: "#111827",
  tint: "#4F46E5",
  icon: "#6B7280",
  tabIconDefault: "#6B7280",
  tabIconSelected: "#4F46E5",
};

vi.mock("@/hooks/use-colors", () => ({
  useColors: () => mockColors,
}));

// This test exercises DARK scheme specifically — resolveCategoryColor only
// diverges by themeId when mapping a light-mode stored hex to its dark
// variant, so "light" (the other files' shared mock) can't prove threading.
vi.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "dark",
}));

vi.mock("@expo/vector-icons", () => {
  const Ionicons = ({ name, color }: { name: string; color?: string }) =>
    React.createElement("Ionicons", { name, color });
  (Ionicons as any).glyphMap = { "pricetag-outline": 1 };
  return { Ionicons };
});

function renderUnderTheme(
  element: React.ReactElement,
  themeId: "aurora" | "obsidian",
) {
  const theme = getThemeTokens(themeId, "dark");
  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <ThemeContext.Provider
        value={{
          colorScheme: "dark",
          themePreference: "dark",
          setThemePreference: async () => {},
          setColorScheme: () => {},
          themeId,
          setThemeId: async () => {},
          theme,
          isReady: true,
        }}
      >
        {element}
      </ThemeContext.Provider>,
    );
  });
  return renderer!.root;
}

/**
 * Story 12.10 — Lore lesson `6248c582…`: resolveCategoryColor()/
 * getCategoryColorByIndex() silently default to Aurora's category map when a
 * call site omits the themeId argument, so a screen fully migrated to
 * useThemeTokens() can still render the wrong theme's category swatch. This
 * locks in the fix: CategoryToken must resolve the stored color against the
 * ACTIVE theme's category map, not always Aurora's.
 */
describe("CategoryToken — theme-aware category color resolution", () => {
  it("resolves a stored Aurora-indigo hex to Aurora's own dark variant under the aurora theme", () => {
    const root = renderUnderTheme(
      <CategoryToken name="Food" color="#4F46E5" icon="pricetag-outline" />,
      "aurora",
    );
    const icon = root.findByProps({ name: "pricetag-outline" });
    // Aurora's indigo dark variant is #818CF8.
    expect(String(icon.props.color).toUpperCase()).toBe("#818CF8");
  });

  it("does not resolve that same stored hex to Aurora's dark variant under the obsidian theme", () => {
    const root = renderUnderTheme(
      <CategoryToken name="Food" color="#4F46E5" icon="pricetag-outline" />,
      "obsidian",
    );
    const icon = root.findByProps({ name: "pricetag-outline" });
    // "#4F46E5" isn't a key in Obsidian's light->dark map, so it must NOT
    // silently resolve to Aurora's dark variant (#818CF8) — the bug this
    // test guards against.
    expect(String(icon.props.color).toUpperCase()).not.toBe("#818CF8");
  });
});

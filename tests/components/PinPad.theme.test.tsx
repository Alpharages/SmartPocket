import React from "react";
import { describe, expect, it, vi } from "vitest";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet } from "react-native";

import { PinPad } from "@/components/ui/PinPad";
import { ThemeContext } from "@/lib/theme-provider";
import { getThemeTokens, type ThemeId } from "@/lib/_core/theme";

vi.mock("@expo/vector-icons", () => {
  const Ionicons = ({ name }: { name: string }) =>
    React.createElement("Ionicons", { name });
  (Ionicons as any).glyphMap = { "finger-print": 1 };
  return { Ionicons };
});

function renderUnderTheme(element: React.ReactElement, themeId: ThemeId) {
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
  return { root: renderer!.root, theme };
}

function keys(root: TestRenderer.ReactTestInstance) {
  return root.findAll(
    (n) => typeof n.type === "string" && n.props.accessibilityRole === "button",
  );
}

function dots(root: TestRenderer.ReactTestInstance) {
  return root.findAll(
    (n) => typeof n.type === "string" && n.props.testID === "pin-pad-dot",
  );
}

/**
 * B1 (code review, Story 13.1) — PinPad previously read `useColors()`, which
 * is frozen to the default (Aurora) theme regardless of the active
 * `themeId`. This locks in the fix (`useThemeTokens()`): both the keys and
 * the dots must resolve against whichever theme is active, not always
 * Aurora's palette.
 */
describe("PinPad — theme-aware token resolution (AC6)", () => {
  it("keys resolve Aurora's own border/surface under the aurora theme", () => {
    const { root, theme } = renderUnderTheme(
      <PinPad onSubmit={() => {}} />,
      "aurora",
    );
    const key = keys(root)[0];
    const style = StyleSheet.flatten(key.props.style);
    expect(style.borderColor).toBe(theme.colors.border);
    expect(style.backgroundColor).toBe(theme.colors.surface);
  });

  it("keys resolve Obsidian's own border/surface under the obsidian theme, not Aurora's", () => {
    const aurora = renderUnderTheme(<PinPad onSubmit={() => {}} />, "aurora");
    const obsidian = renderUnderTheme(
      <PinPad onSubmit={() => {}} />,
      "obsidian",
    );

    const obsidianKeyStyle = StyleSheet.flatten(
      keys(obsidian.root)[0].props.style,
    );
    expect(obsidianKeyStyle.borderColor).toBe(obsidian.theme.colors.border);
    expect(obsidianKeyStyle.borderColor).not.toBe(aurora.theme.colors.border);
  });

  it("unfilled dots resolve the active theme's muted token, not a frozen default", () => {
    const obsidian = renderUnderTheme(
      <PinPad onSubmit={() => {}} />,
      "obsidian",
    );
    const dot = dots(obsidian.root)[0];
    const style = StyleSheet.flatten(dot.props.style);
    expect(style.borderColor).toBe(obsidian.theme.colors.muted);
  });

  it("renders without throwing when there is no ThemeProvider ancestor", () => {
    expect(() => {
      act(() => {
        TestRenderer.create(<PinPad onSubmit={() => {}} />);
      });
    }).not.toThrow();
  });
});

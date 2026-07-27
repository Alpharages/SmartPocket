import React from "react";
import { describe, expect, it, vi } from "vitest";
import TestRenderer, { act } from "react-test-renderer";

vi.mock("expo-router", () => {
  const Tabs = ({ children }: { children?: React.ReactNode }) =>
    React.createElement("Tabs", {}, children);
  (Tabs as any).Screen = (props: Record<string, unknown>) =>
    React.createElement("TabsScreen", props);
  return { Tabs };
});

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({
    primary: "#4F46E5",
    muted: "#6B7280",
    surface: "#FFFFFF",
    border: "#E5E7EB",
    foreground: "#111827",
  }),
}));

vi.mock("@/components/haptic-tab", () => ({
  HapticTab: () => null,
}));

vi.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

/**
 * Story 12.10 — AC3 screen-reader labels. React Navigation's bottom-tab
 * button only gets an `accessibilityLabel` when `tabBarAccessibilityLabel`
 * is explicitly set on the screen's options; otherwise tabs announce as
 * unlabeled icon+title with no accessible name (a "known current gap" per
 * this story's Dev Notes).
 */
describe("TabLayout — tab bar accessibility labels", () => {
  it("gives every tab an explicit tabBarAccessibilityLabel", async () => {
    const { default: TabLayout } = await import("@/app/(tabs)/_layout");

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<TabLayout />);
    });

    const screens = renderer!.root.findAllByType(
      "TabsScreen" as unknown as React.ElementType,
    );
    const labelsByName = Object.fromEntries(
      screens.map((s) => [
        s.props.name,
        s.props.options?.tabBarAccessibilityLabel,
      ]),
    );

    expect(labelsByName).toEqual({
      dashboard: "Home tab",
      transactions: "Activity tab",
      categories: "Categories tab",
      summary: "Insights tab",
      cards: "Cards tab",
      loans: "Loans tab",
    });
  });
});

import React from "react";
import { describe, expect, it, vi } from "vitest";
import TestRenderer, { act } from "react-test-renderer";

vi.mock("expo-router", () => {
  const Tabs = ({ children }: { children?: React.ReactNode }) =>
    React.createElement("Tabs", {}, children);
  // eslint-disable-next-line react/display-name -- test double, never rendered by name
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
  it("gives every rendered tab an explicit tabBarAccessibilityLabel, and no label on the non-tab categories route", async () => {
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
      categories: undefined,
      summary: "Insights tab",
      cards: "Cards tab",
      loans: "Loans tab",
    });
  });
});

// 86eyepunf AC-4 — drift guard. Two independent mechanisms decide tab
// visibility (TAB_ROUTES filters what GlassTabBar renders; `href: null` is
// declarative-only under a custom tabBar, see GlassTabBar.tsx comment) and
// nothing previously cross-checked them, which is how the navigator config,
// the a11y label and the PRD all fell out of sync with the SP-042 IA
// rebalance while every existing test stayed green. This guard fails closed
// if either mechanism drifts from the other again.
describe("TabLayout — TAB_ROUTES / href:null drift guard", () => {
  it("keeps the set of non-href:null screens equal to TAB_ROUTES", async () => {
    const { default: TabLayout } = await import("@/app/(tabs)/_layout");
    const { TAB_ROUTES } = await import("@/components/navigation/GlassTabBar");

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<TabLayout />);
    });

    const screens = renderer!.root.findAllByType(
      "TabsScreen" as unknown as React.ElementType,
    );
    const declaredTabNames = new Set(
      screens
        .filter((s) => s.props.options?.href !== null)
        .map((s) => s.props.name),
    );

    expect(declaredTabNames).toEqual(new Set(TAB_ROUTES));
  });
});

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";
import { StyleSheet, Text } from "react-native";

import { GlassTabBar } from "@/components/navigation/GlassTabBar";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("expo-router", () => ({
  router: { push },
}));

vi.mock("@expo/vector-icons", () => ({
  Ionicons: ({
    name,
    color,
    size,
  }: {
    name: string;
    color?: string;
    size?: number;
  }) => React.createElement("Ionicons", { name, color, size }),
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 20, left: 0, right: 0, top: 0 }),
}));

let renderer: ReactTestRenderer | null = null;

function render(ui: React.ReactElement): ReactTestInstance {
  act(() => {
    renderer = TestRenderer.create(ui);
  });
  return renderer!.root;
}

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = null;
  push.mockClear();
});

const routes = [
  "dashboard",
  "transactions",
  "categories",
  "summary",
  "cards",
  "loans",
  "index",
].map((name) => ({ key: `${name}-key`, name }));

function props(activeIndex = 0) {
  const descriptors = Object.fromEntries(
    routes.map((route) => [
      route.key,
      {
        options: {
          title:
            {
              dashboard: "Home",
              transactions: "Activity",
              categories: "Categories",
              summary: "Insights",
              cards: "Cards",
              loans: "Loans",
              index: "Index",
            }[route.name] ?? route.name,
          tabBarIcon: ({ color }: { color: string }) => (
            <Text style={{ color }}>{route.name}</Text>
          ),
        },
      },
    ]),
  );

  return {
    state: { index: activeIndex, routes },
    descriptors,
    navigation: {
      emit: vi.fn(() => ({ defaultPrevented: false })),
      navigate: vi.fn(),
    },
    insets: { bottom: 0, left: 0, right: 0, top: 0 },
  } as any;
}

function flat(style: unknown) {
  return StyleSheet.flatten(style) as Record<string, unknown>;
}

describe("GlassTabBar", () => {
  it("renders exactly the five product tabs in order", () => {
    const root = render(<GlassTabBar {...props()} />);

    expect(
      root
        .findAll(
          (n) =>
            typeof n.type === "string" && n.props.accessibilityRole === "tab",
        )
        .map((n) => n.props.accessibilityLabel),
    ).toEqual(["Home", "Activity", "Categories", "Insights", "Cards"]);
  });

  it("keeps tab routing behavior and selected state", () => {
    const p = props(0);
    const root = render(<GlassTabBar {...p} />);
    const home = root.find(
      (n) =>
        typeof n.type === "string" && n.props.accessibilityLabel === "Home",
    );
    const activity = root.find(
      (n) =>
        typeof n.type === "string" && n.props.accessibilityLabel === "Activity",
    );

    expect(home.props.accessibilityState).toEqual({ selected: true });

    act(() => {
      activity.props.onPress();
    });

    expect(p.navigation.emit).toHaveBeenCalledWith({
      type: "tabPress",
      target: "transactions-key",
      canPreventDefault: true,
    });
    expect(p.navigation.navigate).toHaveBeenCalledWith("transactions");
  });

  it("routes the floating add button without making it a tab", () => {
    const root = render(<GlassTabBar {...props()} />);
    const add = root.find(
      (n) =>
        typeof n.type === "string" &&
        n.props.accessibilityLabel === "Add transaction",
    );

    expect(add.props.accessibilityRole).toBe("button");
    expect(
      root.findAll(
        (n) =>
          typeof n.type === "string" && n.props.accessibilityRole === "tab",
      ),
    ).toHaveLength(5);

    act(() => {
      add.props.onPress();
    });

    expect(push).toHaveBeenCalledWith("/add-transaction");
  });

  it("uses GlassSurface fallback when blur is disabled", () => {
    const root = render(<GlassTabBar {...props()} disableBlur />);

    expect(
      root.find((n) => n.props.testID === "glass-surface-fallback"),
    ).toBeTruthy();
  });

  it("keeps every tab and the add button at least 44pt", () => {
    const root = render(<GlassTabBar {...props()} />);
    const controls = root.findAll(
      (n) =>
        (typeof n.type === "string" && n.props.accessibilityRole === "tab") ||
        (typeof n.type === "string" &&
          n.props.accessibilityLabel === "Add transaction"),
    );

    expect(controls).toHaveLength(6);
    for (const control of controls) {
      const style = flat(control.props.style);
      expect(style.minHeight).toBeGreaterThanOrEqual(44);
      expect(style.minWidth).toBeGreaterThanOrEqual(44);
    }
  });
});

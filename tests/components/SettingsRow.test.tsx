import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";
import { StyleSheet } from "react-native";

import { SettingsRow } from "@/components/ui/SettingsRow";

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

vi.mock("@expo/vector-icons", () => {
  const Ionicons = ({ name }: { name: string }) =>
    React.createElement("Ionicons", { name });
  (Ionicons as any).glyphMap = {
    "cash-outline": 1,
    "chevron-forward": 1,
  };
  return { Ionicons };
});

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
});

function textOf(node: ReactTestInstance | string): string {
  if (typeof node === "string") return node;
  return (node.children ?? [])
    .map((c) => (typeof c === "string" ? c : textOf(c)))
    .join("");
}

function getButton(root: ReactTestInstance): ReactTestInstance {
  return root.find(
    (n) => typeof n.type === "string" && n.props.accessibilityRole === "button",
  );
}

function press(node: ReactTestInstance): void {
  act(() => {
    node.props.onPress?.();
  });
}

describe("SettingsRow", () => {
  it("renders label and optional trailing value", () => {
    const root = render(
      <SettingsRow
        icon="cash-outline"
        label="Currency"
        trailingValue="USD"
        onPress={() => {}}
        accessibilityLabel="Currency"
      />,
    );
    expect(textOf(root)).toContain("Currency");
    expect(textOf(root)).toContain("USD");
  });

  it("calls onPress when pressed", () => {
    const onPress = vi.fn();
    const root = render(
      <SettingsRow
        icon="cash-outline"
        label="Currency"
        onPress={onPress}
        accessibilityLabel="Currency"
      />,
    );
    press(getButton(root));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not call onPress when comingSoon", () => {
    const onPress = vi.fn();
    const root = render(
      <SettingsRow
        icon="cash-outline"
        label="Currency"
        comingSoon
        onPress={onPress}
        accessibilityLabel="Currency"
      />,
    );
    press(getButton(root));
    expect(onPress).not.toHaveBeenCalled();
    expect(textOf(root)).toContain("Coming soon");
  });

  it("exposes accessibilityRole and accessibilityLabel", () => {
    const root = render(
      <SettingsRow
        icon="cash-outline"
        label="Theme"
        accessibilityLabel="Theme setting"
        onPress={() => {}}
      />,
    );
    const button = getButton(root);
    expect(button.props.accessibilityRole).toBe("button");
    expect(button.props.accessibilityLabel).toBe("Theme setting");
  });

  it("enforces a minimum 44pt touch target height", () => {
    const root = render(
      <SettingsRow
        icon="cash-outline"
        label="Currency"
        onPress={() => {}}
        accessibilityLabel="Currency"
      />,
    );
    const button = getButton(root);
    const flat = StyleSheet.flatten(button.props.style);
    expect(flat?.minHeight).toBeGreaterThanOrEqual(44);
  });
});

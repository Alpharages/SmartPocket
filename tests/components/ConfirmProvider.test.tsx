import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TestRenderer, { act, type ReactTestInstance } from "react-test-renderer";

import {
  ConfirmProvider,
  getConfirmHandler,
} from "@/components/ui/ConfirmProvider";

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

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

vi.mock("@expo/vector-icons", () => ({
  Ionicons: () => React.createElement("span"),
}));

let renderer: TestRenderer.ReactTestRenderer | null = null;

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

describe("ConfirmProvider", () => {
  it("registers an imperative confirm handler on mount and clears it on unmount", () => {
    expect(getConfirmHandler()).toBeNull();

    render(
      React.createElement(ConfirmProvider, null, React.createElement("View")),
    );
    expect(getConfirmHandler()).not.toBeNull();

    act(() => {
      renderer?.unmount();
    });
    renderer = null;
    expect(getConfirmHandler()).toBeNull();
  });

  it("renders children and resolves confirm() true when ConfirmSheet's confirm button is pressed", async () => {
    render(
      React.createElement(
        ConfirmProvider,
        null,
        React.createElement("Text", { testID: "child" }, "hello"),
      ),
    );
    const child = renderer!.root.find((n) => n.props.testID === "child");
    expect(child).toBeDefined();

    // Flush Sheet's mount-time AccessibilityInfo.isReduceMotionEnabled()
    // promise so its state update lands inside act(), not later.
    await act(async () => {});

    let result!: Promise<boolean>;
    act(() => {
      result = getConfirmHandler()!({
        title: "Delete transaction",
        message: "Are you sure?",
        destructive: true,
      });
    });

    const buttons = renderer!.root.findAll(
      (n) =>
        typeof n.type === "string" && n.props.accessibilityRole === "button",
    );
    const confirmButton = buttons.find((b) => {
      const texts = b.findAll((n) => String(n.type) === "Text");
      return texts.some((t) => (t.children ?? []).some((c) => c === "Confirm"));
    });
    expect(confirmButton).toBeDefined();
    act(() => {
      confirmButton!.props.onPress?.();
    });

    await expect(result).resolves.toBe(true);
  });
});

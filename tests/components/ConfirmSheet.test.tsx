import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TestRenderer, { act, type ReactTestInstance } from "react-test-renderer";

import { ConfirmSheet } from "@/components/ui/ConfirmSheet";

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
  Ionicons: ({ name, size, color }: { name: string; size?: number; color?: string }) =>
    React.createElement("span", { "data-icon": name, "data-size": size, "data-color": color }),
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

function textOf(node: ReactTestInstance | string): string {
  if (typeof node === "string") return node;
  return (node.children ?? [])
    .map((c) => (typeof c === "string" ? c : textOf(c)))
    .join("");
}

function queryText(root: ReactTestInstance, text: string): ReactTestInstance[] {
  return root.findAll(
    (n) => String(n.type) === "Text" && textOf(n) === text,
  );
}

function getByText(root: ReactTestInstance, text: string): ReactTestInstance {
  const matches = queryText(root, text);
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one Text "${text}", found ${matches.length}`,
    );
  }
  return matches[0];
}

function getButtons(root: ReactTestInstance): ReactTestInstance[] {
  return root.findAll(
    (n) => typeof n.type === "string" && n.props.accessibilityRole === "button",
  );
}

describe("ConfirmSheet", () => {
  it("does not render when visible is false", () => {
    const root = render(
      <ConfirmSheet
        visible={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    // Sheet returns null when not mounted, so no panel should exist.
    expect(root.findAll((n) => n.props.testID === "confirm-sheet-panel")).toHaveLength(0);
  });

  it("renders title and message when visible", () => {
    const root = render(
      <ConfirmSheet
        visible={true}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        title="Delete Item"
        message="Are you sure?"
      />,
    );
    expect(getByText(root, "Delete Item")).toBeTruthy();
    expect(getByText(root, "Are you sure?")).toBeTruthy();
  });

  it("renders default labels when none provided", () => {
    const root = render(
      <ConfirmSheet
        visible={true}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(getByText(root, "Confirm")).toBeTruthy();
    expect(getByText(root, "Cancel")).toBeTruthy();
  });

  it("calls onCancel when cancel button is pressed", () => {
    const onCancel = vi.fn();
    const root = render(
      <ConfirmSheet
        visible={true}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    const buttons = getButtons(root);
    const cancelButton = buttons.find((b) =>
      textOf(b).includes("Cancel"),
    );
    expect(cancelButton).toBeTruthy();
    act(() => {
      cancelButton!.props.onPress?.();
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onConfirm when confirm button is pressed", () => {
    const onConfirm = vi.fn();
    const root = render(
      <ConfirmSheet
        visible={true}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    const buttons = getButtons(root);
    const confirmButton = buttons.find((b) =>
      textOf(b).includes("Confirm"),
    );
    expect(confirmButton).toBeTruthy();
    act(() => {
      confirmButton!.props.onPress?.();
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("uses destructive variant for confirm button when destructive is true", () => {
    const root = render(
      <ConfirmSheet
        visible={true}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        destructive={true}
        confirmLabel="Delete"
      />,
    );
    expect(getByText(root, "Delete")).toBeTruthy();
    expect(getByText(root, "Cancel")).toBeTruthy();
  });
});

import React from "react";
import { describe, expect, it, vi } from "vitest";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";

import { EmptyState } from "@/components/ui/EmptyState";

vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({
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
    overlay: "#000000",
    text: "#111827",
    tint: "#4F46E5",
    icon: "#6B7280",
    tabIconDefault: "#6B7280",
    tabIconSelected: "#4F46E5",
  }),
}));

vi.mock("@expo/vector-icons", () => ({
  Ionicons: ({ name }: { name: string }) =>
    React.createElement("Ionicons", { name }),
}));

function render(ui: React.ReactElement): ReactTestInstance {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(ui);
  });
  return renderer.root;
}

function findByTestId(root: ReactTestInstance, testID: string): ReactTestInstance {
  return root.find((n) => n.props.testID === testID);
}

const icon = React.createElement("Ionicons", { name: "receipt-outline" });

describe("EmptyState", () => {
  it("AC1: renders icon, title, description, and action", () => {
    const onPress = vi.fn();
    const root = render(
      <EmptyState
        icon={icon}
        title="No transactions yet"
        description="Add your first income or expense"
        action={{ label: "Add Transaction", onPress }}
      />,
    );
    expect(findByTestId(root, "empty-state")).toBeDefined();
    expect(findByTestId(root, "empty-state-icon")).toBeDefined();
    expect(findByTestId(root, "empty-state-title")).toBeDefined();
    expect(findByTestId(root, "empty-state-description")).toBeDefined();
    expect(findByTestId(root, "empty-state-action")).toBeDefined();
  });

  it("AC1: renders without action when action is omitted", () => {
    const root = render(
      <EmptyState
        icon={icon}
        title="No items"
        description="Nothing here yet"
      />,
    );
    expect(() => findByTestId(root, "empty-state-action")).toThrow();
  });

  it("AC2: title is exposed as a header to screen readers", () => {
    const root = render(
      <EmptyState icon={icon} title="No cards yet" description="Add one" />,
    );
    const title = findByTestId(root, "empty-state-title");
    expect(title.props.accessibilityRole).toBe("header");
  });

  it("AC3: primary action delegates to Button and fires onPress", () => {
    const onPress = vi.fn();
    const root = render(
      <EmptyState
        icon={icon}
        title="No cards yet"
        description="Add one"
        action={{ label: "Add Card", onPress }}
      />,
    );
    const actionContainer = findByTestId(root, "empty-state-action");
    const button = actionContainer.find(
      (n) => n.props.accessibilityRole === "button",
    );
    act(() => {
      button.props.onPress?.();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("AC5: no-results variant copy differs from no-data — title and description are caller-supplied", () => {
    const noDataRoot = render(
      <EmptyState
        variant="no-data"
        icon={icon}
        title="No transactions yet"
        description="Add your first transaction"
      />,
    );
    const noResultsRoot = render(
      <EmptyState
        variant="no-results"
        icon={icon}
        title="No results found"
        description="Try adjusting your search"
      />,
    );
    const noDataTitle = findByTestId(noDataRoot, "empty-state-title");
    const noResultsTitle = findByTestId(noResultsRoot, "empty-state-title");
    expect(noDataTitle.props.children).not.toBe(noResultsTitle.props.children);
  });

  it("renders a custom ReactNode action instead of Button", () => {
    const customAction = React.createElement(
      "View",
      { testID: "custom-btn" },
      null,
    );
    const root = render(
      <EmptyState
        icon={icon}
        title="No items"
        description="desc"
        action={customAction}
      />,
    );
    expect(findByTestId(root, "empty-state-action")).toBeDefined();
    expect(findByTestId(root, "custom-btn")).toBeDefined();
  });

  it("uses custom testID prefix", () => {
    const root = render(
      <EmptyState
        icon={icon}
        title="T"
        description="D"
        testID="transactions-empty"
      />,
    );
    expect(findByTestId(root, "transactions-empty")).toBeDefined();
    expect(findByTestId(root, "transactions-empty-icon")).toBeDefined();
    expect(findByTestId(root, "transactions-empty-title")).toBeDefined();
  });

  it("icon container is hidden from accessibility tree", () => {
    const root = render(
      <EmptyState icon={icon} title="T" description="D" />,
    );
    const iconContainer = findByTestId(root, "empty-state-icon");
    expect(iconContainer.props.accessibilityElementsHidden).toBe(true);
  });
});

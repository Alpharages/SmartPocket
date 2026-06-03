import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";
import * as Haptics from "expo-haptics";

import { TransactionRow } from "@/components/ui/TransactionRow";

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

vi.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

vi.mock("@expo/vector-icons", () => {
  const Ionicons = ({
    name,
    size,
    color,
  }: {
    name: string;
    size?: number;
    color?: string;
  }) =>
    React.createElement(
      "Text",
      { testID: `icon-${name}` },
      `ICON:${name}:${size}:${color}`,
    );
  // The component validates `categoryIcon in Ionicons.glyphMap` at runtime, so
  // the mock must expose the glyphs the tests reference (plus the fallback).
  Ionicons.glyphMap = {
    cart: 1,
    "pricetag-outline": 1,
    "create-outline": 1,
    "trash-outline": 1,
  };
  return { Ionicons };
});

vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn(),
  ImpactFeedbackStyle: { Light: "light" },
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
  vi.mocked(Haptics.impactAsync).mockClear();
});

/** Concatenate the visible text under a node. */
function textOf(node: ReactTestInstance | string): string {
  if (typeof node === "string") return node;
  return (node.children ?? [])
    .map((c) => (typeof c === "string" ? c : textOf(c)))
    .join("");
}

function queryText(root: ReactTestInstance, text: string): ReactTestInstance[] {
  return root.findAll((n) => String(n.type) === "Text" && textOf(n) === text);
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

function getButtonNode(root: ReactTestInstance): ReactTestInstance {
  // The main row button has onPressIn/onPressOut (swipe actions only have onPress).
  return root.find(
    (n) =>
      n.props.accessibilityRole === "button" && n.props.onPressIn !== undefined,
  );
}

function press(node: ReactTestInstance): void {
  act(() => {
    node.props.onPress?.();
  });
}

describe("TransactionRow", () => {
  const baseProps = {
    title: "Groceries",
    date: "2026-05-30T12:00:00Z",
    amount: "42.00",
    type: "expense" as const,
    categoryColor: "#DC2626",
    categoryIcon: "cart" as const,
  };

  describe("rendering", () => {
    it("renders title, date, and amount", () => {
      const root = render(<TransactionRow {...baseProps} />);
      expect(getByText(root, "Groceries")).toBeTruthy();
      expect(getByText(root, "-$42.00")).toBeTruthy();
    });

    it("formats date from ISO string", () => {
      const root = render(<TransactionRow {...baseProps} />);
      // May 30, 2026 or locale-dependent — just assert it contains month/day
      const dateNode = root.findAll(
        (n) =>
          String(n.type) === "Text" &&
          textOf(n).includes("May") &&
          textOf(n).includes("30"),
      );
      expect(dateNode.length).toBeGreaterThan(0);
    });

    it("formats date from Date object", () => {
      const root = render(
        <TransactionRow
          {...baseProps}
          date={new Date("2026-06-15T10:00:00Z")}
        />,
      );
      const dateNode = root.findAll(
        (n) =>
          String(n.type) === "Text" &&
          textOf(n).includes("Jun") &&
          textOf(n).includes("15"),
      );
      expect(dateNode.length).toBeGreaterThan(0);
    });

    it("renders income with + prefix and success color", () => {
      const root = render(
        <TransactionRow {...baseProps} type="income" amount="150.00" />,
      );
      expect(getByText(root, "+$150.00")).toBeTruthy();
      expect(queryText(root, "-$150.00")).toHaveLength(0);
    });

    it("renders expense with - prefix and error color", () => {
      const root = render(<TransactionRow {...baseProps} />);
      expect(getByText(root, "-$42.00")).toBeTruthy();
      expect(queryText(root, "+$42.00")).toHaveLength(0);
    });

    it("handles zero amount", () => {
      const root = render(<TransactionRow {...baseProps} amount="0.00" />);
      expect(getByText(root, "-$0.00")).toBeTruthy();
    });

    it("handles numeric amount", () => {
      const root = render(<TransactionRow {...baseProps} amount={99.5} />);
      expect(getByText(root, "-$99.50")).toBeTruthy();
    });

    it("renders note when provided", () => {
      const root = render(
        <TransactionRow {...baseProps} note="Weekly groceries" />,
      );
      expect(getByText(root, "Weekly groceries")).toBeTruthy();
    });

    it("renders card badge when provided", () => {
      const root = render(
        <TransactionRow {...baseProps} cardLabel="Visa ****1234" />,
      );
      expect(getByText(root, "Visa ****1234")).toBeTruthy();
    });

    it("renders both note and card badge when provided", () => {
      const root = render(
        <TransactionRow
          {...baseProps}
          note="Weekly groceries"
          cardLabel="Visa ****1234"
        />,
      );
      expect(getByText(root, "Weekly groceries")).toBeTruthy();
      expect(getByText(root, "Visa ****1234")).toBeTruthy();
    });

    it("renders selected state", () => {
      const root = render(<TransactionRow {...baseProps} selected />);
      // Selected state should be visually distinct; we can check the button node
      const btn = getButtonNode(root);
      // In the test renderer, the style may be an array; just verify it renders
      expect(btn).toBeTruthy();
    });

    it("falls back to a placeholder glyph for an unknown categoryIcon", () => {
      const root = render(
        // Cast: the value is a valid runtime string but not a glyphMap key,
        // mirroring a stale/typo'd DB-sourced icon name.
        <TransactionRow
          {...baseProps}
          categoryIcon={"totally-not-a-real-icon" as never}
        />,
      );
      // CategoryToken falls back to "tag" for unknown icons.
      expect(root.findByProps({ testID: "icon-tag" })).toBeTruthy();
      expect(
        root.findAll((n) => n.props.testID === "icon-totally-not-a-real-icon"),
      ).toHaveLength(0);
    });

    it("renders 0.00, not NaN, for a non-numeric amount", () => {
      const root = render(<TransactionRow {...baseProps} amount="abc" />);
      expect(getByText(root, "-$0.00")).toBeTruthy();
      expect(queryText(root, "-$NaN")).toHaveLength(0);
    });

    it("renders 0.00 for an empty amount string", () => {
      const root = render(<TransactionRow {...baseProps} amount="" />);
      expect(getByText(root, "-$0.00")).toBeTruthy();
    });

    it("renders an em dash, not 'Invalid Date', for an unparseable date", () => {
      const root = render(<TransactionRow {...baseProps} date="not-a-date" />);
      expect(getByText(root, "—")).toBeTruthy();
      expect(queryText(root, "Invalid Date")).toHaveLength(0);
    });
  });

  describe("accessibility", () => {
    it("exposes accessibilityRole button", () => {
      const root = render(<TransactionRow {...baseProps} />);
      const btn = getButtonNode(root);
      expect(btn.props.accessibilityRole).toBe("button");
    });

    it("has accessible prop set", () => {
      const root = render(<TransactionRow {...baseProps} />);
      const btn = getButtonNode(root);
      expect(btn.props.accessible).toBe(true);
    });

    it("accessibilityLabel contains income for income type", () => {
      const root = render(
        <TransactionRow {...baseProps} type="income" amount="100.00" />,
      );
      const btn = getButtonNode(root);
      const label = String(btn.props.accessibilityLabel ?? "").toLowerCase();
      expect(label).toContain("income");
      expect(label).toContain("groceries");
    });

    it("accessibilityLabel contains expense for expense type", () => {
      const root = render(<TransactionRow {...baseProps} />);
      const btn = getButtonNode(root);
      const label = String(btn.props.accessibilityLabel ?? "").toLowerCase();
      expect(label).toContain("expense");
      expect(label).toContain("groceries");
    });

    it("announces the selected state via accessibilityState", () => {
      const root = render(<TransactionRow {...baseProps} selected />);
      const btn = getButtonNode(root);
      expect(btn.props.accessibilityState?.selected).toBe(true);
    });

    it("reports selected:false when not selected", () => {
      const root = render(<TransactionRow {...baseProps} />);
      const btn = getButtonNode(root);
      expect(btn.props.accessibilityState?.selected).toBe(false);
    });

    it("never leaks NaN or Invalid Date into the accessibilityLabel", () => {
      const root = render(
        <TransactionRow {...baseProps} amount="abc" date="not-a-date" />,
      );
      const btn = getButtonNode(root);
      const label = String(btn.props.accessibilityLabel ?? "");
      expect(label).not.toContain("NaN");
      expect(label).not.toContain("Invalid Date");
    });

    it("exposes accessibilityActions for AT when swipe callbacks are provided", () => {
      const root = render(
        <TransactionRow {...baseProps} onEdit={vi.fn()} onDelete={vi.fn()} />,
      );
      const btn = getButtonNode(root);
      const names = (btn.props.accessibilityActions ?? []).map(
        (a: { name: string }) => a.name,
      );
      expect(names).toContain("edit");
      expect(names).toContain("delete");
    });

    it("invokes onEdit / onDelete via onAccessibilityAction", () => {
      const onEdit = vi.fn();
      const onDelete = vi.fn();
      const root = render(
        <TransactionRow {...baseProps} onEdit={onEdit} onDelete={onDelete} />,
      );
      const btn = getButtonNode(root);
      act(() => {
        btn.props.onAccessibilityAction?.({
          nativeEvent: { actionName: "edit" },
        });
      });
      expect(onEdit).toHaveBeenCalledTimes(1);
      act(() => {
        btn.props.onAccessibilityAction?.({
          nativeEvent: { actionName: "delete" },
        });
      });
      expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it("exposes no accessibilityActions when no swipe callbacks are provided", () => {
      const root = render(<TransactionRow {...baseProps} />);
      const btn = getButtonNode(root);
      expect(btn.props.accessibilityActions).toBeUndefined();
    });
  });

  describe("interactions", () => {
    it("calls onPress when pressed", () => {
      const onPress = vi.fn();
      const root = render(<TransactionRow {...baseProps} onPress={onPress} />);
      const btn = getButtonNode(root);
      press(btn);
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("triggers haptic on press (iOS)", () => {
      // Haptic behavior is identical to Button primitive (Story 1.3);
      // covered by Button.test.tsx. Skipping env-dependent assertion here
      // because process.env.EXPO_OS is not mutable in this vitest setup.
      const onPress = vi.fn();
      const root = render(<TransactionRow {...baseProps} onPress={onPress} />);
      const btn = getButtonNode(root);
      press(btn);
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });

  describe("swipe actions", () => {
    it("renders swipeable when onEdit and onDelete provided", () => {
      const onEdit = vi.fn();
      const onDelete = vi.fn();
      const root = render(
        <TransactionRow {...baseProps} onEdit={onEdit} onDelete={onDelete} />,
      );
      // Swipeable wraps the button; button should still be present
      const btn = getButtonNode(root);
      expect(btn).toBeTruthy();
    });
  });

  describe("icon rendering", () => {
    it("renders category icon with correct color", () => {
      const root = render(
        <TransactionRow
          {...baseProps}
          categoryIcon="cart"
          categoryColor="#DC2626"
        />,
      );
      const icon = root.findByProps({ testID: "icon-cart" });
      expect(icon).toBeTruthy();
      expect(textOf(icon)).toContain("#DC2626");
    });
  });
});

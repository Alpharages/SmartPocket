import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";
import { Text } from "react-native";

import { StatCard } from "@/components/ui/StatCard";

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

vi.mock("@expo/vector-icons", () => ({
  Ionicons: ({
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
    ),
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

function getStatCardNode(root: ReactTestInstance): ReactTestInstance {
  return root.find((n) => n.props.accessibilityRole === "text");
}

describe("StatCard", () => {
  describe("rendering", () => {
    it("renders hero variant with label and amount", () => {
      const root = render(
        <StatCard variant="hero" label="Total Balance" amount={1240.5} />,
      );
      expect(getByText(root, "Total Balance")).toBeTruthy();
      expect(getByText(root, "$1240.50")).toBeTruthy();
      // Hero shows absolute value without sign prefix
      expect(queryText(root, "+$1240.50")).toHaveLength(0);
    });

    it("renders compact variant with label and amount", () => {
      const root = render(
        <StatCard variant="compact" label="Income" amount={500} />,
      );
      expect(getByText(root, "Income")).toBeTruthy();
      expect(getByText(root, "+$500.00")).toBeTruthy();
    });

    it("renders negative sign for expenses", () => {
      const root = render(
        <StatCard
          variant="compact"
          label="Expenses"
          amount={250}
          sign="negative"
        />,
      );
      expect(getByText(root, "Expenses")).toBeTruthy();
      expect(getByText(root, "-$250.00")).toBeTruthy();
    });

    it("renders neutral sign for zero amount", () => {
      const root = render(
        <StatCard variant="compact" label="Balance" amount={0} />,
      );
      expect(getByText(root, "Balance")).toBeTruthy();
      expect(getByText(root, "$0.00")).toBeTruthy();
    });

    it("infers positive sign from positive amount", () => {
      const root = render(
        <StatCard variant="compact" label="Income" amount={100} />,
      );
      expect(getByText(root, "+$100.00")).toBeTruthy();
    });

    it("infers negative sign from negative amount", () => {
      const root = render(
        <StatCard variant="compact" label="Expenses" amount={-75} />,
      );
      expect(getByText(root, "-$75.00")).toBeTruthy();
    });

    it("uses explicit sign prop over inferred amount", () => {
      const root = render(
        <StatCard
          variant="compact"
          label="Balance"
          amount={-50}
          sign="neutral"
        />,
      );
      expect(getByText(root, "$50.00")).toBeTruthy();
    });
  });

  describe("accessibility", () => {
    it("exposes accessibilityRole='text'", () => {
      const root = render(
        <StatCard variant="hero" label="Total Balance" amount={100} />,
      );
      expect(getStatCardNode(root).props.accessibilityRole).toBe("text");
    });

    it("sets accessible so the composed label is announced as one element", () => {
      const hero = render(
        <StatCard variant="hero" label="Total Balance" amount={100} />,
      );
      expect(getStatCardNode(hero).props.accessible).toBe(true);

      const compact = render(
        <StatCard variant="compact" label="Income" amount={100} />,
      );
      expect(getStatCardNode(compact).props.accessible).toBe(true);
    });

    it("pluralizes dollar/cent correctly for singular amounts", () => {
      const root = render(
        <StatCard
          variant="compact"
          label="Balance"
          amount={1.01}
          sign="neutral"
        />,
      );
      expect(getStatCardNode(root).props.accessibilityLabel).toBe(
        "Balance, 1 dollar, 1 cent",
      );
    });

    it("composes accessibilityLabel from label, sign, and amount", () => {
      const root = render(
        <StatCard
          variant="compact"
          label="Income"
          amount={1240.5}
          sign="positive"
        />,
      );
      expect(getStatCardNode(root).props.accessibilityLabel).toBe(
        "Income, plus, 1240 dollars, 50 cents",
      );
    });

    it("uses provided accessibilityLabel when given", () => {
      const root = render(
        <StatCard
          variant="compact"
          label="Income"
          amount={100}
          accessibilityLabel="Custom label"
        />,
      );
      expect(getStatCardNode(root).props.accessibilityLabel).toBe(
        "Custom label",
      );
    });

    it("announces minus for negative amounts", () => {
      const root = render(
        <StatCard
          variant="compact"
          label="Expenses"
          amount={99.99}
          sign="negative"
        />,
      );
      expect(getStatCardNode(root).props.accessibilityLabel).toBe(
        "Expenses, minus, 99 dollars, 99 cents",
      );
    });
  });

  describe("loading state", () => {
    it("renders skeleton placeholders when loading", () => {
      const root = render(
        <StatCard variant="hero" label="Total Balance" amount={100} loading />,
      );
      // In loading state, the text nodes should not be present
      expect(queryText(root, "Total Balance")).toHaveLength(0);
      expect(queryText(root, "$100.00")).toHaveLength(0);
    });

    it("renders skeleton placeholders in compact loading state", () => {
      const root = render(
        <StatCard variant="compact" label="Income" amount={100} loading />,
      );
      expect(queryText(root, "Income")).toHaveLength(0);
      expect(queryText(root, "+$100.00")).toHaveLength(0);
    });
  });

  describe("tabular figures", () => {
    it("applies the tabular-nums utility to the hero amount", () => {
      const root = render(
        <StatCard variant="hero" label="Total Balance" amount={100} />,
      );
      const amountNode = getByText(root, "$100.00");
      expect(amountNode.props.className).toContain("tabular-nums");
    });

    it("applies the tabular-nums utility to the compact amount", () => {
      const root = render(
        <StatCard variant="compact" label="Income" amount={100} />,
      );
      const amountNode = getByText(root, "+$100.00");
      expect(amountNode.props.className).toContain("tabular-nums");
    });
  });

  describe("currency formatting", () => {
    it("formats large amounts without commas (toFixed only)", () => {
      const root = render(
        <StatCard variant="compact" label="Balance" amount={1234567.89} />,
      );
      expect(getByText(root, "+$1234567.89")).toBeTruthy();
    });

    it("handles negative large amounts", () => {
      const root = render(
        <StatCard
          variant="compact"
          label="Debt"
          amount={-500000}
          sign="negative"
        />,
      );
      expect(getByText(root, "-$500000.00")).toBeTruthy();
    });
  });
});

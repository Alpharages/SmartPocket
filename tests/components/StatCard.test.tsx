import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";
import { Text } from "react-native";

import { StatCard } from "@/components/ui/StatCard";
import {
  formatCurrency,
  formatCurrencyAccessibilityLabel,
} from "@/lib/currency";
import { resolveGradientInk } from "@/lib/_core/glass";
import { getThemeTokens } from "@/lib/_core/theme";
import { MAX_FONT_SCALE } from "@/lib/_core/a11y";

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

const currencyMock = vi.hoisted(() => ({
  currency: "USD" as const,
  setCurrency: vi.fn(),
  isReady: true,
}));

vi.mock("@/hooks/use-colors", () => ({
  useColors: () => mockColors,
}));

vi.mock("@/lib/currency-provider", () => ({
  useCurrency: () => currencyMock,
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
  currencyMock.isReady = true;
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
      expect(
        getByText(root, formatCurrency(1240.5, "USD", { sign: "absolute" })),
      ).toBeTruthy();
      // Hero shows absolute value without sign prefix
      expect(
        queryText(root, formatCurrency(1240.5, "USD", { sign: "positive" })),
      ).toHaveLength(0);
    });

    it("colors hero text with the theme gradient's AA-safe ink, not hardcoded white", () => {
      // No ThemeProvider → aurora/light, whose light stops fail AA behind
      // white — the resolved ink (near-black) must be applied to both texts.
      const { ink } = resolveGradientInk(
        getThemeTokens("aurora", "light").gradient.colors,
      );
      const root = render(
        <StatCard variant="hero" label="Total Balance" amount={1240.5} />,
      );
      const flatColor = (node: ReactTestInstance) => {
        const flat = Array.isArray(node.props.style)
          ? Object.assign({}, ...node.props.style.filter(Boolean))
          : (node.props.style ?? {});
        return flat.color;
      };
      expect(flatColor(getByText(root, "Total Balance"))).toBe(ink);
      expect(
        flatColor(
          getByText(root, formatCurrency(1240.5, "USD", { sign: "absolute" })),
        ),
      ).toBe(ink);
    });

    it("renders compact variant with label and amount", () => {
      const root = render(
        <StatCard variant="compact" label="Income" amount={500} />,
      );
      expect(getByText(root, "Income")).toBeTruthy();
      expect(
        getByText(root, formatCurrency(500, "USD", { sign: "positive" })),
      ).toBeTruthy();
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
      expect(
        getByText(root, formatCurrency(250, "USD", { sign: "negative" })),
      ).toBeTruthy();
    });

    it("renders neutral sign for zero amount", () => {
      const root = render(
        <StatCard variant="compact" label="Balance" amount={0} />,
      );
      expect(getByText(root, "Balance")).toBeTruthy();
      expect(getByText(root, formatCurrency(0, "USD"))).toBeTruthy();
    });

    it("infers positive sign from positive amount", () => {
      const root = render(
        <StatCard variant="compact" label="Income" amount={100} />,
      );
      expect(
        getByText(root, formatCurrency(100, "USD", { sign: "positive" })),
      ).toBeTruthy();
    });

    it("infers negative sign from negative amount", () => {
      const root = render(
        <StatCard variant="compact" label="Expenses" amount={-75} />,
      );
      expect(
        getByText(root, formatCurrency(75, "USD", { sign: "negative" })),
      ).toBeTruthy();
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
      expect(
        getByText(root, formatCurrency(-50, "USD", { sign: "neutral" })),
      ).toBeTruthy();
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

    it("uses currency-aware accessibility labels", () => {
      const root = render(
        <StatCard
          variant="compact"
          label="Income"
          amount={1240.5}
          sign="positive"
        />,
      );
      expect(getStatCardNode(root).props.accessibilityLabel).toBe(
        `Income, ${formatCurrencyAccessibilityLabel(1240.5, "USD", "positive")}`,
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
        `Expenses, ${formatCurrencyAccessibilityLabel(99.99, "USD", "negative")}`,
      );
    });

    it("shows skeleton while currency preference is loading", () => {
      currencyMock.isReady = false;
      const root = render(
        <StatCard variant="compact" label="Income" amount={100} />,
      );
      expect(
        queryText(root, formatCurrency(100, "USD", { sign: "positive" })),
      ).toHaveLength(0);
    });
  });

  describe("loading state", () => {
    it("renders skeleton placeholders when loading", () => {
      const root = render(
        <StatCard variant="hero" label="Total Balance" amount={100} loading />,
      );
      // In loading state, the text nodes should not be present
      expect(queryText(root, "Total Balance")).toHaveLength(0);
      expect(queryText(root, formatCurrency(100, "USD"))).toHaveLength(0);
    });

    it("renders skeleton placeholders in compact loading state", () => {
      const root = render(
        <StatCard variant="compact" label="Income" amount={100} loading />,
      );
      expect(queryText(root, "Income")).toHaveLength(0);
      expect(
        queryText(root, formatCurrency(100, "USD", { sign: "positive" })),
      ).toHaveLength(0);
    });
  });

  describe("tabular figures", () => {
    it("applies the tabular-nums utility to the hero amount", () => {
      const root = render(
        <StatCard variant="hero" label="Total Balance" amount={100} />,
      );
      const amountNode = getByText(
        root,
        formatCurrency(100, "USD", { sign: "absolute" }),
      );
      expect(amountNode.props.className).toContain("tabular-nums");
    });

    it("applies the tabular-nums utility to the compact amount", () => {
      const root = render(
        <StatCard variant="compact" label="Income" amount={100} />,
      );
      const amountNode = getByText(
        root,
        formatCurrency(100, "USD", { sign: "positive" }),
      );
      expect(amountNode.props.className).toContain("tabular-nums");
    });
  });

  describe("dynamic type (AC5, MAX_FONT_SCALE cap)", () => {
    it("caps the hero amount's font scaling at MAX_FONT_SCALE", () => {
      const root = render(
        <StatCard variant="hero" label="Total Balance" amount={100} />,
      );
      const amountNode = getByText(
        root,
        formatCurrency(100, "USD", { sign: "absolute" }),
      );
      expect(amountNode.props.maxFontSizeMultiplier).toBe(MAX_FONT_SCALE);
    });

    it("caps the compact amount's font scaling at MAX_FONT_SCALE", () => {
      const root = render(
        <StatCard variant="compact" label="Income" amount={100} />,
      );
      const amountNode = getByText(
        root,
        formatCurrency(100, "USD", { sign: "positive" }),
      );
      expect(amountNode.props.maxFontSizeMultiplier).toBe(MAX_FONT_SCALE);
    });
  });

  describe("currency formatting", () => {
    it("formats large amounts via Intl currency formatting", () => {
      const root = render(
        <StatCard variant="compact" label="Balance" amount={1234567.89} />,
      );
      expect(
        getByText(
          root,
          formatCurrency(1234567.89, "USD", { sign: "positive" }),
        ),
      ).toBeTruthy();
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
      expect(
        getByText(root, formatCurrency(500000, "USD", { sign: "negative" })),
      ).toBeTruthy();
    });
  });
});

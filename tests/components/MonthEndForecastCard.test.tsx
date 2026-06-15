import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TestRenderer, { act, type ReactTestRenderer } from "react-test-renderer";

import {
  MonthEndForecastCard,
  buildMonthEndForecastAccessibilityLabel,
} from "@/components/ui/MonthEndForecastCard";
import { formatCurrency } from "@/lib/currency";

vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({
    primary: "#4F46E5",
    surface: "#FFFFFF",
    foreground: "#111827",
    muted: "#6B7280",
    error: "#DC2626",
  }),
}));

vi.mock("@/lib/currency-provider", () => ({
  useCurrency: () => ({
    currency: "USD",
    setCurrency: vi.fn(),
    isReady: true,
  }),
}));

let renderer: ReactTestRenderer | null = null;

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = null;
});

function textOf(node: { children?: unknown[] } | string): string {
  if (typeof node === "string") return node;
  return (node.children ?? [])
    .map((child) =>
      typeof child === "string" ? child : textOf(child as { children?: unknown[] }),
    )
    .join("");
}

function findAccessibilityLabel(
  node: { props?: { accessibilityLabel?: string }; children?: unknown[] },
): string | undefined {
  if (node.props?.accessibilityLabel) {
    return node.props.accessibilityLabel;
  }

  for (const child of node.children ?? []) {
    if (typeof child !== "string" && child && typeof child === "object") {
      const label = findAccessibilityLabel(
        child as { props?: { accessibilityLabel?: string }; children?: unknown[] },
      );
      if (label) return label;
    }
  }

  return undefined;
}

describe("buildMonthEndForecastAccessibilityLabel", () => {
  it("includes estimated wording when currency is ready", () => {
    const label = buildMonthEndForecastAccessibilityLabel(900, "USD", true);
    expect(label).toMatch(/^Projected month-end expense, estimated /);
    expect(label.toLowerCase()).toContain("estimated");
  });

  it("announces loading when currency is not ready", () => {
    expect(buildMonthEndForecastAccessibilityLabel(0, "USD", false)).toBe(
      "Projected month-end expense, estimated amount loading",
    );
  });
});

describe("MonthEndForecastCard", () => {
  it("renders estimate title, caption, and formatted projected amount", () => {
    const expected = formatCurrency(900, "USD", { sign: "negative" });

    act(() => {
      renderer = TestRenderer.create(<MonthEndForecastCard projected={900} />);
    });

    const text = textOf(renderer!.root);
    expect(text).toContain("Projected month-end");
    expect(text).toContain("Estimate based on this month's pace");
    expect(text).toContain(expected.replace(/^-/, ""));
  });

  it("renders zero spend without NaN or Infinity", () => {
    act(() => {
      renderer = TestRenderer.create(<MonthEndForecastCard projected={0} />);
    });

    const text = textOf(renderer!.root);
    expect(text).toContain(formatCurrency(0, "USD", { sign: "negative" }));
    expect(text).not.toMatch(/NaN|Infinity/);
  });

  it("exposes an accessibility label that names the figure as an estimate", () => {
    act(() => {
      renderer = TestRenderer.create(<MonthEndForecastCard projected={450} />);
    });

    const label = findAccessibilityLabel(renderer!.root);
    expect(label).toBeDefined();
    expect(label!.toLowerCase()).toContain("estimated");
  });
});

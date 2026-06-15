import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TestRenderer, { act, type ReactTestRenderer } from "react-test-renderer";

import { formatCurrency } from "@/lib/currency";
import { StatCard } from "@/components/ui/StatCard";

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
    text: "#111827",
    tint: "#4F46E5",
    icon: "#6B7280",
    tabIconDefault: "#6B7280",
    tabIconSelected: "#4F46E5",
  }),
}));

vi.mock("@expo/vector-icons", () => ({
  Ionicons: ({ name }: { name: string }) => React.createElement("Text", {}, name),
}));

vi.mock("@/lib/currency-provider", () => ({
  useCurrency: () => ({
    currency: "GBP",
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
    .map((child) => (typeof child === "string" ? child : textOf(child as { children?: unknown[] })))
    .join("");
}

describe("summary currency rendering", () => {
  it("StatCard renders GBP formatted amount from useCurrency", () => {
    const expected = formatCurrency(250, "GBP", { sign: "negative" });

    act(() => {
      renderer = TestRenderer.create(
        <StatCard variant="compact" label="Expenses" amount={250} sign="negative" />,
      );
    });

    expect(textOf(renderer!.root)).toContain(expected.replace(/^-/, "-"));
    expect(expected).toMatch(/£/);
  });
});

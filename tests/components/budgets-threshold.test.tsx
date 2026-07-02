import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TestRenderer, { act, type ReactTestRenderer } from "react-test-renderer";

import { BudgetThresholdProgress } from "@/components/budgets/BudgetThresholdProgress";

const mockColors = {
  primary: "#4F46E5",
  warning: "#D97706",
  error: "#DC2626",
  border: "#E5E7EB",
};

vi.mock("@/hooks/use-colors", () => ({
  useColors: () => mockColors,
}));

vi.mock("@/lib/_core/theme", () => ({
  getElevationStyle: () => ({}),
  Typography: {
    caption: { fontSize: 12, lineHeight: 16 },
  },
}));

vi.mock("@expo/vector-icons", () => {
  const Ionicons = ({ name, color }: { name: string; color?: string }) =>
    React.createElement("Ionicons", { name, color });
  (Ionicons as any).glyphMap = {
    "alert-circle-outline": 1,
    "warning-outline": 1,
  };
  return { Ionicons };
});

let renderer: ReactTestRenderer | null = null;

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = null;
});

describe("BudgetThresholdProgress", () => {
  it("shows no alert for ok utilization (AC4)", () => {
    act(() => {
      renderer = TestRenderer.create(
        <BudgetThresholdProgress
          categoryName="Groceries"
          percent={0.4}
          state="ok"
        />,
      );
    });
    const serialized = JSON.stringify(renderer!.toJSON());
    expect(serialized).not.toContain("Approaching limit");
    expect(serialized).not.toContain("Over budget");
  });

  it("shows warning icon, label, and a11y for near state (AC2, AC5)", () => {
    act(() => {
      renderer = TestRenderer.create(
        <BudgetThresholdProgress
          categoryName="Groceries"
          percent={0.85}
          state="near"
        />,
      );
    });
    const serialized = JSON.stringify(renderer!.toJSON());
    expect(serialized).toContain("Approaching limit");
    expect(serialized).toContain("85% used");
    expect(serialized).toContain(mockColors.warning);
    expect(serialized).toContain("alert-circle-outline");

    const progress = renderer!.root.findByProps({
      accessibilityRole: "progressbar",
    });
    expect(progress.props.accessibilityLabel).toContain("approaching limit");
    expect(progress.props.accessibilityLabel).toContain("85%");
  });

  it("shows error icon, label, and a11y for over state (AC3, AC5)", () => {
    act(() => {
      renderer = TestRenderer.create(
        <BudgetThresholdProgress
          categoryName="Groceries"
          percent={1.2}
          state="over"
        />,
      );
    });
    const serialized = JSON.stringify(renderer!.toJSON());
    expect(serialized).toContain("Over budget");
    expect(serialized).toContain(mockColors.error);
    expect(serialized).toContain("warning-outline");

    const progress = renderer!.root.findByProps({
      accessibilityRole: "progressbar",
    });
    expect(progress.props.accessibilityLabel).toContain("over budget");
    expect(progress.props.accessibilityLabel).toContain("120%");
  });
});

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TestRenderer, { act, type ReactTestRenderer } from "react-test-renderer";

import {
  CategoryPieChart,
  buildCategoryPieAccessibilityLabel,
  buildPieChartData,
  type CategoryPieSlice,
} from "@/components/ui/CategoryPieChart";

const pieChartMock = vi.hoisted(() =>
  vi.fn(
    ({
      data,
      width,
      height,
      center,
    }: {
      data: unknown[];
      width: number;
      height: number;
      center?: number[];
    }) =>
      React.createElement(
        "View",
        {
          testID: "pie-chart",
          "data-length": data.length,
          width,
          height,
          center,
        },
        null,
      ),
  ),
);

vi.mock("react-native-chart-kit", () => ({
  PieChart: (props: { data: unknown[]; width: number; height: number }) =>
    pieChartMock(props),
}));

let renderer: ReactTestRenderer | null = null;

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = null;
  pieChartMock.mockClear();
});

const slices: CategoryPieSlice[] = [
  { name: "Groceries", total: 420, color: "#4F46E5" },
  { name: "Rent", total: 300, color: "#059669" },
  { name: "Transport", total: 80, color: "#D97706" },
];

describe("buildPieChartData", () => {
  it("maps slices to chart-kit data shape with population and colors", () => {
    const data = buildPieChartData(slices, "#6B7280");

    expect(data).toEqual([
      {
        name: "Groceries",
        population: 420,
        color: "#4F46E5",
        legendFontColor: "#6B7280",
        legendFontSize: 12,
      },
      {
        name: "Rent",
        population: 300,
        color: "#059669",
        legendFontColor: "#6B7280",
        legendFontSize: 12,
      },
      {
        name: "Transport",
        population: 80,
        color: "#D97706",
        legendFontColor: "#6B7280",
        legendFontSize: 12,
      },
    ]);
  });
});

describe("buildCategoryPieAccessibilityLabel", () => {
  it("summarizes category names and rounded percentages", () => {
    const label = buildCategoryPieAccessibilityLabel(slices, 800);

    expect(label).toBe(
      "Spending breakdown: Groceries 52.5%, Rent 37.5%, Transport 10.0%",
    );
  });

  it("returns empty string when there are no slices", () => {
    expect(buildCategoryPieAccessibilityLabel([], 0)).toBe("");
  });

  it("avoids divide-by-zero when total expenses is zero", () => {
    expect(buildCategoryPieAccessibilityLabel(slices, 0)).toBe(
      "Spending breakdown: Groceries, Rent, Transport",
    );
  });
});

describe("CategoryPieChart", () => {
  it("renders null when slices are empty", () => {
    act(() => {
      renderer = TestRenderer.create(
        <CategoryPieChart
          slices={[]}
          totalExpenses={0}
          legendFontColor="#6B7280"
        />,
      );
    });

    expect(renderer!.toJSON()).toBeNull();
    expect(pieChartMock).not.toHaveBeenCalled();
  });

  it("renders PieChart with one slice per category", () => {
    act(() => {
      renderer = TestRenderer.create(
        <CategoryPieChart
          slices={slices}
          totalExpenses={800}
          legendFontColor="#6B7280"
          width={320}
        />,
      );
    });

    expect(pieChartMock).toHaveBeenCalledTimes(1);
    const props = pieChartMock.mock.calls[0]![0];
    expect(props.data).toHaveLength(3);
    expect(props.width).toBe(320);
    expect(props.height).toBeGreaterThan(0);
  });

  it("exposes a non-empty accessibility label on the chart container", () => {
    act(() => {
      renderer = TestRenderer.create(
        <CategoryPieChart
          slices={slices}
          totalExpenses={800}
          legendFontColor="#6B7280"
        />,
      );
    });

    const chartContainer = renderer!.root.find(
      (node) =>
        node.props.accessibilityLabel ===
        "Spending breakdown: Groceries 52.5%, Rent 37.5%, Transport 10.0%",
    );
    expect(chartContainer).toBeDefined();
    expect(chartContainer.props.accessibilityRole).toBe("image");
  });

  it("uses window width fallback and does not apply a magic center offset", () => {
    act(() => {
      renderer = TestRenderer.create(
        <CategoryPieChart
          slices={slices}
          totalExpenses={800}
          legendFontColor="#6B7280"
        />,
      );
    });

    const props = pieChartMock.mock.calls[0]![0];
    // __mocks__/react-native.ts useWindowDimensions → width 390
    expect(props.width).toBe(390 - 32 * 2);
    expect(props.center).toBeUndefined();
  });
});

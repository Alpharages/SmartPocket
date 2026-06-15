import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TestRenderer, { act, type ReactTestRenderer } from "react-test-renderer";

import {
  MonthlyTrendChart,
  buildMonthlyTrendAccessibilityLabel,
  buildMonthlyTrendChartData,
  formatMonthLabel,
  hasMonthlyTrendHistory,
  type MonthlyTrendPoint,
} from "@/components/ui/MonthlyTrendChart";

const lineChartMock = vi.hoisted(() =>
  vi.fn(
    ({
      data,
      width,
      height,
      onDataPointClick,
    }: {
      data: { labels: string[]; datasets: { data: number[] }[]; legend?: string[] };
      width: number;
      height: number;
      onDataPointClick?: (payload: { index: number }) => void;
    }) =>
      React.createElement(
        "View",
        {
          testID: "line-chart",
          "data-length": data.datasets.length,
          width,
          height,
          onDataPointClick,
        },
        null,
      ),
  ),
);

vi.mock("react-native-chart-kit", () => ({
  LineChart: (props: {
    data: { labels: string[]; datasets: { data: number[] }[]; legend?: string[] };
    width: number;
    height: number;
    onDataPointClick?: (payload: { index: number }) => void;
  }) => lineChartMock(props),
}));

let renderer: ReactTestRenderer | null = null;

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = null;
  lineChartMock.mockClear();
});

const trendData: MonthlyTrendPoint[] = [
  {
    year: 2026,
    month: 1,
    totalIncome: 3200,
    totalExpense: 2100,
    netBalance: 1100,
  },
  {
    year: 2026,
    month: 2,
    totalIncome: 2800,
    totalExpense: 2400,
    netBalance: 400,
  },
];

const formatAmount = (amount: number) => `$${amount.toFixed(0)}`;

describe("formatMonthLabel", () => {
  it("returns a short month label", () => {
    expect(formatMonthLabel(2026, 6)).toBe("Jun");
  });
});

describe("buildMonthlyTrendChartData", () => {
  it("maps trend points to line chart datasets with legend labels", () => {
    const chartData = buildMonthlyTrendChartData(trendData, {
      income: "#047857",
      expense: "#DC2626",
      net: "#4F46E5",
    });

    expect(chartData.labels).toEqual(["Jan", "Feb"]);
    expect(chartData.legend).toEqual(["Income", "Expense", "Net"]);
    expect(chartData.datasets[0]?.data).toEqual([3200, 2800]);
    expect(chartData.datasets[1]?.data).toEqual([2100, 2400]);
    expect(chartData.datasets[2]?.data).toEqual([1100, 400]);
  });
});

describe("buildMonthlyTrendAccessibilityLabel", () => {
  it("summarizes each month with income, expense, and net", () => {
    const label = buildMonthlyTrendAccessibilityLabel(trendData, formatAmount);

    expect(label).toBe(
      "Spending trend, last 2 months. January: income $3200, expense $2100, net +$1100. February: income $2800, expense $2400, net +$400",
    );
  });

  it("returns empty string when there is no data", () => {
    expect(buildMonthlyTrendAccessibilityLabel([], formatAmount)).toBe("");
  });
});

describe("hasMonthlyTrendHistory", () => {
  it("returns false when every month is zero", () => {
    expect(
      hasMonthlyTrendHistory([
        {
          year: 2026,
          month: 1,
          totalIncome: 0,
          totalExpense: 0,
          netBalance: 0,
        },
      ]),
    ).toBe(false);
  });

  it("returns true when any month has income or expense", () => {
    expect(hasMonthlyTrendHistory(trendData)).toBe(true);
  });
});

describe("MonthlyTrendChart", () => {
  it("renders null when data is empty", () => {
    act(() => {
      renderer = TestRenderer.create(
        <MonthlyTrendChart
          data={[]}
          incomeColor="#047857"
          expenseColor="#DC2626"
          netColor="#4F46E5"
          labelColor="#6B7280"
          backgroundColor="#FFFFFF"
          formatAmount={formatAmount}
        />,
      );
    });

    expect(renderer!.toJSON()).toBeNull();
    expect(lineChartMock).not.toHaveBeenCalled();
  });

  it("renders a line chart with three datasets", () => {
    act(() => {
      renderer = TestRenderer.create(
        <MonthlyTrendChart
          data={trendData}
          incomeColor="#047857"
          expenseColor="#DC2626"
          netColor="#4F46E5"
          labelColor="#6B7280"
          backgroundColor="#FFFFFF"
          formatAmount={formatAmount}
          width={320}
        />,
      );
    });

    expect(lineChartMock).toHaveBeenCalledTimes(1);
    const props = lineChartMock.mock.calls[0]![0];
    expect(props.data.datasets).toHaveLength(3);
    expect(props.width).toBe(320);
  });

  it("exposes a non-empty accessibility label on the chart container", () => {
    act(() => {
      renderer = TestRenderer.create(
        <MonthlyTrendChart
          data={trendData}
          incomeColor="#047857"
          expenseColor="#DC2626"
          netColor="#4F46E5"
          labelColor="#6B7280"
          backgroundColor="#FFFFFF"
          formatAmount={formatAmount}
        />,
      );
    });

    const chartContainer = renderer!.root.find(
      (node) =>
        node.props.accessibilityLabel ===
        "Spending trend, last 2 months. January: income $3200, expense $2100, net +$1100. February: income $2800, expense $2400, net +$400",
    );
    expect(chartContainer).toBeDefined();
    expect(chartContainer.props.accessibilityRole).toBe("image");
  });

  it("fires onSelectMonth when a month label is pressed", () => {
    const onSelectMonth = vi.fn();

    act(() => {
      renderer = TestRenderer.create(
        <MonthlyTrendChart
          data={trendData}
          incomeColor="#047857"
          expenseColor="#DC2626"
          netColor="#4F46E5"
          labelColor="#6B7280"
          backgroundColor="#FFFFFF"
          formatAmount={formatAmount}
          onSelectMonth={onSelectMonth}
        />,
      );
    });

    const febButton = renderer!.root.find(
      (node) => node.props.accessibilityLabel === "View Feb",
    );
    act(() => {
      febButton.props.onPress();
    });

    expect(onSelectMonth).toHaveBeenCalledWith(2026, 2);
  });
});

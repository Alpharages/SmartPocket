import React, { useMemo, useState } from "react";
import {
  type LayoutChangeEvent,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { LineChart } from "react-native-chart-kit";

export interface MonthlyTrendPoint {
  year: number;
  month: number;
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
}

export interface MonthlyTrendChartProps {
  data: MonthlyTrendPoint[];
  incomeColor: string;
  expenseColor: string;
  netColor: string;
  labelColor: string;
  backgroundColor: string;
  formatAmount: (amount: number) => string;
  onSelectMonth?: (year: number, month: number) => void;
  width?: number;
}

const CHART_HEIGHT = 220;
const HORIZONTAL_PADDING = 32;

export function formatMonthLabel(year: number, month: number): string {
  return new Date(year, month - 1).toLocaleDateString("en-US", {
    month: "short",
  });
}

export function buildMonthlyTrendChartData(
  data: MonthlyTrendPoint[],
  colors: { income: string; expense: string; net: string },
) {
  return {
    labels: data.map((point) => formatMonthLabel(point.year, point.month)),
    datasets: [
      {
        data: data.map((point) => point.totalIncome),
        color: () => colors.income,
        strokeWidth: 2,
      },
      {
        data: data.map((point) => point.totalExpense),
        color: () => colors.expense,
        strokeWidth: 2,
      },
      {
        data: data.map((point) => point.netBalance),
        color: () => colors.net,
        strokeWidth: 2,
      },
    ],
    legend: ["Income", "Expense", "Net"],
  };
}

export function buildMonthlyTrendAccessibilityLabel(
  data: MonthlyTrendPoint[],
  formatAmount: (amount: number) => string,
): string {
  if (data.length === 0) return "";

  const parts = data.map((point) => {
    const monthName = new Date(point.year, point.month - 1).toLocaleDateString(
      "en-US",
      { month: "long" },
    );
    const netPrefix = point.netBalance >= 0 ? "+" : "";
    return `${monthName}: income ${formatAmount(point.totalIncome)}, expense ${formatAmount(point.totalExpense)}, net ${netPrefix}${formatAmount(point.netBalance)}`;
  });

  return `Spending trend, last ${data.length} months. ${parts.join(". ")}`;
}

export function hasMonthlyTrendHistory(data: MonthlyTrendPoint[]): boolean {
  return data.some((point) => point.totalIncome > 0 || point.totalExpense > 0);
}

export function MonthlyTrendChart({
  data,
  incomeColor,
  expenseColor,
  netColor,
  labelColor,
  backgroundColor,
  formatAmount,
  onSelectMonth,
  width,
}: MonthlyTrendChartProps) {
  const { width: windowWidth } = useWindowDimensions();
  const [layoutWidth, setLayoutWidth] = useState<number | null>(null);

  const chartWidth = useMemo(() => {
    if (width != null) return width;
    if (layoutWidth != null && layoutWidth > 0) return layoutWidth;
    return Math.max(windowWidth - HORIZONTAL_PADDING * 2, 200);
  }, [width, layoutWidth, windowWidth]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const measuredWidth = event.nativeEvent.layout.width;
    if (measuredWidth > 0) {
      setLayoutWidth(measuredWidth);
    }
  };

  const chartData = useMemo(
    () =>
      buildMonthlyTrendChartData(data, {
        income: incomeColor,
        expense: expenseColor,
        net: netColor,
      }),
    [data, incomeColor, expenseColor, netColor],
  );

  const accessibilityLabel = useMemo(
    () => buildMonthlyTrendAccessibilityLabel(data, formatAmount),
    [data, formatAmount],
  );

  if (data.length === 0) return null;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      className="w-full items-center py-4"
      onLayout={width == null ? handleLayout : undefined}
    >
      <LineChart
        data={chartData}
        width={chartWidth}
        height={CHART_HEIGHT}
        withShadow={false}
        chartConfig={{
          backgroundColor,
          backgroundGradientFrom: backgroundColor,
          backgroundGradientTo: backgroundColor,
          decimalPlaces: 0,
          color: () => labelColor,
          labelColor: () => labelColor,
          propsForDots: { r: "4" },
        }}
        onDataPointClick={({ index }) => {
          const point = data[index];
          if (point && onSelectMonth) {
            onSelectMonth(point.year, point.month);
          }
        }}
        style={{ borderRadius: 12 }}
      />
      <View className="flex-row flex-wrap justify-center gap-4 mt-3 px-2">
        {chartData.legend?.map((label, index) => (
          <View key={label} className="flex-row items-center gap-1.5">
            <View
              className="w-2.5 h-2.5 rounded-full"
              style={{
                backgroundColor: [incomeColor, expenseColor, netColor][index],
              }}
            />
            <Text className="text-xs text-muted">{label}</Text>
          </View>
        ))}
      </View>
      {onSelectMonth ? (
        <View className="flex-row flex-wrap justify-center gap-2 mt-3 px-2">
          {data.map((point) => (
            <Pressable
              key={`${point.year}-${point.month}`}
              onPress={() => onSelectMonth(point.year, point.month)}
              accessibilityRole="button"
              accessibilityLabel={`View ${formatMonthLabel(point.year, point.month)}`}
              className="px-2 py-1 rounded-full active:opacity-70"
            >
              <Text className="text-xs font-medium text-primary">
                {formatMonthLabel(point.year, point.month)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

import React, { useMemo, useState } from "react";
import {
  type LayoutChangeEvent,
  useWindowDimensions,
  View,
} from "react-native";
import { PieChart } from "react-native-chart-kit";

export interface CategoryPieSlice {
  name: string;
  total: number;
  color: string;
}

export interface CategoryPieChartProps {
  slices: CategoryPieSlice[];
  totalExpenses: number;
  legendFontColor: string;
  width?: number;
}

const CHART_HEIGHT = 220;
const HORIZONTAL_PADDING = 32;

export function buildPieChartData(
  slices: CategoryPieSlice[],
  legendFontColor: string,
) {
  return slices.map((slice) => ({
    name: slice.name,
    population: slice.total,
    color: slice.color,
    legendFontColor,
    legendFontSize: 12,
  }));
}

export function buildCategoryPieAccessibilityLabel(
  slices: CategoryPieSlice[],
  totalExpenses: number,
): string {
  if (slices.length === 0) return "";

  const parts = slices.map((slice) => {
    if (totalExpenses <= 0) return slice.name;
    const percentage = (slice.total / totalExpenses) * 100;
    return `${slice.name} ${percentage.toFixed(1)}%`;
  });

  return `Spending breakdown: ${parts.join(", ")}`;
}

export function CategoryPieChart({
  slices,
  totalExpenses,
  legendFontColor,
  width,
}: CategoryPieChartProps) {
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
    () => buildPieChartData(slices, legendFontColor),
    [slices, legendFontColor],
  );

  const accessibilityLabel = useMemo(
    () => buildCategoryPieAccessibilityLabel(slices, totalExpenses),
    [slices, totalExpenses],
  );

  if (slices.length === 0) return null;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      className="w-full items-center py-4"
      onLayout={width == null ? handleLayout : undefined}
    >
      <PieChart
        data={chartData}
        width={chartWidth}
        height={CHART_HEIGHT}
        accessor="population"
        backgroundColor="transparent"
        paddingLeft="0"
        hasLegend={false}
        chartConfig={{
          color: () => legendFontColor,
        }}
      />
    </View>
  );
}

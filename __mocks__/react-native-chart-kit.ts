import React from "react";

export const PieChart = ({
  data,
  width,
  height,
}: {
  data: unknown[];
  width: number;
  height: number;
}) =>
  React.createElement("View", {
    testID: "pie-chart",
    "data-length": data.length,
    width,
    height,
  });

export const LineChart = ({
  data,
  width,
  height,
  onDataPointClick,
}: {
  data: unknown;
  width: number;
  height: number;
  onDataPointClick?: (payload: { index: number }) => void;
}) =>
  React.createElement("View", {
    testID: "line-chart",
    data,
    width,
    height,
    onDataPointClick,
  });
export const BarChart = () =>
  React.createElement("View", { testID: "bar-chart" });
export const ProgressChart = () =>
  React.createElement("View", { testID: "progress-chart" });
export const ContributionGraph = () =>
  React.createElement("View", { testID: "contribution-graph" });
export const StackedBarChart = () =>
  React.createElement("View", { testID: "stacked-bar-chart" });

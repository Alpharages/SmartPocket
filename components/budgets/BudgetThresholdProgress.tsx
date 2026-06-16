import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ProgressBar, type ProgressBarTone } from "@/components/ui/ProgressBar";
import type { BudgetThresholdState } from "@/lib/budget-threshold";
import { useColors } from "@/hooks/use-colors";
import { Typography } from "@/lib/_core/theme";

export const BUDGET_THRESHOLD_ALERT = {
  near: {
    icon: "alert-circle-outline" as const,
    label: (percent: number) =>
      `Approaching limit · ${Math.round(percent * 100)}% used`,
    accessibilityState: "approaching limit",
  },
  over: {
    icon: "warning-outline" as const,
    label: () => "Over budget",
    accessibilityState: "over budget",
  },
} as const;

export function budgetProgressTone(
  state: BudgetThresholdState,
): ProgressBarTone {
  if (state === "over") return "over";
  if (state === "near") return "warning";
  return "neutral";
}

export function budgetProgressAccessibilityLabel(
  categoryName: string,
  state: BudgetThresholdState,
  percent: number,
): string | undefined {
  if (state === "ok") return undefined;
  const alert = BUDGET_THRESHOLD_ALERT[state];
  return `${categoryName}: ${alert.accessibilityState}, ${Math.round(percent * 100)}% of limit used`;
}

export type BudgetThresholdProgressProps = {
  categoryName: string;
  percent: number;
  state: BudgetThresholdState;
};

export function BudgetThresholdProgress({
  categoryName,
  percent,
  state,
}: BudgetThresholdProgressProps) {
  const colors = useColors();
  const tone = budgetProgressTone(state);
  const alert = state === "ok" ? null : BUDGET_THRESHOLD_ALERT[state];

  return (
    <>
      {alert ? (
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
          accessibilityRole="text"
        >
          <Ionicons
            name={alert.icon}
            size={16}
            color={state === "over" ? colors.error : colors.warning}
          />
          <Text
            className="text-muted"
            style={{ fontSize: Typography.caption.fontSize }}
          >
            {alert.label(percent)}
          </Text>
        </View>
      ) : null}
      <ProgressBar
        value={percent}
        tone={tone}
        accessibilityLabel={budgetProgressAccessibilityLabel(
          categoryName,
          state,
          percent,
        )}
      />
    </>
  );
}

import React from "react";
import { View, type ViewStyle } from "react-native";

import { useColors } from "@/hooks/use-colors";

export type ProgressBarTone = "neutral" | "warning" | "over";

export interface ProgressBarProps {
  /** Progress ratio (0..1+). Fill width clamps at 100%. */
  value: number;
  height?: number;
  trackColor?: string;
  fillColor?: string;
  tone?: ProgressBarTone;
  accessibilityLabel?: string;
  style?: ViewStyle;
}

export function ProgressBar({
  value,
  height = 6,
  trackColor,
  fillColor,
  tone = "neutral",
  accessibilityLabel,
  style,
}: ProgressBarProps) {
  const colors = useColors();
  const clamped = Math.max(0, value);
  const fillPercent = `${Math.min(clamped, 1) * 100}%`;
  const toneFill =
    tone === "over"
      ? colors.error
      : tone === "warning"
        ? colors.warning
        : colors.primary;
  const resolvedFill = fillColor ?? toneFill;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{
        min: 0,
        max: 100,
        now: Math.round(Math.min(clamped, 1) * 100),
      }}
      style={[
        {
          height,
          borderRadius: height / 2,
          backgroundColor: trackColor ?? colors.border,
          overflow: "hidden",
        },
        style,
      ]}
      testID="progress-bar-track"
    >
      <View
        testID="progress-bar-fill"
        style={{
          height: "100%",
          width: fillPercent as ViewStyle["width"],
          backgroundColor: resolvedFill,
          borderRadius: height / 2,
        }}
      />
    </View>
  );
}

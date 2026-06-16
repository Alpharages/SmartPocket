import React from "react";
import { View, Text } from "react-native";

import { useColors } from "@/hooks/use-colors";
import { readableTextOn } from "@/lib/_core/contrast";
import { Typography } from "@/lib/_core/theme";

export const ANOMALY_LABEL = "Above usual";

export type CategoryAnomalyBadgeProps = {
  categoryName: string;
};

export function CategoryAnomalyBadge({
  categoryName,
}: CategoryAnomalyBadgeProps) {
  const colors = useColors();
  const badgeTextColor = readableTextOn(colors.warning);

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${categoryName}, above usual spending this month`}
      className="px-2 py-0.5 rounded-full"
      style={{ backgroundColor: colors.warning + "22" }}
    >
      <Text
        className="font-semibold"
        style={{
          color: badgeTextColor,
          fontSize: Typography.micro.fontSize,
          lineHeight: Typography.micro.lineHeight,
        }}
      >
        {ANOMALY_LABEL}
      </Text>
    </View>
  );
}

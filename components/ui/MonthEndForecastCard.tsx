import React from "react";
import { View, Text, type ViewProps } from "react-native";

import { useColors } from "@/hooks/use-colors";
import { useCurrency } from "@/lib/currency-provider";
import {
  formatCurrency,
  formatCurrencyAccessibilityLabel,
  type CurrencyCode,
} from "@/lib/currency";
import { Skeleton } from "./Skeleton";

export interface MonthEndForecastCardProps extends ViewProps {
  projected: number;
  loading?: boolean;
}

export function buildMonthEndForecastAccessibilityLabel(
  projected: number,
  currency: CurrencyCode,
  isReady: boolean,
): string {
  if (!isReady) {
    return "Projected month-end expense, estimated amount loading";
  }

  return `Projected month-end expense, estimated ${formatCurrencyAccessibilityLabel(projected, currency, "negative")}`;
}

export function MonthEndForecastCard({
  projected,
  loading = false,
  style,
  ...viewProps
}: MonthEndForecastCardProps) {
  const colors = useColors();
  const { currency, isReady } = useCurrency();

  return (
    <View
      className="rounded-2xl p-4 gap-1"
      style={[
        {
          backgroundColor: colors.surface,
          shadowColor: colors.foreground,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 6,
          elevation: 2,
        },
        style,
      ]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={buildMonthEndForecastAccessibilityLabel(
        projected,
        currency,
        isReady,
      )}
      {...viewProps}
    >
      {loading ? (
        <Skeleton variant="line" width="40%" height={12} radius={6} />
      ) : (
        <Text className="text-xs text-muted font-medium">
          Projected month-end
        </Text>
      )}
      {loading ? (
        <Skeleton
          variant="line"
          width="60%"
          height={24}
          radius={8}
          className="mt-1"
        />
      ) : (
        <Text
          className="text-lg font-bold tabular-nums mt-xs"
          style={{ color: colors.error }}
        >
          {isReady
            ? formatCurrency(projected, currency, { sign: "negative" })
            : "—"}
        </Text>
      )}
      <Text className="text-xs text-muted mt-xs">
        Estimate based on this month&apos;s pace
      </Text>
    </View>
  );
}

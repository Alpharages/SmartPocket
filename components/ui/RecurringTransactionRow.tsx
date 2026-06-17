import React from "react";
import {
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useColors } from "@/hooks/use-colors";
import { useCurrency } from "@/lib/currency-provider";
import { formatSignedCurrency } from "@/lib/currency";
import { formatRecurrenceFrequency } from "@/lib/recurring-utils";
import type { RecurringTransaction } from "@/lib/expense-context";
import { Typography } from "@/lib/_core/theme";
import { CategoryToken } from "./CategoryToken";

export interface RecurringTransactionRowProps {
  rule: RecurringTransaction;
  categoryName: string;
  categoryColor: string;
  categoryIcon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

function formatNextRun(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function RecurringTransactionRow({
  rule,
  categoryName,
  categoryColor,
  categoryIcon,
  onPress,
  style,
}: RecurringTransactionRowProps) {
  const colors = useColors();
  const { currency } = useCurrency();
  const frequencyLabel = formatRecurrenceFrequency(
    rule.frequency,
    rule.interval,
  );
  const amountLabel = formatSignedCurrency(rule.amount, currency, rule.type);
  const nextRunLabel = formatNextRun(rule.nextRunDate);
  const statusLabel = rule.isActive ? "Active" : "Stopped";

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${categoryName}, ${frequencyLabel}, ${amountLabel}, next on ${nextRunLabel}, ${statusLabel}`}
      style={[
        {
          minHeight: 56,
          paddingHorizontal: 16,
          paddingVertical: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          opacity: rule.isActive ? 1 : 0.55,
        },
        style,
      ]}
    >
      <CategoryToken
        color={categoryColor}
        icon={categoryIcon}
        size="md"
        state={rule.isActive ? "default" : "disabled"}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          className="text-foreground font-semibold"
          style={{ fontSize: Typography.body.fontSize }}
          numberOfLines={1}
        >
          {categoryName}
        </Text>
        <Text
          className="text-muted"
          style={{ fontSize: Typography.caption.fontSize }}
        >
          {frequencyLabel} · Next {nextRunLabel}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <Text
          className="font-semibold"
          style={{
            fontSize: Typography.body.fontSize,
            color: rule.type === "income" ? colors.success : colors.error,
          }}
        >
          {amountLabel}
        </Text>
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 999,
            backgroundColor: rule.isActive
              ? colors.success + "18"
              : colors.muted + "22",
          }}
        >
          <Text
            style={{
              fontSize: Typography.caption.fontSize,
              color: rule.isActive ? colors.success : colors.muted,
              fontWeight: "600",
            }}
          >
            {statusLabel}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

RecurringTransactionRow.displayName = "RecurringTransactionRow";

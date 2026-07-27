import React, { useMemo } from "react";
import { View, Text, StyleSheet, type ViewProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useThemeTokens } from "@/lib/theme-provider";
import { useCurrency } from "@/lib/currency-provider";
import {
  formatCurrency,
  formatCurrencyAccessibilityLabel,
  type CurrencySign,
} from "@/lib/currency";
import { Radius, getElevationStyle } from "@/lib/_core/theme";
import { MAX_FONT_SCALE } from "@/lib/_core/a11y";
import { useAnimatedNumber } from "@/hooks/use-animated-number";
import { cn } from "@/lib/utils";
import { GlassSurface } from "./GlassSurface";
import { GradientHero } from "./GradientHero";
import { Skeleton } from "./Skeleton";

export interface BalanceHeroProps extends ViewProps {
  balance: number;
  income: number;
  expense: number;
  loading?: boolean;
}

function inferSign(amount: number): CurrencySign {
  if (amount > 0) return "positive";
  if (amount < 0) return "negative";
  return "neutral";
}

/** Composed sign+currency announcement for the balance and its income/expense split. */
function buildAccessibilityLabel(
  balance: number,
  income: number,
  expense: number,
  currency: ReturnType<typeof useCurrency>["currency"],
): string {
  const balanceLabel = formatCurrencyAccessibilityLabel(
    balance,
    currency,
    inferSign(balance),
  );
  const incomeLabel = formatCurrencyAccessibilityLabel(
    income,
    currency,
    "positive",
  );
  const expenseLabel = formatCurrencyAccessibilityLabel(
    expense,
    currency,
    "negative",
  );
  return `This Month, balance ${balanceLabel}. Income ${incomeLabel}. Expense ${expenseLabel}.`;
}

/**
 * BalanceHero — the signature, per-theme animated balance card (Story 12.4).
 * Composes GradientHero (backdrop) + GlassSurface (content panel) uniformly
 * across every theme — Aurora's frosted-glass-over-aurora, Obsidian's
 * gold-accented navy, and Spectrum's vivid gradient all fall out of each
 * theme's authored gradient/glass tokens (Story 12.2), never a theme-name
 * branch. GlassSurface's own AA-safe fallback (Story 12.3) covers the
 * foreground/success/error inks used here.
 */
export function BalanceHero({
  balance,
  income,
  expense,
  loading = false,
  className,
  style,
  ...viewProps
}: BalanceHeroProps) {
  // Inks come from the SAME active-theme source the surfaces use
  // (GradientHero/GlassSurface also read useThemeTokens) — never the
  // theme-agnostic useColors(), which is frozen to the default theme and
  // would leave text on Aurora's palette under Obsidian/Spectrum (AC1/AC5).
  const { colors } = useThemeTokens();
  const { currency, isReady } = useCurrency();
  const showLoading = loading || !isReady;

  const animatedBalance = useAnimatedNumber(showLoading ? 0 : balance);

  const displayBalance = useMemo(
    () => formatCurrency(animatedBalance, currency, { sign: "neutral" }),
    [animatedBalance, currency],
  );
  const displayIncome = useMemo(
    () => formatCurrency(income, currency, { sign: "positive" }),
    [income, currency],
  );
  const displayExpense = useMemo(
    () => formatCurrency(expense, currency, { sign: "negative" }),
    [expense, currency],
  );

  const accessibilityLabel = useMemo(
    () => buildAccessibilityLabel(balance, income, expense, currency),
    [balance, income, expense, currency],
  );

  return (
    <View
      className={cn("rounded-3xl overflow-hidden", className)}
      style={[getElevationStyle("lg", colors.primary), style]}
      // `accessible` groups the children into one element so screen readers
      // announce the composed sign+currency label instead of each Text node.
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      {...viewProps}
    >
      <GradientHero style={StyleSheet.absoluteFill} />
      <View className="p-5">
        <GlassSurface style={{ borderRadius: Radius.lg }} className="p-5">
          {showLoading ? (
            <View className="gap-3">
              <Skeleton variant="line" width="40%" height={16} />
              <Skeleton variant="line" width="70%" height={44} />
              <View className="flex-row gap-lg mt-sm">
                <Skeleton variant="line" width="30%" height={16} />
                <Skeleton variant="line" width="30%" height={16} />
              </View>
            </View>
          ) : (
            <>
              <Text
                className="text-sm font-medium"
                style={{ color: colors.muted }}
              >
                This Month
              </Text>
              <Text
                // `tabular-nums` supplies the tabular figures the balance
                // needs (AC2); hero scale mirrors StatCard's hero variant.
                className="mt-2 tracking-tight tabular-nums"
                style={{
                  fontSize: 42,
                  lineHeight: 48,
                  fontWeight: "700",
                  color: colors.foreground,
                }}
                maxFontSizeMultiplier={MAX_FONT_SCALE}
              >
                {displayBalance}
              </Text>
              <View className="flex-row gap-lg mt-lg">
                <View
                  className="flex-row items-center gap-xs"
                  testID="balance-hero-income"
                >
                  <Ionicons
                    name="arrow-down"
                    size={14}
                    color={colors.success}
                  />
                  <Text
                    className="text-sm font-semibold tabular-nums"
                    style={{ color: colors.success }}
                  >
                    {displayIncome}
                  </Text>
                </View>
                <View
                  className="flex-row items-center gap-xs"
                  testID="balance-hero-expense"
                >
                  <Ionicons name="arrow-up" size={14} color={colors.error} />
                  <Text
                    className="text-sm font-semibold tabular-nums"
                    style={{ color: colors.error }}
                  >
                    {displayExpense}
                  </Text>
                </View>
              </View>
            </>
          )}
        </GlassSurface>
      </View>
    </View>
  );
}

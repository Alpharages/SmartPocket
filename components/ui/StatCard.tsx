import React, { useMemo } from "react";
import { View, Text, type ViewProps } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { useColors } from "@/hooks/use-colors";
import { useCurrency } from "@/lib/currency-provider";
import {
  formatCurrency,
  formatCurrencyAccessibilityLabel,
  type CurrencyCode,
} from "@/lib/currency";
import { cn } from "@/lib/utils";

export type StatCardVariant = "hero" | "compact";
export type StatSign = "positive" | "negative" | "neutral";

export interface StatCardProps extends ViewProps {
  variant: StatCardVariant;
  label: string;
  amount: number;
  sign?: StatSign;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  accessibilityLabel?: string;
}

/** Centralised currency formatter — delegates to lib/currency.ts. */
function formatStatAmount(
  value: number,
  currency: ReturnType<typeof useCurrency>["currency"],
  sign: StatSign,
  variant: StatCardVariant,
): string {
  if (variant === "hero") {
    return formatCurrency(value, currency, { sign: "absolute" });
  }
  return formatCurrency(value, currency, { sign });
}

/** Resolve sign from amount when not explicitly provided. */
function inferSign(amount: number): StatSign {
  if (amount > 0) return "positive";
  if (amount < 0) return "negative";
  return "neutral";
}

/** Build a screen-reader friendly announcement using the active currency. */
function buildAccessibilityLabel(
  label: string,
  amount: number,
  sign: StatSign,
  currency: CurrencyCode,
): string {
  const amountLabel = formatCurrencyAccessibilityLabel(amount, currency, sign);
  return `${label}, ${amountLabel}`;
}

/** Color mapping for semantic signs. */
function signColor(
  sign: StatSign,
  colors: ReturnType<typeof useColors>,
): string {
  switch (sign) {
    case "positive":
      return colors.success;
    case "negative":
      return colors.error;
    case "neutral":
    default:
      return colors.primary;
  }
}

/** Icon mapping for semantic signs (compact variant). */
function signIcon(sign: StatSign): keyof typeof Ionicons.glyphMap {
  switch (sign) {
    case "positive":
      return "arrow-down";
    case "negative":
      return "arrow-up";
    case "neutral":
    default:
      return "wallet-outline";
  }
}

/** Simple pulsing skeleton using Reanimated 4.
 *  TODO: swap to <Skeleton> when Story 1.11 lands. */
function SkeletonPulse({
  className,
  style,
}: {
  className?: string;
  style?: React.ComponentProps<typeof View>["style"];
}) {
  const reducedMotion = useReducedMotion();
  // Hold a static mid-opacity when reduce-motion is on so the skeleton is still
  // visible but does not pulse — AC5 names "skeleton shimmer" as non-essential
  // animation that must be disabled. Mirrors the gate in the shared <Skeleton>.
  const opacity = useSharedValue(reducedMotion ? 0.6 : 1);

  React.useEffect(() => {
    if (reducedMotion) return;
    opacity.value = withRepeat(withTiming(0.4, { duration: 900 }), -1, true);
  }, [opacity, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      className={cn("rounded-xl bg-muted/30", className)}
      style={[style, animatedStyle]}
    />
  );
}

/**
 * StatCard — reusable financial figure primitive.
 *
 * Supports hero (gradient/solid primary surface, large balance) and compact
 * (surface card, icon avatar, caption label) variants with
 * positive/negative/neutral/loading-skeleton states.
 *
 * Architecture guardrails:
 * - Uses tokens from theme.config.js (spacing, radius, typography.number,
 *   elevation) and never hardcodes px/hex.
 * - Colors come from useColors() / constants/theme.ts.
 * - Semantic color mapping: income → success, expense → error, balance → primary.
 */
export function StatCard({
  variant,
  label,
  amount,
  sign: signProp,
  loading = false,
  icon,
  accessibilityLabel: accessibilityLabelProp,
  className,
  style,
  ...viewProps
}: StatCardProps) {
  const colors = useColors();
  const { currency, isReady } = useCurrency();
  const resolvedSign = signProp ?? inferSign(amount);
  const showLoading = loading || !isReady;
  const resolvedAccessibilityLabel =
    accessibilityLabelProp ??
    buildAccessibilityLabel(label, amount, resolvedSign, currency);

  const displayValue = useMemo(() => {
    return formatStatAmount(amount, currency, resolvedSign, variant);
  }, [variant, amount, resolvedSign, currency]);

  const semanticColor = signColor(resolvedSign, colors);
  const semanticIcon = icon ?? signIcon(resolvedSign);

  if (variant === "hero") {
    // Gradient decision: `expo-linear-gradient` is not a project dependency, so
    // the hero uses a solid `primary` surface (web-safe, zero new deps) as the
    // documented fallback the story permits. Swap to a gradient here if the
    // dependency is added later — the public API does not change.
    return (
      <View
        className={cn("rounded-3xl p-6 overflow-hidden", className)}
        style={[
          {
            backgroundColor: colors.primary,
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.25,
            shadowRadius: 16,
            elevation: 8,
          },
          style,
        ]}
        // `accessible` groups the children into one element so screen readers
        // announce the composed `accessibilityLabel` instead of reading each
        // child Text node separately (required for the sign + currency AC).
        accessible
        accessibilityRole="text"
        accessibilityLabel={resolvedAccessibilityLabel}
        {...viewProps}
      >
        {showLoading ? (
          <View className="gap-3">
            <SkeletonPulse className="h-4 w-1/3 rounded-md" />
            <SkeletonPulse className="h-12 w-2/3 rounded-lg" />
          </View>
        ) : (
          <>
            <Text className="text-white/70 text-sm font-medium">{label}</Text>
            <Text
              // `tabular-nums` (fontVariantNumeric utility) supplies tabular
              // figures — the `number` token's defining trait — without
              // re-literalizing the fontVariant array. The size is an
              // intentional hero scale above the `display` (36) type token.
              className="text-white mt-2 tracking-tight tabular-nums"
              style={{ fontSize: 42, lineHeight: 48, fontWeight: "700" }}
            >
              {displayValue}
            </Text>
          </>
        )}
      </View>
    );
  }

  // Compact variant
  return (
    <View
      className={cn("flex-1 rounded-2xl p-4 gap-2", className)}
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
      // See hero variant: `accessible` makes the composed label the single
      // announced element rather than the individual icon/label/amount nodes.
      accessible
      accessibilityRole="text"
      accessibilityLabel={resolvedAccessibilityLabel}
      {...viewProps}
    >
      {showLoading ? (
        <>
          <SkeletonPulse className="h-8 w-8 rounded-full" />
          <SkeletonPulse className="h-3 w-16 rounded-md mt-xs" />
          <SkeletonPulse className="h-6 w-24 rounded-md" />
        </>
      ) : (
        <>
          <View
            className="w-8 h-8 rounded-full items-center justify-center"
            style={{ backgroundColor: semanticColor + "14" }}
          >
            <Ionicons name={semanticIcon} size={16} color={semanticColor} />
          </View>
          <Text className="text-xs text-muted font-medium mt-xs">{label}</Text>
          <Text
            className="text-lg font-bold tabular-nums"
            style={{ color: semanticColor }}
          >
            {displayValue}
          </Text>
        </>
      )}
    </View>
  );
}

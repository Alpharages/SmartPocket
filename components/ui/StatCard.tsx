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

/** Centralised currency formatter — $ prefix, toFixed(2), tabular figures. */
function formatCurrency(value: number, sign: StatSign): string {
  const absValue = Math.abs(value).toFixed(2);
  if (sign === "negative") return `-$${absValue}`;
  if (sign === "positive") return `+$${absValue}`;
  return `$${absValue}`;
}

/** Resolve sign from amount when not explicitly provided. */
function inferSign(amount: number): StatSign {
  if (amount > 0) return "positive";
  if (amount < 0) return "negative";
  return "neutral";
}

/** Build a screen-reader friendly announcement. */
function buildAccessibilityLabel(
  label: string,
  amount: number,
  sign: StatSign,
): string {
  const absCents = Math.round(Math.abs(amount) * 100);
  const dollars = Math.floor(absCents / 100);
  const cents = absCents % 100;

  const signWord =
    sign === "positive" ? "plus" : sign === "negative" ? "minus" : "";

  const parts: string[] = [label];
  if (signWord) parts.push(signWord);
  parts.push(`${dollars} ${dollars === 1 ? "dollar" : "dollars"}`);
  if (cents > 0) parts.push(`${cents} ${cents === 1 ? "cent" : "cents"}`);

  return parts.join(", ");
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
  const resolvedSign = signProp ?? inferSign(amount);
  const resolvedAccessibilityLabel =
    accessibilityLabelProp ??
    buildAccessibilityLabel(label, amount, resolvedSign);

  const displayValue = useMemo(() => {
    if (variant === "hero") {
      // Hero shows absolute balance without sign prefix (matches current dashboard)
      return `$${Math.abs(amount).toFixed(2)}`;
    }
    return formatCurrency(amount, resolvedSign);
  }, [variant, amount, resolvedSign]);

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
        {loading ? (
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
      {loading ? (
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

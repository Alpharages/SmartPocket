import React, { useMemo } from "react";
import { View, Text, StyleSheet, type ViewProps } from "react-native";
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
import { Radius, getElevationStyle } from "@/lib/_core/theme";
import { resolveGradientInk } from "@/lib/_core/glass";
import { MAX_FONT_SCALE } from "@/lib/_core/a11y";
import { useThemeTokens } from "@/lib/theme-provider";
import { cn } from "@/lib/utils";
import { GlassSurface } from "./GlassSurface";
import { GradientHero } from "./GradientHero";

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

  // The hero ink must follow the theme gradient it sits on — a hardcoded
  // white fails AA on every light-variant gradient (obsidian light is ivory).
  // resolveGradientInk picks the ink whose worst stop clears 4.5:1, matching
  // the scrim GradientHero applies when neither ink can (Story 12.3, AC7).
  const theme = useThemeTokens();
  const heroInk = useMemo(
    () => resolveGradientInk(theme.gradient.colors).ink,
    [theme.gradient.colors],
  );

  if (variant === "hero") {
    return (
      <View
        className={cn("rounded-3xl overflow-hidden", className)}
        style={[getElevationStyle("lg", colors.primary), style]}
        // `accessible` groups the children into one element so screen readers
        // announce the composed `accessibilityLabel` instead of reading each
        // child Text node separately (required for the sign + currency AC).
        accessible
        accessibilityRole="text"
        accessibilityLabel={resolvedAccessibilityLabel}
        {...viewProps}
      >
        {/* Backdrop: active theme's hero gradient, opaque-primary fallback
         * when the gradient path is unavailable (Story 12.3, RDR-3). */}
        <GradientHero style={StyleSheet.absoluteFill} />
        <View className="p-6">
          {showLoading ? (
            <View className="gap-3">
              <SkeletonPulse className="h-4 w-1/3 rounded-md" />
              <SkeletonPulse className="h-12 w-2/3 rounded-lg" />
            </View>
          ) : (
            <>
              {/* Full-opacity ink for the label too — the old white/70 wash
               * dropped the 14px label below 4.5:1; visual hierarchy comes
               * from size/weight instead. 12.4's hero redesign can restyle. */}
              <Text className="text-sm font-medium" style={{ color: heroInk }}>
                {label}
              </Text>
              <Text
                // `tabular-nums` (fontVariantNumeric utility) supplies tabular
                // figures — the `number` token's defining trait — without
                // re-literalizing the fontVariant array. The size is an
                // intentional hero scale above the `display` (36) type token.
                className="mt-2 tracking-tight tabular-nums"
                style={{
                  fontSize: 42,
                  lineHeight: 48,
                  fontWeight: "700",
                  color: heroInk,
                }}
                maxFontSizeMultiplier={MAX_FONT_SCALE}
              >
                {displayValue}
              </Text>
            </>
          )}
        </View>
      </View>
    );
  }

  // Compact variant
  return (
    <View
      className={cn("flex-1 rounded-2xl overflow-hidden", className)}
      style={[getElevationStyle("sm", colors.foreground), style]}
      // See hero variant: `accessible` makes the composed label the single
      // announced element rather than the individual icon/label/amount nodes.
      accessible
      accessibilityRole="text"
      accessibilityLabel={resolvedAccessibilityLabel}
      {...viewProps}
    >
      {/* Backdrop: frosted glass surface, opaque AA-safe tint fallback when
       * blur is unsupported/disabled (Story 12.3, RDR-3). borderRadius keeps
       * the surface's 1px border stroke rounding with the card (rounded-2xl
       * = Radius.lg) instead of being clipped square at the corners. */}
      <GlassSurface
        style={[StyleSheet.absoluteFill, { borderRadius: Radius.lg }]}
      />
      <View className="p-4 gap-2">
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
            <Text className="text-xs text-muted font-medium mt-xs">
              {label}
            </Text>
            <Text
              className="text-lg font-bold tabular-nums"
              style={{ color: semanticColor }}
              maxFontSizeMultiplier={MAX_FONT_SCALE}
            >
              {displayValue}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

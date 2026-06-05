import React, { forwardRef, useCallback, useMemo } from "react";
import {
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { cn } from "@/lib/utils";
import {
  CATEGORY_DEFAULT_COLOR,
  Radius,
  Spacing,
  Typography,
  resolveCategoryColor,
} from "@/constants/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type CategoryTokenRef = React.ComponentRef<typeof AnimatedPressable>;

export type CategoryTokenState = "default" | "selected" | "disabled";

export type CategoryTokenSize = "sm" | "md" | "lg";

export interface CategoryTokenProps {
  /** Category display name (also used for accessibilityLabel unless overridden). */
  name: string;
  /** Stored category color (light-mode hex). The dark-mode variant is resolved internally. */
  color: string;
  /** Ionicons glyph name. Falls back to "tag" if invalid/absent. */
  icon?: string;
  /** Visual + interaction state. */
  state?: CategoryTokenState;
  /** Optional press handler (omitted → non-interactive display mode). */
  onPress?: () => void;
  /** Size variant. */
  size?: CategoryTokenSize;
  /** Render the category name as a visible label beside the icon (picker/chip mode). */
  showLabel?: boolean;
  /** Accessibility role for the interactive token. Use "radio" inside a radiogroup. */
  role?: "button" | "radio";
  /** Override the default accessibilityLabel (defaults to `name`). */
  accessibilityLabel?: string;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

// NFR-5 / WCAG 2.1 AA: every interactive token must present at least a 44pt touch target.
const MIN_TOUCH_TARGET = 44;

// The category color palette (theme.config.js) is tuned for ≥ 4.5:1 contrast
// against white, so white is the guaranteed-legible foreground for the selected
// checkmark drawn on the category color.
const ON_COLOR_FOREGROUND = "#FFFFFF";

const SIZE_TOKENS: Record<
  CategoryTokenSize,
  {
    container: { width: number; height: number; borderRadius: number };
    icon: number;
  }
> = {
  sm: {
    container: { width: 32, height: 32, borderRadius: Radius.sm },
    icon: 14,
  },
  md: {
    container: { width: 40, height: 40, borderRadius: Radius.md },
    icon: 18,
  },
  lg: {
    container: { width: 48, height: 48, borderRadius: Radius.lg },
    icon: 22,
  },
};

const BADGE_SIZE = Spacing.lg; // 16

/** True when `color` is a 6-digit hex string (`#RRGGBB`). */
function isHex6(color: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(color);
}

/** Append a 2-digit hex alpha to a 6-digit hex color (no-op for other formats). */
function withAlpha(color: string, alphaHex: string): string {
  return isHex6(color) ? `${color}${alphaHex}` : color;
}

/**
 * CategoryToken — reusable category identity primitive.
 *
 * Renders a category's color + icon as a single token with `default`,
 * `selected` (visible ring + checkmark, not fill-only), and `disabled`
 * states. Color is never the sole signal — the selected state adds a ring and
 * a checkmark, and interactive tokens expose an accessibilityLabel of the
 * category name + selected state. Pass `showLabel` to render the name as
 * visible text (picker/chip mode).
 *
 * Architecture guardrails:
 * - Consumes radius/spacing tokens from theme.config.js — no hardcoded px.
 * - Resolves the dark-mode color variant internally (single source of truth),
 *   so every caller passes the stored light-mode hex and stays consistent.
 * - Presentational only — screens pass data in via props.
 * - NFR-5: ≥44pt touch target, screen-reader labels, color never sole signal.
 */
export const CategoryToken = forwardRef<CategoryTokenRef, CategoryTokenProps>(
  (
    {
      name,
      color,
      icon,
      state = "default",
      onPress,
      size = "md",
      showLabel = false,
      role = "button",
      accessibilityLabel,
      className,
      style,
    },
    ref,
  ) => {
    const colors = useColors();
    const scheme = (useColorScheme() ?? "light") as "light" | "dark";
    const reducedMotion = useReducedMotion();
    const scale = useSharedValue(1);

    const isSelected = state === "selected";
    const isDisabled = state === "disabled";
    const hasPressHandler = Boolean(onPress);

    // Guard against malformed/empty DB-sourced colors, then resolve the
    // scheme-appropriate variant in one place so all callers stay consistent.
    const resolvedColor = useMemo(() => {
      const safe = isHex6(color) ? color : CATEGORY_DEFAULT_COLOR;
      return resolveCategoryColor(safe, scheme);
    }, [color, scheme]);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const handlePressIn = useCallback(() => {
      if (isDisabled || !hasPressHandler) return;
      if (!reducedMotion) {
        scale.value = withTiming(0.97, { duration: 120 });
      }
      if (process.env.EXPO_OS === "ios") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    }, [isDisabled, hasPressHandler, reducedMotion, scale]);

    const handlePressOut = useCallback(() => {
      if (!reducedMotion) {
        scale.value = withTiming(1, { duration: 120 });
      }
    }, [reducedMotion, scale]);

    const handlePress = useCallback(() => {
      if (!isDisabled) {
        onPress?.();
      }
    }, [isDisabled, onPress]);

    // `icon` is DB-sourced (categories.icon) — a stale/typo'd name renders a
    // blank glyph. Validate against the runtime map and fall back.
    const iconName = useMemo(() => {
      if (!icon) return "tag";
      return icon in Ionicons.glyphMap ? icon : "tag";
    }, [icon]);

    const sizeTokens = SIZE_TOKENS[size];

    const containerStyle = useMemo<ViewStyle>(() => {
      const ring: ViewStyle = isSelected
        ? { borderWidth: 2.5, borderColor: resolvedColor }
        : { borderWidth: 1, borderColor: colors.border };

      const base: ViewStyle = {
        height: sizeTokens.container.height,
        borderRadius: showLabel ? Radius.md : sizeTokens.container.borderRadius,
        backgroundColor: isSelected
          ? colors.surface
          : withAlpha(resolvedColor, "14"),
        opacity: isDisabled ? 0.4 : 1,
        alignItems: "center",
        justifyContent: "center",
        ...ring,
      };

      if (showLabel) {
        return {
          ...base,
          flexDirection: "row",
          alignSelf: "flex-start",
          gap: Spacing.sm,
          paddingHorizontal: Spacing.md,
        };
      }

      return { ...base, width: sizeTokens.container.width };
    }, [isSelected, isDisabled, resolvedColor, colors, sizeTokens, showLabel]);

    const resolvedAccessibilityLabel =
      accessibilityLabel ?? `${name}${isSelected ? ", selected" : ""}`;

    const accessibilityState = useMemo(
      () =>
        role === "radio"
          ? { checked: isSelected, disabled: isDisabled }
          : { selected: isSelected, disabled: isDisabled },
      [role, isSelected, isDisabled],
    );

    // Shared inner content — single source so the display and interactive
    // branches can never drift.
    const tokenBody = (
      <View
        className="items-center justify-center relative"
        style={containerStyle}
      >
        <Ionicons
          name={iconName as keyof typeof Ionicons.glyphMap}
          size={sizeTokens.icon}
          color={isDisabled ? colors.muted : resolvedColor}
        />
        {showLabel && (
          <Text
            testID="category-token-name"
            numberOfLines={1}
            style={{
              fontSize: Typography.label.fontSize,
              fontWeight: "600",
              color: isDisabled ? colors.muted : colors.foreground,
            }}
          >
            {name}
          </Text>
        )}
        {isSelected && (
          <View
            className="absolute items-center justify-center"
            style={{
              top: -BADGE_SIZE / 4,
              right: -BADGE_SIZE / 4,
              width: BADGE_SIZE,
              height: BADGE_SIZE,
              borderRadius: BADGE_SIZE / 2,
              backgroundColor: resolvedColor,
            }}
          >
            <Ionicons name="checkmark" size={12} color={ON_COLOR_FOREGROUND} />
          </View>
        )}
      </View>
    );

    // Display mode: decorative avatar. The name is carried by adjacent text in
    // the consuming row, so the token is hidden from assistive tech to avoid a
    // duplicate announcement (NFR-5).
    if (!hasPressHandler) {
      return (
        <View
          testID="category-token"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className={cn(className)}
          style={style}
        >
          {tokenBody}
        </View>
      );
    }

    // Interactive: wrap in an AnimatedPressable with a ≥44pt hit target. The
    // visual token may be smaller (sm/md/lg) — the wrapper guarantees the touch
    // target never drops below 44pt (NFR-5).
    return (
      <AnimatedPressable
        ref={ref}
        accessibilityRole={role}
        accessibilityLabel={resolvedAccessibilityLabel}
        accessibilityState={accessibilityState}
        disabled={isDisabled}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        hitSlop={{
          top: Spacing.sm,
          bottom: Spacing.sm,
          left: Spacing.sm,
          right: Spacing.sm,
        }}
        className={cn("items-center justify-center", className)}
        style={[
          { minWidth: MIN_TOUCH_TARGET, minHeight: MIN_TOUCH_TARGET },
          animatedStyle,
          style,
        ]}
      >
        {tokenBody}
      </AnimatedPressable>
    );
  },
);

CategoryToken.displayName = "CategoryToken";

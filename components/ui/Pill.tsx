import React, { forwardRef, useCallback, useMemo } from "react";
import {
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/use-colors";
import { readableTextOn } from "@/lib/_core/contrast";
import { cn } from "@/lib/utils";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PillRef = React.ComponentRef<typeof AnimatedPressable>;

export type PillProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  count?: number;
  leftIcon?: React.ReactNode;
  accessibilityLabel?: string;
  /**
   * Screen-reader role for the control. Defaults to "button" (multi-select /
   * standalone). Pass "radio" when the pill is one option in a single-select
   * group so it matches a `radiogroup` container and announces mutually
   * exclusive selection via `checked` rather than `selected`.
   */
  role?: "button" | "radio";
  className?: string;
  style?: StyleProp<ViewStyle>;
};

// NFR-5 / WCAG 2.1 AA: every pill must present at least a 44pt touch target.
const MIN_TOUCH_TARGET = 44;

export const Pill = forwardRef<PillRef, PillProps>(
  (
    {
      label,
      selected = false,
      onPress,
      disabled = false,
      count,
      leftIcon,
      accessibilityLabel,
      role = "button",
      className,
      style,
      ...pressableProps
    },
    ref,
  ) => {
    const colors = useColors();
    const reducedMotion = useReducedMotion();
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const handlePressIn = useCallback(() => {
      if (disabled) return;
      if (!reducedMotion) {
        scale.value = withTiming(0.97, { duration: 120 });
      }
      if (process.env.EXPO_OS === "ios") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }, [disabled, reducedMotion, scale]);

    const handlePressOut = useCallback(() => {
      if (!reducedMotion) {
        scale.value = withTiming(1, { duration: 120 });
      }
    }, [reducedMotion, scale]);

    const handlePress = useCallback(() => {
      if (!disabled) {
        onPress?.();
      }
    }, [disabled, onPress]);

    const { containerStyle, textColor, badgeStyle } = useMemo(() => {
      const active = selected && !disabled;
      const bg = active ? colors.primary : colors.surface;
      // Don't hardcode white on the active fill: dark-mode primary (#818CF8) is
      // a light tint that fails AA behind white. Resolve the readable ink per
      // fill so the selected chip/segment meets AC1 on both themes.
      const fg = active ? readableTextOn(colors.primary) : colors.foreground;
      const border = active ? undefined : colors.border;

      return {
        // Geometry (flex layout, full radius, padding) lives on the `style`
        // prop, NOT in `className`: NativeWind className is remapped off the
        // Animated(Pressable) on web, so `rounded-full px-4 py-2.5` silently
        // drops there (only style-prop values like `minHeight` survive).
        containerStyle: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: bg,
          borderColor: border,
          borderWidth: border ? 1 : 0,
          borderRadius: 9999, // full radius (rounded-full)
          paddingHorizontal: 16, // px-4
          paddingVertical: 10, // py-2.5
          minHeight: MIN_TOUCH_TARGET,
          opacity: disabled ? 0.5 : 1,
        } as ViewStyle,
        textColor: disabled ? colors.muted : fg,
        badgeStyle: {
          backgroundColor: active ? "rgba(255,255,255,0.25)" : colors.border,
        } as ViewStyle,
      };
    }, [selected, disabled, colors]);

    // A "radio" announces selection via `checked` (single-select exclusivity);
    // a "button" uses `selected` (toggle). Match the state key to the role.
    const accessibilityState = useMemo(
      () =>
        role === "radio"
          ? { checked: selected, disabled }
          : { selected, disabled },
      [role, selected, disabled],
    );

    const resolvedAccessibilityLabel =
      accessibilityLabel ?? label;

    // count={0} is treated as "hide badge" — only show for positive counts
    const showCount = typeof count === "number" && count > 0;

    return (
      <AnimatedPressable
        ref={ref}
        accessibilityRole={role}
        accessibilityLabel={resolvedAccessibilityLabel}
        accessibilityState={accessibilityState}
        disabled={disabled}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        className={cn(
          "flex-row items-center justify-center rounded-full px-4 py-2.5",
          className,
        )}
        style={[containerStyle, animatedStyle, style]}
        {...pressableProps}
      >
        {leftIcon && (
          <View className="mr-1.5">{leftIcon}</View>
        )}
        <Text
          className="text-sm font-semibold"
          style={{ color: textColor }}
          numberOfLines={1}
        >
          {label}
        </Text>
        {showCount && (
          <View
            className="ml-1.5 min-w-[20px] items-center justify-center rounded-full px-1 py-0.5"
            style={badgeStyle}
          >
            <Text
              className="text-xs font-bold"
              style={{ color: textColor }}
            >
              {count}
            </Text>
          </View>
        )}
      </AnimatedPressable>
    );
  },
);

Pill.displayName = "Pill";

import React, {
  forwardRef,
  useCallback,
  useMemo,
} from "react";
import {
  ActivityIndicator,
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
import { cn } from "@/lib/utils";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ButtonRef = React.ComponentRef<typeof AnimatedPressable>;

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "destructive"
  | "income"
  | "icon-only";

export type ButtonSize = "sm" | "md" | "lg";

type BaseButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
};

type LabelButtonProps = BaseButtonProps & {
  variant?: Exclude<ButtonVariant, "icon-only">;
  label: string;
  accessibilityLabel?: string;
};

type IconOnlyButtonProps = BaseButtonProps & {
  variant?: "icon-only";
  label?: never;
  accessibilityLabel: string;
};

export type ButtonProps = LabelButtonProps | IconOnlyButtonProps;

const SIZE_HEIGHT: Record<ButtonSize, number> = {
  sm: 36,
  md: 44,
  lg: 48,
};

const SIZE_ICON_ONLY_DIMENSION: Record<ButtonSize, number> = {
  sm: 36,
  md: 44,
  lg: 48,
};

const SIZE_PADDING: Record<ButtonSize, { px: number; py: number }> = {
  sm: { px: 12, py: 8 },
  md: { px: 16, py: 12 },
  lg: { px: 20, py: 14 },
};

const SIZE_TEXT: Record<ButtonSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-base",
};

export const Button = forwardRef<ButtonRef, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      label,
      onPress,
      disabled = false,
      loading = false,
      leftIcon,
      rightIcon,
      accessibilityLabel,
      className,
      style,
      ...pressableProps
    },
    ref,
  ) => {
    const colors = useColors();
    const reducedMotion = useReducedMotion();
    const scale = useSharedValue(1);

    // Dev-time guard: icon-only must have accessibilityLabel
    if (__DEV__ && variant === "icon-only" && !accessibilityLabel) {
      console.warn(
        "[Button] `accessibilityLabel` is required for icon-only buttons.",
      );
    }

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const handlePressIn = useCallback(() => {
      if (disabled || loading) return;
      if (!reducedMotion) {
        scale.value = withTiming(0.97, { duration: 120 });
      }
      if (process.env.EXPO_OS === "ios") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }, [disabled, loading, reducedMotion, scale]);

    const handlePressOut = useCallback(() => {
      if (!reducedMotion) {
        scale.value = withTiming(1, { duration: 120 });
      }
    }, [reducedMotion, scale]);

    const handlePress = useCallback(() => {
      if (!disabled && !loading) {
        onPress?.();
      }
    }, [disabled, loading, onPress]);

    const {
      containerStyle,
      textColor,
      isIconOnly,
    } = useMemo(() => {
      const iconOnly = variant === "icon-only";
      let bg: string;
      let border: string | undefined;
      let fg: string;

      switch (variant) {
        case "primary":
          bg = colors.primary;
          fg = "#FFFFFF";
          break;
        case "secondary":
          bg = colors.surface;
          border = colors.border;
          fg = colors.foreground;
          break;
        case "ghost":
          bg = "transparent";
          fg = colors.foreground;
          break;
        case "destructive":
          bg = colors.error;
          fg = "#FFFFFF";
          break;
        case "income":
          bg = colors.success;
          fg = "#FFFFFF";
          break;
        case "icon-only":
          bg = colors.primary;
          fg = "#FFFFFF";
          break;
      }

      const dim = iconOnly ? SIZE_ICON_ONLY_DIMENSION[size] : undefined;
      const pad = iconOnly ? undefined : SIZE_PADDING[size];

      return {
        containerStyle: {
          backgroundColor: bg,
          borderColor: border,
          borderWidth: border ? 1 : 0,
          minHeight: SIZE_HEIGHT[size],
          height: dim,
          width: dim,
          paddingHorizontal: pad?.px,
          paddingVertical: pad?.py,
          opacity: disabled || loading ? 0.5 : 1,
        } as ViewStyle,
        textColor: fg,
        isIconOnly: iconOnly,
      };
    }, [variant, size, colors, disabled, loading]);

    // `disabled` reflects the explicit prop; `loading` is surfaced as `busy`
    // so assistive tech announces a working button as busy rather than
    // disabled (interaction is still blocked via `handlePress` + the
    // Pressable `disabled` below).
    const accessibilityState = useMemo(
      () => ({
        disabled,
        busy: loading,
      }),
      [disabled, loading],
    );

    const resolvedAccessibilityLabel =
      accessibilityLabel ?? (typeof label === "string" ? label : undefined);

    const content = isIconOnly ? (
      <>
        {loading ? (
          <ActivityIndicator size="small" color={textColor} />
        ) : (
          leftIcon ?? rightIcon
        )}
      </>
    ) : (
      <>
        {leftIcon && !loading && (
          <View className="mr-2">{leftIcon}</View>
        )}
        {loading ? (
          <ActivityIndicator
            size="small"
            color={textColor}
            className="mr-2"
          />
        ) : (
          <Text
            className={cn(
              "font-semibold",
              SIZE_TEXT[size],
            )}
            style={{ color: textColor }}
            numberOfLines={1}
          >
            {label}
          </Text>
        )}
        {rightIcon && !loading && (
          <View className="ml-2">{rightIcon}</View>
        )}
      </>
    );

    return (
      <AnimatedPressable
        ref={ref}
        accessibilityRole="button"
        accessibilityLabel={resolvedAccessibilityLabel}
        accessibilityState={accessibilityState}
        disabled={disabled || loading}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        className={cn(
          "flex-row items-center justify-center rounded-md",
          isIconOnly && "rounded-lg",
          className,
        )}
        style={[containerStyle, animatedStyle, style]}
        {...pressableProps}
      >
        {content}
      </AnimatedPressable>
    );
  },
);

Button.displayName = "Button";

import React, { useEffect } from "react";
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { useColors } from "@/hooks/use-colors";
import { Motion, Radius, Spacing, Typography } from "@/lib/_core/theme";

export type ToastType = "success" | "error" | "info";

export type ToastItem = {
  id: string;
  type: ToastType;
  message: string;
  /** Auto-dismiss timeout in ms. Defaults to 3500. */
  duration?: number;
};

export type ToastProps = ToastItem & {
  onDismiss: (id: string) => void;
};

const ANIM_DURATION = Motion.sheet.durationMs;
const MIN_TOUCH = 44;
const DEFAULT_DURATION_MS = 3500;

const ICON_MAP: Record<
  ToastType,
  React.ComponentProps<typeof Ionicons>["name"]
> = {
  success: "checkmark-circle",
  error: "close-circle",
  info: "information-circle",
};

export function Toast({
  id,
  type,
  message,
  duration = DEFAULT_DURATION_MS,
  onDismiss,
}: ToastProps) {
  const colors = useColors();
  const reducedMotion = useReducedMotion();

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-8);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  // Announce to iOS screen readers imperatively on mount (Android handled by accessibilityLiveRegion).
  useEffect(() => {
    if (Platform.OS === "ios") {
      AccessibilityInfo.announceForAccessibility(message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const animDur = reducedMotion ? 0 : ANIM_DURATION;

    opacity.value = withTiming(1, {
      duration: animDur,
      easing: Easing.out(Easing.cubic),
    });
    translateY.value = withTiming(0, {
      duration: animDur,
      easing: Easing.out(Easing.cubic),
    });

    let exitTimer: ReturnType<typeof setTimeout>;
    const timer = setTimeout(() => {
      const outDur = reducedMotion ? 0 : ANIM_DURATION;
      opacity.value = withTiming(0, { duration: outDur });
      translateY.value = withTiming(-8, { duration: outDur });
      exitTimer = setTimeout(() => onDismiss(id), outDur);
    }, duration);

    return () => {
      clearTimeout(timer);
      clearTimeout(exitTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const iconColor =
    type === "success"
      ? colors.success
      : type === "error"
        ? colors.error
        : colors.primary;

  return (
    <Animated.View
      accessible
      accessibilityLiveRegion="polite"
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.surface,
          borderRadius: Radius.md,
          paddingVertical: Spacing.sm,
          paddingHorizontal: Spacing.md,
          marginBottom: Spacing.sm,
          ...(Platform.OS === "web"
            ? {
                boxShadow: `0 2px 8px color-mix(in srgb, ${colors.overlay} 12%, transparent)`,
              }
            : {
                shadowColor: colors.overlay,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.12,
                shadowRadius: 8,
                elevation: 4,
              }),
        },
        animStyle,
      ]}
      testID={`toast-${id}`}
    >
      {/* Icon — decorative, hidden from a11y tree since message carries the meaning */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ marginRight: Spacing.sm }}
        testID={`toast-${id}-icon`}
      >
        <Ionicons name={ICON_MAP[type]} size={20} color={iconColor} />
      </View>

      <Text
        style={{
          flex: 1,
          color: colors.foreground,
          fontSize: Typography.label.fontSize,
          lineHeight: Typography.label.lineHeight,
        }}
        numberOfLines={3}
        testID={`toast-${id}-message`}
      >
        {message}
      </Text>

      <Pressable
        onPress={() => onDismiss(id)}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        hitSlop={8}
        style={{
          minWidth: MIN_TOUCH,
          minHeight: MIN_TOUCH,
          alignItems: "center",
          justifyContent: "center",
          marginLeft: Spacing.xs,
        }}
        testID={`toast-${id}-dismiss`}
      >
        <Ionicons name="close" size={18} color={colors.muted} />
      </Pressable>
    </Animated.View>
  );
}

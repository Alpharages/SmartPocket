import React, { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useColors } from "@/hooks/use-colors";
import { Radius } from "@/lib/_core/theme";

export type SkeletonVariant = "line" | "circle" | "rect";

export type SkeletonProps = {
  variant?: SkeletonVariant;
  width?: number | `${number}%`;
  height?: number;
  /** Override the border radius (defaults derive from variant). */
  radius?: number;
  className?: string;
  style?: StyleProp<ViewStyle>;
  /**
   * When provided the container becomes a single accessible element
   * and announces this label to assistive technology.
   * Defaults to hidden from the accessibility tree.
   */
  accessibilityLabel?: string;
  testID?: string;
};

type VariantDefaults = {
  width: number | `${number}%`;
  height: number;
  borderRadius: number;
};

const VARIANT_DEFAULTS: Record<SkeletonVariant, VariantDefaults> = {
  line: { width: "100%", height: 16, borderRadius: Radius.sm },
  circle: { width: 40, height: 40, borderRadius: Radius.full },
  rect: { width: "100%", height: 120, borderRadius: Radius.md },
};

const SHIMMER_DURATION_MS = 900;

export function Skeleton({
  variant = "line",
  width,
  height,
  radius,
  className,
  style,
  accessibilityLabel,
  testID = "skeleton",
}: SkeletonProps) {
  const colors = useColors();
  const reducedMotion = useReducedMotion();
  const [nativeReduceMotion, setNativeReduceMotion] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (alive) setNativeReduceMotion(v);
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setNativeReduceMotion,
    );
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  const motionDisabled = reducedMotion || nativeReduceMotion;

  const shimmer = useSharedValue(1);

  useEffect(() => {
    if (motionDisabled) {
      // Direct assignment cancels any running animation in real Reanimated.
      shimmer.value = 1;
      return;
    }
    shimmer.value = withRepeat(
      withTiming(0.4, {
        duration: SHIMMER_DURATION_MS,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );
  }, [motionDisabled, shimmer]);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: shimmer.value,
  }));

  const defaults = VARIANT_DEFAULTS[variant];
  const resolvedWidth = width ?? defaults.width;
  const resolvedHeight = height ?? defaults.height;
  const resolvedRadius = radius ?? defaults.borderRadius;

  // When an accessibilityLabel is supplied, expose the container as a single
  // accessible element (Lore: accessible={true} is required on non-Pressable
  // Views that carry a composed accessibilityLabel).
  const a11yProps = accessibilityLabel
    ? {
        accessible: true as const,
        accessibilityLabel,
      }
    : {
        accessibilityElementsHidden: true as const,
        importantForAccessibility: "no-hide-descendants" as const,
      };

  return (
    <View
      testID={testID}
      className={className}
      {...a11yProps}
      style={[
        {
          width: resolvedWidth,
          height: resolvedHeight,
          borderRadius: resolvedRadius,
          overflow: "hidden",
          backgroundColor: colors.border,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: colors.muted,
            borderRadius: resolvedRadius,
          },
          shimmerStyle,
        ]}
        testID={`${testID}-shimmer`}
      />
    </View>
  );
}

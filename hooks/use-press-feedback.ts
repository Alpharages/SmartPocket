import { useCallback } from "react";
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { Motion } from "@/lib/_core/theme";

const PRESS_SCALE = Motion.press.scale;
const PRESS_IN_DURATION = Motion.press.durationMs;
const PRESS_OUT_DURATION = Motion.press.durationMs;

export type PressFeedbackOptions = {
  /** Scale factor on press. Default 0.97. */
  scale?: number;
  /** Duration of the press-in animation in ms. Default 120. */
  pressInDuration?: number;
  /** Duration of the press-out animation in ms. Default 120. */
  pressOutDuration?: number;
  /** Haptic style. Default Light. Pass null to disable haptics. */
  hapticStyle?: Haptics.ImpactFeedbackStyle | null;
  /** Whether to skip haptics even on iOS. Default false. */
  disableHaptic?: boolean;
};

export type PressFeedbackResult = {
  animatedStyle: ReturnType<typeof useAnimatedStyle>;
  onPressIn: () => void;
  onPressOut: () => void;
};

/**
 * Reusable press feedback hook providing scale-down animation + haptic.
 * Honors reduced-motion: no scale animation when reduced-motion is enabled.
 * Haptics fire only on iOS (`process.env.EXPO_OS === 'ios'`).
 */
export function usePressFeedback(
  options: PressFeedbackOptions = {},
): PressFeedbackResult {
  const {
    scale = PRESS_SCALE,
    pressInDuration = PRESS_IN_DURATION,
    pressOutDuration = PRESS_OUT_DURATION,
    hapticStyle = Haptics.ImpactFeedbackStyle.Light,
    disableHaptic = false,
  } = options;

  const reducedMotion = useReducedMotion();
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * (1 - scale) }],
  }));

  const onPressIn = useCallback(() => {
    if (!reducedMotion) {
      pressed.value = withTiming(1, { duration: pressInDuration });
    }
    if (
      !disableHaptic &&
      hapticStyle !== null &&
      process.env.EXPO_OS === "ios"
    ) {
      Haptics.impactAsync(hapticStyle);
    }
  }, [reducedMotion, pressed, pressInDuration, disableHaptic, hapticStyle]);

  const onPressOut = useCallback(() => {
    if (!reducedMotion) {
      pressed.value = withTiming(0, { duration: pressOutDuration });
    }
  }, [reducedMotion, pressed, pressOutDuration]);

  return { animatedStyle, onPressIn, onPressOut };
}

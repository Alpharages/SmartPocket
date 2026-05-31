import React from "react";

export const useSharedValue = <T>(initial: T) => {
  const value = { value: initial };
  return value;
};

export const useAnimatedStyle = (fn: any) => {
  try {
    return fn();
  } catch {
    return {};
  }
};

export const withTiming = (toValue: any, _config?: any) => toValue;
export const withSpring = (toValue: any, _config?: any) => toValue;
// The real reanimated hook returns a boolean, not a SharedValue.
export const useReducedMotion = () => false;

export const Easing = {
  linear: (t: number) => t,
  ease: (t: number) => t,
  quad: (t: number) => t * t,
  cubic: (t: number) => t * t * t,
};

export const interpolate = (
  value: number,
  _inputRange: number[],
  outputRange: number[],
) => {
  return outputRange[0] ?? 0;
};

export const runOnJS = (fn: any) => fn;
export const runOnUI = (fn: any) => fn;

export const createAnimatedPropAdapter = () => ({});

const AnimatedView = React.forwardRef<any, any>(({ children, ...props }, ref) =>
  React.createElement("div", { ref, ...props }, children),
);
(AnimatedView as any).displayName = "Animated.View";

const AnimatedText = React.forwardRef<any, any>(({ children, ...props }, ref) =>
  React.createElement("span", { ref, ...props }, children),
);
(AnimatedText as any).displayName = "Animated.Text";

const Animated = {
  View: AnimatedView,
  Text: AnimatedText,
  createAnimatedComponent: (Component: any) => Component,
};

export { Animated };
export default Animated;

export function useWorkletCallback<T extends (...args: any[]) => any>(
  callback: T,
): T {
  return callback;
}

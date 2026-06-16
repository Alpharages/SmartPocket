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

export const withTiming = (
  toValue: any,
  _config?: any,
  callback?: (finished: boolean) => void,
) => {
  callback?.(true);
  return toValue;
};
export const withSpring = (toValue: any, _config?: any) => toValue;
export const withRepeat = (
  animation: any,
  _numberOfReps?: number,
  _reverse?: boolean,
) => animation;
// The real reanimated hook returns a boolean, not a SharedValue.
export const useReducedMotion = () => false;

export const Easing = {
  linear: (t: number) => t,
  ease: (t: number) => t,
  quad: (t: number) => t * t,
  cubic: (t: number) => t * t * t,
  out: (fn: (t: number) => number) => fn,
  in: (fn: (t: number) => number) => fn,
  inOut: (fn: (t: number) => number) => fn,
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

// Layout animation stubs — return a chainable no-op object so
// entering/exiting props on Animated.View don't throw in tests.
function makeLayoutAnimation() {
  const obj: Record<string, () => typeof obj> = {};
  const methods = [
    "duration",
    "delay",
    "springify",
    "damping",
    "stiffness",
    "mass",
    "withCallback",
    "withInitialValues",
    "randomDelay",
    "easing",
  ];
  for (const m of methods) {
    obj[m] = () => obj;
  }
  return obj;
}

export const FadeIn = makeLayoutAnimation();
export const FadeInDown = makeLayoutAnimation();
export const FadeInUp = makeLayoutAnimation();
export const FadeOut = makeLayoutAnimation();
export const FadeOutDown = makeLayoutAnimation();
export const FadeOutUp = makeLayoutAnimation();
export const SlideInUp = makeLayoutAnimation();
export const SlideOutDown = makeLayoutAnimation();
export const Layout = makeLayoutAnimation();
export const ZoomIn = makeLayoutAnimation();
export const ZoomOut = makeLayoutAnimation();

const AnimatedView = React.forwardRef<any, any>(function AnimatedViewFn(
  { children, ...props },
  ref,
) {
  return React.createElement("div", { ref, ...props }, children);
});
(AnimatedView as any).displayName = "Animated.View";

const AnimatedText = React.forwardRef<any, any>(function AnimatedTextFn(
  { children, ...props },
  ref,
) {
  return React.createElement("span", { ref, ...props }, children);
});
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

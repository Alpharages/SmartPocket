import type { ComponentProps } from "react";
import Reanimated from "react-native-reanimated";

/**
 * Web build of the motion primitives — entering animations are disabled.
 *
 * Reanimated's web implementation mounts an element that has an `entering`
 * animation with `visibility: hidden`, and only restores it from that
 * element's `onanimationstart` handler
 * (`layoutReanimation/web/componentUtils.js`). If the CSS animation never
 * starts, nothing ever restores visibility — and for the built-in builders
 * (`FadeInUp`, `FadeInDown`, …) the timeout safety net is deliberately skipped,
 * because it is guarded by `if (!(animationName in Animations))`.
 *
 * That is exactly what happens to a screen mounted during a full page load: the
 * animation is never started, so the content stays laid out at the right
 * geometry and permanently invisible. Measured on `/loan/1`: 54 elements still
 * `visibility: hidden`, `opacity: 1`, correct height, 108 seconds after load.
 * It broke every deep link, refresh and bookmarked URL on web, and made the
 * Loans module unusable.
 *
 * Dropping `entering`/`exiting` on web costs a fade-in that react-native-web
 * renders inconsistently anyway. Native keeps the animations untouched.
 */

type AnimatedViewProps = ComponentProps<typeof Reanimated.View>;

function View(props: AnimatedViewProps) {
  const rest = { ...props };
  delete rest.entering;
  delete rest.exiting;
  return <Reanimated.View {...rest} />;
}

View.displayName = "Animated.View";

export const Animated = { ...Reanimated, View };

// Re-exported so call sites keep compiling; the builders are simply never
// handed to Reanimated on web.
export { FadeInDown, FadeInUp } from "react-native-reanimated";

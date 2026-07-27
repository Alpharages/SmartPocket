// NativeWind interop for components it doesn't recognize by default.
// react-native-reanimated wraps RN components, so NativeWind needs explicit
// cssInterop registration to map `className` -> `style` on them.
import { cssInterop } from "nativewind";
import { Pressable } from "react-native";
import Animated from "react-native-reanimated";

cssInterop(Animated.View, { className: "style" });
cssInterop(Animated.ScrollView, { className: "style" });
cssInterop(Animated.Text, { className: "style" });
cssInterop(Animated.Image, { className: "style" });

// Re-enable className on Pressable. Screens rely on className for layout
// (sizing, rounding, flex). Pass interaction styles through `style` as usual.
cssInterop(Pressable, { className: "style" });

// QA report SP-057: `Animated.createAnimatedComponent(Pressable)` is a
// *different* component from `Pressable`, and it had no interop registration —
// so `className` was silently dropped on every component built on it. Button
// and TransactionRow both are, which meant their
// `flex-row items-center justify-center` and `flex-1` classes never applied:
// buttons rendered as columns (icon stacked above label, 20-26px too tall) and
// paired buttons stopped sharing their row. Register the animated wrapper once
// here, and export it so call sites use this instance rather than creating
// their own unregistered one.
export const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
cssInterop(AnimatedPressable, { className: "style" });

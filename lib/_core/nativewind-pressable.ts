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

// SP-D02: do NOT `cssInterop` this one.
//
// The interop rebuilds the target prop from scratch — it collects the incoming
// `style` as "inline rules" and re-assigns them onto a fresh props object
// (react-native-css-interop `applyRules` -> `assignToTarget`). On the animated
// Pressable that round-trip loses the result: measured on a physical device,
// every Button rendered 40px tall with no background or padding (below its own
// inline `minHeight: 44`), the tab bar stopped distributing, and the FAB went
// full-width.
//
// The registration is also unnecessary — `className` still reaches the inner
// Pressable, which *is* registered above. Measured both ways on device: with
// the registration a primary Button is 145x40px, without it 304x92px, and
// class-based layout (`flex-1`, `mt-*`) still applies.
//
// (This replaces an SP-057 note claiming className was dropped here. That
// diagnosis was wrong; class layout works without the interop.)
export const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

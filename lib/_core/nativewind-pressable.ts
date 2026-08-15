// NativeWind interop for components it doesn't recognize by default.
import { cssInterop } from "nativewind";
import { Pressable } from "react-native";
import Animated from "react-native-reanimated";

// SP-100: the Reanimated wrappers are deliberately NOT registered.
//
// `cssInterop` rebuilds the target prop from scratch (react-native-css-interop
// `applyRules` -> `assignToTarget`). On a Reanimated wrapper whose `style` is an
// array ending in a `useAnimatedStyle` object, that round-trip keeps the
// animated entry and DROPS the plain inline objects beside it — so every
// `Animated.View` that styles itself through `style` and passes no `className`
// silently lost its own styling. Measured on a physical device: the Sheet panel
// rendered with no `backgroundColor`, no `borderTopRadius` and no
// `paddingHorizontal`, so all 20 overlays painted transparently over the screen
// behind them with their content flush to x=0, while `translateY` still
// animated. Same failure mode SP-D02 found on the animated Pressable below.
//
// The registrations are also unnecessary: Reanimated renders the underlying
// primitive with `createElement(View, props)`, which goes through NativeWind's
// patched jsx runtime, and `View`/`ScrollView`/`Text`/`Image` are registered
// there by default — so `className` keeps working on `Animated.*` without them.
//
//   cssInterop(Animated.View, { className: "style" });      // <- do not
//   cssInterop(Animated.ScrollView, { className: "style" }); // <- do not
//   cssInterop(Animated.Text, { className: "style" });       // <- do not
//   cssInterop(Animated.Image, { className: "style" });      // <- do not

// Re-enable className on Pressable. Screens rely on className for layout
// (sizing, rounding, flex). Pass interaction styles through `style` as usual.
// This one is the bare primitive, not a Reanimated wrapper, so it is safe.
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

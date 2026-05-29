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

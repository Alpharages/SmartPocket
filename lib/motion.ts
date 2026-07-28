/**
 * Motion primitives.
 *
 * Screens import `Animated` and the entering builders from here rather than
 * straight from `react-native-reanimated`, so that the web build can drop
 * layout-entering animations in one place — see `motion.web.tsx` for why.
 *
 * On native this is a plain re-export: nothing changes.
 */
export {
  default as Animated,
  FadeInDown,
  FadeInUp,
} from "react-native-reanimated";

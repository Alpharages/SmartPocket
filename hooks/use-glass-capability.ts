import { useSyncExternalStore } from "react";
import { useReducedMotion } from "react-native-reanimated";

import {
  canUseBlur,
  getGlobalDisableBlur,
  subscribeGlobalDisableBlur,
} from "@/lib/_core/glass";
import {
  getDeviceTier,
  getDeviceTierOverride,
  shouldDegradeEffects,
  subscribeDeviceTierOverride,
} from "@/lib/_core/perf";

export type GlassCapability = {
  /** Whether `GlassSurface` may render a real backdrop blur here. */
  blurEnabled: boolean;
  /** Whether `GradientHero` should render its full gradient stops or drop to
   * the cheaper solid-color fallback — independent GPU-cost signal from
   * blur, but degrades on the same triggers. */
  gradientComplexity: "full" | "reduced";
};

/** Whether `GlassSurface`/`GradientHero` may render their full-cost effects
 * here — see `lib/_core/glass.ts#canUseBlur` for the platform/perf-toggle
 * rules and `lib/_core/perf.ts#shouldDegradeEffects` for the device-tier
 * budget gate (Story 12.11). Subscribes to the global disable-blur toggle so
 * mounted surfaces re-render and drop to the fallback when it flips
 * mid-session. Also degrades automatically on a `low` device tier or when
 * the OS reduced-motion flag is on — both signal a preference for cheaper
 * rendering. Per-call `disableBlur` still wins locally over every automatic
 * signal, mirroring `canUseBlur`'s existing override contract. */
export function useGlassCapability(disableBlur?: boolean): GlassCapability {
  useSyncExternalStore(
    subscribeGlobalDisableBlur,
    getGlobalDisableBlur,
    getGlobalDisableBlur,
  );
  // Re-render when the dev-only tier override (app/dev/theme-lab.tsx) flips,
  // so surfaces mounted elsewhere reflect the forced tier immediately.
  useSyncExternalStore(
    subscribeDeviceTierOverride,
    getDeviceTierOverride,
    getDeviceTierOverride,
  );
  const reducedMotion = useReducedMotion();
  const degrade = shouldDegradeEffects(getDeviceTier()) || reducedMotion;
  return {
    blurEnabled: canUseBlur(disableBlur ?? (degrade || undefined)),
    gradientComplexity: degrade ? "reduced" : "full",
  };
}

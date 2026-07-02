import { useSyncExternalStore } from "react";

import {
  canUseBlur,
  getGlobalDisableBlur,
  subscribeGlobalDisableBlur,
} from "@/lib/_core/glass";

/** Whether `GlassSurface` may render a real backdrop blur here — see
 * `lib/_core/glass.ts#canUseBlur` for the platform/perf-toggle rules.
 * Subscribes to the 12.11 global toggle so mounted surfaces re-render and
 * drop to the opaque fallback when it flips mid-session. */
export function useGlassCapability(disableBlur?: boolean): boolean {
  useSyncExternalStore(
    subscribeGlobalDisableBlur,
    getGlobalDisableBlur,
    getGlobalDisableBlur,
  );
  return canUseBlur(disableBlur);
}

import { useEffect, useState } from "react";
import {
  Easing,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Motion } from "@/lib/_core/theme";

const DEFAULT_DURATION_MS = Motion.countUp.durationMs;
/** ~60fps mirror of the UI-thread shared value into JS state — Reanimated has
 * no first-class "animated numeric text" primitive, so Text content is kept
 * in sync by polling `.value` rather than driving a native style. */
const SYNC_INTERVAL_MS = 16;

/**
 * Count-up hook (Story 12.4): tweens a displayed number from its previous
 * value toward `target` via Reanimated's withTiming, snapping instantly when
 * the OS reduced-motion flag is set (mirrors the gate already used by
 * StatCard's SkeletonPulse). Starting `target` at 0 while data is loading and
 * swapping to the real value once it arrives (the caller's responsibility)
 * naturally produces the "first paint animates 0 → value" behavior — the
 * hook itself just always tweens toward whatever `target` currently is.
 */
export function useAnimatedNumber(
  target: number,
  durationMs: number = DEFAULT_DURATION_MS,
): number {
  const reducedMotion = useReducedMotion();
  const shared = useSharedValue(reducedMotion ? target : 0);
  const [display, setDisplay] = useState(shared.value);

  useEffect(() => {
    if (reducedMotion) {
      shared.value = target;
      setDisplay(target);
      return;
    }
    shared.value = withTiming(target, {
      duration: durationMs,
      easing: Easing.out(Easing.cubic),
    });
  }, [target, reducedMotion, durationMs, shared]);

  useEffect(() => {
    if (reducedMotion) return;
    // Poll the UI-thread value into JS state, but stop once the tween has
    // landed on `target` — otherwise the timer fires every frame for the
    // component's whole lifetime. Retargeting re-runs this effect (target is
    // a dep), which restarts polling toward the new value.
    const id = setInterval(() => {
      const next = shared.value;
      setDisplay(next);
      if (next === target) clearInterval(id);
    }, SYNC_INTERVAL_MS);
    return () => clearInterval(id);
  }, [reducedMotion, shared, target]);

  return display;
}

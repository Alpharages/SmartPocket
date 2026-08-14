import { Dimensions, PixelRatio, Platform } from "react-native";

/** Target sustained frame rate for scrolling and theme switching (AC1). */
export const TARGET_FPS = 60;

/** Cold-start budget, ms — app launch to dashboard interactive (NFR-2). */
export const COLD_START_BUDGET_MS = 3000;

/** Per-screen budget, ms — navigation to interactive after data load (NFR-2). */
export const SCREEN_INTERACTIVE_BUDGET_MS = 1000;

export type DeviceTier = "high" | "mid" | "low";

// Physical-pixel-count bands (logical width * height * pixelRatio^2). No
// `expo-device` dependency: the story's own guidance allows a
// Dimensions/pixel-ratio heuristic instead, and this app has no existing
// `expo-device` install to lean on model/year lookups.
const LOW_TIER_MAX_PIXELS = 1_200_000;
const MID_TIER_MAX_PIXELS = 2_400_000;

let tierOverride: DeviceTier | null = null;
const tierOverrideListeners = new Set<() => void>();

/** Dev-only tier override (app/dev/theme-lab.tsx) — forces `getDeviceTier()`
 * to a fixed value so the low-cost fallback path can be exercised without a
 * physical constrained device. `null` restores the real heuristic. */
export function setDeviceTierOverride(tier: DeviceTier | null): void {
  if (tier === tierOverride) return;
  tierOverride = tier;
  for (const listener of tierOverrideListeners) listener();
}

/** Snapshot read for `useSyncExternalStore`. */
export function getDeviceTierOverride(): DeviceTier | null {
  return tierOverride;
}

/** Subscribe to tier-override flips — `useSyncExternalStore` contract. */
export function subscribeDeviceTierOverride(listener: () => void): () => void {
  tierOverrideListeners.add(listener);
  return () => tierOverrideListeners.delete(listener);
}

/**
 * Classifies the current device into a coarse perf tier from screen
 * resolution + pixel density. Pure/React-free so it's directly unit-testable
 * and callable from both hooks and dev-tooling (theme-lab tier override).
 */
export function getDeviceTier(): DeviceTier {
  if (tierOverride) return tierOverride;

  // SP-092: the pixel-count heuristic assumes "few pixels" means "weak GPU",
  // which holds for phones and inverts on desktop — a 1366x768 non-retina
  // laptop lands at 1,049,088 px, under the low band, and silently lost the
  // hero gradient, while a 1440x900 machine of similar power kept it. A
  // desktop pushing fewer pixels has *less* work to do, not more, so the
  // band test only applies where it was calibrated: touch devices.
  if (!isTouchPlatform()) return "high";

  const { width, height } = Dimensions.get("window");
  const pixelRatio = PixelRatio.get();
  const physicalPixels = width * height * pixelRatio * pixelRatio;
  if (physicalPixels < LOW_TIER_MAX_PIXELS) return "low";
  if (physicalPixels < MID_TIER_MAX_PIXELS) return "mid";
  return "high";
}

/** iOS/Android natively, and a coarse-pointer browser on the web (a phone or
 * tablet), which is exactly where the pixel-count bands were calibrated. */
function isTouchPlatform(): boolean {
  if (Platform.OS === "ios" || Platform.OS === "android") return true;
  if (Platform.OS !== "web") return false;
  const mm = (
    globalThis as typeof globalThis & {
      matchMedia?: (q: string) => { matches: boolean };
    }
  ).matchMedia;
  // No matchMedia (SSR/test): treat as desktop rather than degrading blindly.
  return mm ? mm("(pointer: coarse)").matches : false;
}

/** Whether the low-cost fallback (reduced effects / no blur) should engage
 * for the given tier — only the `low` tier is constrained enough to force it
 * (AC3); `mid`/`high` keep the full-fidelity render path. */
export function shouldDegradeEffects(tier: DeviceTier): boolean {
  return tier === "low";
}

import { canUseBlur } from "@/lib/_core/glass";

/** Whether `GlassSurface` may render a real backdrop blur here — see
 * `lib/_core/glass.ts#canUseBlur` for the platform/perf-toggle rules. */
export function useGlassCapability(disableBlur?: boolean): boolean {
  return canUseBlur(disableBlur);
}

import { useEffect, useRef, useState } from "react";

/**
 * Dev-only FPS sampler — counts animation frames and reports a rolling
 * once-per-second average. Story 12.11 dev instrumentation
 * (`app/dev/theme-lab.tsx`) only; real frame-rate validation is manual
 * device profiling (`docs/performance-checklist.md`) since jsdom/node test
 * environments can't produce meaningful frame timing.
 */
export function useFpsMonitor(enabled: boolean = true): number {
  const [fps, setFps] = useState(0);
  const frameCountRef = useRef(0);
  const sampleStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let rafId: number;
    let cancelled = false;

    const loop = (time: number) => {
      if (cancelled) return;
      if (sampleStartRef.current === null) {
        sampleStartRef.current = time;
      }
      frameCountRef.current += 1;
      const elapsed = time - sampleStartRef.current;
      if (elapsed >= 1000) {
        setFps(Math.round((frameCountRef.current * 1000) / elapsed));
        frameCountRef.current = 0;
        sampleStartRef.current = time;
      }
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [enabled]);

  return fps;
}

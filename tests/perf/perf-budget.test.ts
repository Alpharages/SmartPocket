import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TestRenderer, { act } from "react-test-renderer";
import { Dimensions, PixelRatio } from "react-native";

import {
  TARGET_FPS,
  COLD_START_BUDGET_MS,
  SCREEN_INTERACTIVE_BUDGET_MS,
  getDeviceTier,
  getDeviceTierOverride,
  setDeviceTierOverride,
  shouldDegradeEffects,
  subscribeDeviceTierOverride,
} from "@/lib/_core/perf";
import { setGlobalDisableBlur } from "@/lib/_core/glass";
import { useGlassCapability } from "@/hooks/use-glass-capability";

const { getReducedMotionFlag, setReducedMotionFlag } = vi.hoisted(() => {
  let flag = false;
  return {
    getReducedMotionFlag: () => flag,
    setReducedMotionFlag: (value: boolean) => {
      flag = value;
    },
  };
});

vi.mock("react-native-reanimated", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useReducedMotion: () => getReducedMotionFlag(),
  };
});

function mockDeviceResolution(width: number, height: number, scale: number) {
  vi.spyOn(Dimensions, "get").mockReturnValue({
    width,
    height,
    scale,
    fontScale: 1,
  });
  vi.spyOn(PixelRatio, "get").mockReturnValue(scale);
}

function renderCapabilityHook(disableBlur?: boolean) {
  let result!: ReturnType<typeof useGlassCapability>;
  function Harness() {
    result = useGlassCapability(disableBlur);
    return null;
  }
  act(() => {
    TestRenderer.create(React.createElement(Harness));
  });
  return () => result;
}

afterEach(() => {
  vi.restoreAllMocks();
  setGlobalDisableBlur(false);
  setReducedMotionFlag(false);
  setDeviceTierOverride(null);
});

describe("perf budgets", () => {
  it("defines the NFR-2 budget constants", () => {
    expect(TARGET_FPS).toBe(60);
    expect(COLD_START_BUDGET_MS).toBe(3000);
    expect(SCREEN_INTERACTIVE_BUDGET_MS).toBe(1000);
  });
});

describe("getDeviceTier", () => {
  it("classifies a small, low-density screen as 'low'", () => {
    mockDeviceResolution(320, 480, 1.5);
    expect(getDeviceTier()).toBe("low");
  });

  it("classifies a mid-range phone resolution as 'mid'", () => {
    mockDeviceResolution(375, 812, 2);
    expect(getDeviceTier()).toBe("mid");
  });

  it("classifies a high-density flagship resolution as 'high'", () => {
    mockDeviceResolution(430, 932, 3);
    expect(getDeviceTier()).toBe("high");
  });
});

describe("shouldDegradeEffects", () => {
  it("forces the fallback only on the 'low' tier", () => {
    expect(shouldDegradeEffects("low")).toBe(true);
    expect(shouldDegradeEffects("mid")).toBe(false);
    expect(shouldDegradeEffects("high")).toBe(false);
  });
});

describe("device tier override (app/dev/theme-lab.tsx)", () => {
  it("forces getDeviceTier() to the overridden value regardless of resolution", () => {
    mockDeviceResolution(430, 932, 3); // would otherwise classify as 'high'
    setDeviceTierOverride("low");
    expect(getDeviceTier()).toBe("low");
    expect(getDeviceTierOverride()).toBe("low");
  });

  it("restores the real heuristic when the override is cleared", () => {
    mockDeviceResolution(430, 932, 3);
    setDeviceTierOverride("low");
    setDeviceTierOverride(null);
    expect(getDeviceTier()).toBe("high");
    expect(getDeviceTierOverride()).toBeNull();
  });

  it("notifies subscribers on flips and stops after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeDeviceTierOverride(listener);
    setDeviceTierOverride("low");
    expect(listener).toHaveBeenCalledTimes(1);
    setDeviceTierOverride("low"); // no-op: unchanged value must not notify
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    setDeviceTierOverride(null);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("useGlassCapability", () => {
  it("disables blur and reduces gradient complexity on a low device tier", () => {
    mockDeviceResolution(320, 480, 1.5);
    const getResult = renderCapabilityHook();
    expect(getResult().blurEnabled).toBe(false);
    expect(getResult().gradientComplexity).toBe("reduced");
  });

  it("keeps full blur/gradient on a high tier with reduced-motion off", () => {
    mockDeviceResolution(430, 932, 3);
    const getResult = renderCapabilityHook();
    expect(getResult().blurEnabled).toBe(true);
    expect(getResult().gradientComplexity).toBe("full");
  });

  it("degrades on a high device tier when OS reduced-motion is on", () => {
    mockDeviceResolution(430, 932, 3);
    setReducedMotionFlag(true);
    const getResult = renderCapabilityHook();
    expect(getResult().blurEnabled).toBe(false);
    expect(getResult().gradientComplexity).toBe("reduced");
  });

  it("lets the per-instance disableBlur prop override the tier decision", () => {
    mockDeviceResolution(430, 932, 3);
    const getResult = renderCapabilityHook(true);
    expect(getResult().blurEnabled).toBe(false);
  });

  it("lets the per-instance disableBlur=false override a low-tier degrade", () => {
    mockDeviceResolution(320, 480, 1.5);
    const getResult = renderCapabilityHook(false);
    expect(getResult().blurEnabled).toBe(true);
  });
});

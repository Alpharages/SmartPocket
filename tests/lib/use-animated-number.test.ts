import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";
import { Text } from "react-native";
import * as Reanimated from "react-native-reanimated";

import { useAnimatedNumber } from "@/hooks/use-animated-number";

function Harness({
  target,
  durationMs,
}: {
  target: number;
  durationMs?: number;
}) {
  const value = useAnimatedNumber(target, durationMs);
  return React.createElement(Text, { testID: "value" }, String(value));
}

let renderer: ReactTestRenderer | null = null;

function render(ui: React.ReactElement): ReactTestInstance {
  act(() => {
    renderer = TestRenderer.create(ui);
  });
  return renderer!.root;
}

function textOf(node: ReactTestInstance | string): string {
  if (typeof node === "string") return node;
  return (node.children ?? [])
    .map((c) => (typeof c === "string" ? c : textOf(c)))
    .join("");
}

function valueOf(root: ReactTestInstance): string {
  return textOf(root.findByProps({ testID: "value" }));
}

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = null;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("useAnimatedNumber", () => {
  it("starts the first paint at 0 before ticking toward the target", () => {
    vi.useFakeTimers();
    const root = render(React.createElement(Harness, { target: 500 }));
    expect(valueOf(root)).toBe("0");
  });

  it("converges to the target once the sync interval ticks", () => {
    vi.useFakeTimers();
    const root = render(React.createElement(Harness, { target: 500 }));
    act(() => {
      vi.advanceTimersByTime(32);
    });
    expect(valueOf(root)).toBe("500");
  });

  it("retargets to a new value on prop change without stacking the old tween", () => {
    vi.useFakeTimers();
    const root = render(React.createElement(Harness, { target: 100 }));
    act(() => {
      vi.advanceTimersByTime(32);
    });
    expect(valueOf(root)).toBe("100");

    act(() => {
      renderer!.update(React.createElement(Harness, { target: 250 }));
    });
    act(() => {
      vi.advanceTimersByTime(32);
    });
    expect(valueOf(root)).toBe("250");
  });

  it("snaps instantly to the target with no count-up when reduced motion is on", () => {
    vi.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    const root = render(React.createElement(Harness, { target: 750 }));
    // No fake timers advanced — value must already be the final target.
    expect(valueOf(root)).toBe("750");
  });
});

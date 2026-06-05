import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import TestRenderer, { act, type ReactTestInstance } from "react-test-renderer";

import { usePressFeedback } from "@/hooks/use-press-feedback";

// The reanimated and expo-haptics mocks in __mocks__/ are already configured
// by vitest's alias setup (see vitest.config.ts).

let renderer: TestRenderer.ReactTestRenderer | null = null;

function render(ui: React.ReactElement): ReactTestInstance {
  act(() => {
    renderer = TestRenderer.create(ui);
  });
  return renderer!.root;
}

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = null;
});

function TestComponent({ opts }: { opts?: Parameters<typeof usePressFeedback>[0] }) {
  const result = usePressFeedback(opts);
  return React.createElement("div", {
    "data-animated-style": JSON.stringify(result.animatedStyle),
    "data-has-onpressin": typeof result.onPressIn === "function",
    "data-has-onpressout": typeof result.onPressOut === "function",
  });
}

describe("usePressFeedback", () => {
  it("returns animatedStyle, onPressIn, and onPressOut", () => {
    const root = render(React.createElement(TestComponent));
    const node = root.find((n) => n.type === "div");
    expect(node).toBeTruthy();
    expect(node.props["data-animated-style"]).toContain("transform");
    expect(node.props["data-has-onpressin"]).toBe(true);
    expect(node.props["data-has-onpressout"]).toBe(true);
  });

  it("accepts custom scale option", () => {
    const root = render(React.createElement(TestComponent, { opts: { scale: 0.95 } }));
    const node = root.find((n) => n.type === "div");
    expect(node).toBeTruthy();
  });

  it("onPressIn and onPressOut do not throw when invoked", () => {
    let captured: ReturnType<typeof usePressFeedback> | null = null;

    function Capture() {
      captured = usePressFeedback();
      return React.createElement("div");
    }

    render(React.createElement(Capture));
    expect(captured).not.toBeNull();
    expect(() => captured!.onPressIn()).not.toThrow();
    expect(() => captured!.onPressOut()).not.toThrow();
  });
});

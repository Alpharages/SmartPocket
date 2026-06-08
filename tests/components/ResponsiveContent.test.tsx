import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import TestRenderer, { act, type ReactTestRenderer } from "react-test-renderer";
import { Platform } from "react-native";

import { ResponsiveContent } from "@/components/responsive-content";

let renderer: ReactTestRenderer | null = null;

function render(ui: React.ReactElement) {
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
  Platform.OS = "ios";
});

describe("ResponsiveContent", () => {
  it("centers and constrains content on web", () => {
    Platform.OS = "web";
    const root = render(
      <ResponsiveContent maxWidth={960} testID="responsive-content">
        <></>
      </ResponsiveContent>,
    );

    const content = root.find(
      (node) =>
        node.props.testID === "responsive-content" &&
        String(node.type) === "View",
    );
    const style = Array.isArray(content.props.style)
      ? Object.assign({}, ...content.props.style.filter(Boolean))
      : content.props.style;

    expect(style.width).toBe("100%");
    expect(style.maxWidth).toBe(960);
    expect(style.alignSelf).toBe("center");
  });

  it("leaves native layouts unconstrained", () => {
    const root = render(
      <ResponsiveContent testID="responsive-content">
        <></>
      </ResponsiveContent>,
    );

    const content = root.find(
      (node) =>
        node.props.testID === "responsive-content" &&
        String(node.type) === "View",
    );
    expect(content.props.style).toEqual([undefined, undefined]);
  });
});

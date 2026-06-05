import React from "react";
import { describe, expect, it, vi } from "vitest";
import TestRenderer, { act } from "react-test-renderer";

import { TwoPaneLayout } from "@/components/ui/TwoPaneLayout";

const mockColors = {
  primary: "#4F46E5",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  foreground: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  success: "#059669",
  warning: "#D97706",
  error: "#DC2626",
  accent: "#DB2777",
  secondary: "#7C3AED",
  text: "#111827",
  tint: "#4F46E5",
  icon: "#6B7280",
  tabIconDefault: "#6B7280",
  tabIconSelected: "#4F46E5",
};

vi.mock("@/hooks/use-colors", () => ({
  useColors: () => mockColors,
}));

vi.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

describe("TwoPaneLayout", () => {
  it("renders master pane at base breakpoint", () => {
    let renderer: TestRenderer.ReactTestRenderer | null = null;
    act(() => {
      renderer = TestRenderer.create(
        <TwoPaneLayout
          master={<Text testID="master">Master Content</Text>}
          detail={<Text testID="detail">Detail Content</Text>}
        />,
      );
    });

    const root = renderer!.root;
    expect(root.findByProps({ testID: "master" })).toBeTruthy();

    // Detail should be present in tree but wrapped in a hidden container
    const detailPane = root.find(
      (n) =>
        typeof n.props.className === "string" &&
        n.props.className.includes("hidden") &&
        n.props.className.includes("lg:flex"),
    );
    expect(detailPane).toBeTruthy();

    act(() => renderer?.unmount());
  });

  it("renders both master and detail when detailVisible is true", () => {
    let renderer: TestRenderer.ReactTestRenderer | null = null;
    act(() => {
      renderer = TestRenderer.create(
        <TwoPaneLayout
          master={<Text testID="master">Master Content</Text>}
          detail={<Text testID="detail">Detail Content</Text>}
          detailVisible
        />,
      );
    });

    const root = renderer!.root;
    expect(root.findByProps({ testID: "master" })).toBeTruthy();

    // Detail pane should be present and not have lg:hidden
    const detailPane = root.find(
      (n) =>
        typeof n.props.className === "string" &&
        n.props.className.includes("lg:flex") &&
        !n.props.className.includes("lg:hidden"),
    );
    expect(detailPane).toBeTruthy();

    act(() => renderer?.unmount());
  });

  it("applies containerClassName to outer container", () => {
    let renderer: TestRenderer.ReactTestRenderer | null = null;
    act(() => {
      renderer = TestRenderer.create(
        <TwoPaneLayout
          master={<Text testID="master">Master</Text>}
          detail={<Text testID="detail">Detail</Text>}
          containerClassName="custom-container"
        />,
      );
    });

    const root = renderer!.root;
    const outer = root.find(
      (n) =>
        typeof n.props.className === "string" &&
        n.props.className.includes("custom-container"),
    );
    expect(outer).toBeTruthy();

    act(() => renderer?.unmount());
  });

  it("applies masterClassName to master pane", () => {
    let renderer: TestRenderer.ReactTestRenderer | null = null;
    act(() => {
      renderer = TestRenderer.create(
        <TwoPaneLayout
          master={<Text testID="master">Master</Text>}
          detail={<Text testID="detail">Detail</Text>}
          masterClassName="custom-master"
        />,
      );
    });

    const root = renderer!.root;
    const masterPane = root.find(
      (n) =>
        typeof n.props.className === "string" &&
        n.props.className.includes("custom-master"),
    );
    expect(masterPane).toBeTruthy();

    act(() => renderer?.unmount());
  });

  it("applies detailClassName to detail pane", () => {
    let renderer: TestRenderer.ReactTestRenderer | null = null;
    act(() => {
      renderer = TestRenderer.create(
        <TwoPaneLayout
          master={<Text testID="master">Master</Text>}
          detail={<Text testID="detail">Detail</Text>}
          detailClassName="custom-detail"
        />,
      );
    });

    const root = renderer!.root;
    const detailPane = root.find(
      (n) =>
        typeof n.props.className === "string" &&
        n.props.className.includes("custom-detail"),
    );
    expect(detailPane).toBeTruthy();

    act(() => renderer?.unmount());
  });

  it("hides detail pane when detailVisible is false", () => {
    let renderer: TestRenderer.ReactTestRenderer | null = null;
    act(() => {
      renderer = TestRenderer.create(
        <TwoPaneLayout
          master={<Text testID="master">Master</Text>}
          detail={<Text testID="detail">Detail</Text>}
          detailVisible={false}
        />,
      );
    });

    const root = renderer!.root;
    // Find detail pane by checking className includes lg:hidden
    const detailPane = root.find(
      (n) =>
        typeof n.props.className === "string" &&
        n.props.className.includes("lg:hidden"),
    );
    expect(detailPane).toBeTruthy();

    act(() => renderer?.unmount());
  });

  it("renders with custom className", () => {
    let renderer: TestRenderer.ReactTestRenderer | null = null;
    act(() => {
      renderer = TestRenderer.create(
        <TwoPaneLayout
          master={<Text testID="master">Master</Text>}
          detail={<Text testID="detail">Detail</Text>}
          className="my-layout"
        />,
      );
    });

    const root = renderer!.root;
    const outer = root.find(
      (n) =>
        typeof n.props.className === "string" &&
        n.props.className.includes("my-layout"),
    );
    expect(outer).toBeTruthy();

    act(() => renderer?.unmount());
  });
});

// Re-export Text for use in tests above
function Text({ testID, children }: { testID?: string; children: React.ReactNode }) {
  return React.createElement("Text", { testID }, children);
}

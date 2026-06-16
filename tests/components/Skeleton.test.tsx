import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";

import { Skeleton } from "@/components/ui/Skeleton";
import * as Reanimated from "react-native-reanimated";
import { Radius } from "@/lib/_core/theme";

vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({
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
    overlay: "#000000",
    text: "#111827",
    tint: "#4F46E5",
    icon: "#6B7280",
    tabIconDefault: "#6B7280",
    tabIconSelected: "#4F46E5",
  }),
}));

// ---------------------------------------------------------------------------
// Sheet-test pattern: keep renderer ref, access .root OUTSIDE act()
// ---------------------------------------------------------------------------

let renderer: ReactTestRenderer | null = null;

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

function findByTestId(root: ReactTestInstance, id: string): ReactTestInstance {
  return root.find((n) => n.props.testID === id);
}

function flatStyle(node: ReactTestInstance): Record<string, unknown> {
  return Array.isArray(node.props.style)
    ? Object.assign({}, ...node.props.style.filter(Boolean))
    : (node.props.style ?? {});
}

describe("Skeleton", () => {
  it("AC6: renders the line variant by default", () => {
    const root = render(<Skeleton />);
    expect(findByTestId(root, "skeleton")).toBeDefined();
  });

  it("AC6: circle variant has full border radius", () => {
    // Do NOT pass a custom testID — the component fiber would also match,
    // causing find() to return the wrong node. Use the default "skeleton" ID.
    const root = render(<Skeleton variant="circle" />);
    expect(flatStyle(findByTestId(root, "skeleton")).borderRadius).toBe(
      Radius.full,
    );
  });

  it("AC6: rect variant has md border radius", () => {
    const root = render(<Skeleton variant="rect" />);
    expect(flatStyle(findByTestId(root, "skeleton")).borderRadius).toBe(
      Radius.md,
    );
  });

  it("AC6: line variant has sm border radius", () => {
    const root = render(<Skeleton variant="line" />);
    expect(flatStyle(findByTestId(root, "skeleton")).borderRadius).toBe(
      Radius.sm,
    );
  });

  it("AC6: custom width, height, radius override variant defaults", () => {
    const root = render(
      <Skeleton variant="line" width={200} height={32} radius={4} />,
    );
    const flat = flatStyle(findByTestId(root, "skeleton"));
    expect(flat.width).toBe(200);
    expect(flat.height).toBe(32);
    expect(flat.borderRadius).toBe(4);
  });

  it("AC1: uses token color for base (colors.border) — no hardcoded hex", () => {
    const root = render(<Skeleton />);
    // border token resolves to #E5E7EB in the mock
    expect(flatStyle(findByTestId(root, "skeleton")).backgroundColor).toBe(
      "#E5E7EB",
    );
  });

  it("AC5: shimmer layer uses muted token color", () => {
    const root = render(<Skeleton />);
    // muted token resolves to #6B7280 in the mock
    expect(
      flatStyle(findByTestId(root, "skeleton-shimmer")).backgroundColor,
    ).toBe("#6B7280");
  });

  it("AC5 reduced-motion: shimmer node still renders (content visible), no animation", () => {
    vi.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    try {
      const root = render(<Skeleton />);
      expect(findByTestId(root, "skeleton-shimmer")).toBeDefined();
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("AC5 a11y: skeleton is hidden from accessibility tree by default", () => {
    const root = render(<Skeleton />);
    const container = findByTestId(root, "skeleton");
    expect(container.props.accessibilityElementsHidden).toBe(true);
    expect(container.props.importantForAccessibility).toBe(
      "no-hide-descendants",
    );
  });

  it("AC5 a11y: accessibilityLabel exposes element as accessible (accessible=true required, per Lore lesson)", () => {
    const root = render(<Skeleton accessibilityLabel="Loading" />);
    const container = findByTestId(root, "skeleton");
    expect(container.props.accessible).toBe(true);
    expect(container.props.accessibilityLabel).toBe("Loading");
    // Must not be hidden when a label is provided
    expect(container.props.accessibilityElementsHidden).toBeUndefined();
  });

  it("renders shimmer child node", () => {
    const root = render(<Skeleton />);
    expect(findByTestId(root, "skeleton-shimmer")).toBeDefined();
  });
});

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";

import { ProgressBar } from "@/components/ui/ProgressBar";

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

let renderer: ReactTestRenderer | null = null;

function render(ui: React.ReactElement): ReactTestInstance {
  act(() => {
    renderer = TestRenderer.create(ui);
  });
  return renderer!.root;
}

function findFill(root: ReactTestInstance) {
  return root.findByProps({ testID: "progress-bar-fill" });
}

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = null;
});

describe("ProgressBar", () => {
  it("renders 0% fill at value 0", () => {
    const root = render(<ProgressBar value={0} />);
    expect(findFill(root).props.style).toEqual(
      expect.objectContaining({ width: "0%" }),
    );
  });

  it("renders 50% fill at value 0.5", () => {
    const root = render(<ProgressBar value={0.5} />);
    expect(findFill(root).props.style).toEqual(
      expect.objectContaining({ width: "50%" }),
    );
  });

  it("renders 100% fill at value 1", () => {
    const root = render(<ProgressBar value={1} />);
    expect(findFill(root).props.style).toEqual(
      expect.objectContaining({ width: "100%" }),
    );
  });

  it("clamps fill to 100% when value exceeds 1", () => {
    const root = render(<ProgressBar value={1.5} />);
    expect(findFill(root).props.style).toEqual(
      expect.objectContaining({ width: "100%" }),
    );
  });

  it("uses warning token fill when tone is warning", () => {
    const root = render(<ProgressBar value={0.85} tone="warning" />);
    expect(findFill(root).props.style).toEqual(
      expect.objectContaining({ backgroundColor: mockColors.warning }),
    );
  });

  it("uses error token fill when tone is over", () => {
    const root = render(<ProgressBar value={1.2} tone="over" />);
    expect(findFill(root).props.style).toEqual(
      expect.objectContaining({ backgroundColor: mockColors.error }),
    );
  });

  it("uses primary token fill when tone is neutral", () => {
    const root = render(<ProgressBar value={0.4} tone="neutral" />);
    expect(findFill(root).props.style).toEqual(
      expect.objectContaining({ backgroundColor: mockColors.primary }),
    );
  });

  it("prefers explicit fillColor over tone", () => {
    const root = render(
      <ProgressBar value={0.5} tone="over" fillColor="#ABCDEF" />,
    );
    expect(findFill(root).props.style).toEqual(
      expect.objectContaining({ backgroundColor: "#ABCDEF" }),
    );
  });
});

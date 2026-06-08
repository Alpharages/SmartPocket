import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";
import { Platform } from "react-native";

import { Sheet } from "@/components/ui/Sheet";
import { __gesture } from "../../__mocks__/react-native-gesture-handler";
import * as Reanimated from "react-native-reanimated";

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
  overlay: "#000000",
  text: "#111827",
  tint: "#4F46E5",
  icon: "#6B7280",
  tabIconDefault: "#6B7280",
  tabIconSelected: "#4F46E5",
};

vi.mock("@/hooks/use-colors", () => ({
  useColors: () => mockColors,
}));

vi.mock("@expo/vector-icons", () => ({
  Ionicons: ({
    name,
  }: {
    name: string;
    size?: number;
    color?: string;
  }) => React.createElement("Ionicons", { name }),
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 34, left: 0 }),
}));

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
  Platform.OS = "ios";
});

function findByTestId(root: ReactTestInstance, testID: string): ReactTestInstance {
  return root.find((n) => n.props.testID === testID);
}

function press(node: ReactTestInstance): void {
  act(() => {
    node.props.onPress?.();
  });
}

describe("Sheet", () => {
  it("renders modal, backdrop, panel, handle, and close when visible", () => {
    const root = render(
      <Sheet visible onClose={vi.fn()} title="Test sheet">
        <></>
      </Sheet>,
    );
    expect(
      root.findAll((n) => String(n.type) === "Modal")
        .length,
    ).toBe(1);
    expect(findByTestId(root, "smartpocket-sheet-backdrop")).toBeDefined();
    expect(findByTestId(root, "smartpocket-sheet-panel")).toBeDefined();
    expect(findByTestId(root, "smartpocket-sheet-handle")).toBeDefined();
    expect(findByTestId(root, "smartpocket-sheet-close")).toBeDefined();
  });

  it("does not mount when visible is false", () => {
    const root = render(
      <Sheet visible={false} onClose={vi.fn()} title="Hidden">
        <></>
      </Sheet>,
    );
    expect(
      root.findAll((n) => String(n.type) === "Modal")
        .length,
    ).toBe(0);
  });

  it("sets accessibilityViewIsModal on the Modal host", () => {
    const root = render(
      <Sheet visible onClose={vi.fn()} title="Dialog">
        <></>
      </Sheet>,
    );
    const modal = root.find(
      (n) => String(n.type) === "Modal",
    );
    expect(modal.props.accessibilityViewIsModal).toBe(true);
  });

  it("exposes title as accessibilityLabel on the panel", () => {
    const root = render(
      <Sheet visible onClose={vi.fn()} title="Add Budget">
        <></>
      </Sheet>,
    );
    const panel = findByTestId(root, "smartpocket-sheet-panel");
    expect(panel.props.accessibilityLabel).toBe("Add Budget");
  });

  it("close button has button role and label", () => {
    const root = render(
      <Sheet visible onClose={vi.fn()} title="T">
        <></>
      </Sheet>,
    );
    const close = findByTestId(root, "smartpocket-sheet-close");
    expect(close.props.accessibilityRole).toBe("button");
    expect(close.props.accessibilityLabel).toBe("Close");
  });

  it("calls onClose once when backdrop is pressed", () => {
    const onClose = vi.fn();
    const root = render(
      <Sheet visible onClose={onClose} title="T">
        <></>
      </Sheet>,
    );
    press(findByTestId(root, "smartpocket-sheet-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when close affordance is pressed", () => {
    const onClose = vi.fn();
    const root = render(
      <Sheet visible onClose={onClose} title="T">
        <></>
      </Sheet>,
    );
    press(findByTestId(root, "smartpocket-sheet-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Modal onRequestClose fires (Android back)", () => {
    const onClose = vi.fn();
    const root = render(
      <Sheet visible onClose={onClose} title="T">
        <></>
      </Sheet>,
    );
    const modal = root.find(
      (n) => String(n.type) === "Modal",
    );
    act(() => {
      modal.props.onRequestClose?.();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("wraps content in KeyboardAvoidingView with iOS padding behavior", () => {
    const root = render(
      <Sheet visible onClose={vi.fn()} title="T">
        <></>
      </Sheet>,
    );
    const kav = root.find(
      (n) => String(n.type) === "KeyboardAvoidingView",
    );
    expect(kav.props.behavior).toBe("padding");
  });

  it("applies bottom safe-area padding via panel style", () => {
    const root = render(
      <Sheet visible onClose={vi.fn()} title="T">
        <></>
      </Sheet>,
    );
    const panel = findByTestId(root, "smartpocket-sheet-panel");
    const flat = Array.isArray(panel.props.style)
      ? Object.assign({}, ...panel.props.style.filter(Boolean))
      : panel.props.style;
    expect(flat.paddingBottom).toBeGreaterThanOrEqual(16);
  });

  it("centers and constrains the panel on web", () => {
    Platform.OS = "web";
    const root = render(
      <Sheet visible onClose={vi.fn()} title="Web sheet">
        <></>
      </Sheet>,
    );
    const panel = findByTestId(root, "smartpocket-sheet-panel");
    const flat = Array.isArray(panel.props.style)
      ? Object.assign({}, ...panel.props.style.filter(Boolean))
      : panel.props.style;

    expect(flat.width).toBe("100%");
    expect(flat.maxWidth).toBe(560);
    expect(flat.alignSelf).toBe("center");
  });

  it("renders header without title text when title is omitted", () => {
    const root = render(
      <Sheet visible onClose={vi.fn()}>
        <></>
      </Sheet>,
    );
    const headers = root.findAll(
      (n) =>
        String(n.type) === "Text" &&
        n.props.accessibilityRole === "header",
    );
    expect(headers.length).toBe(0);
    expect(findByTestId(root, "smartpocket-sheet-close")).toBeDefined();
  });

  it("AC1: renders immediately and mounts when reduce-motion is enabled", () => {
    const spy = vi
      .spyOn(Reanimated, "useReducedMotion")
      .mockReturnValue(true);
    try {
      const root = render(
        <Sheet visible onClose={vi.fn()} title="Reduced motion">
          <></>
        </Sheet>,
      );
      expect(
        root.findAll((n) => String(n.type) === "Modal").length,
      ).toBe(1);
      expect(findByTestId(root, "smartpocket-sheet-panel")).toBeDefined();
      expect(findByTestId(root, "smartpocket-sheet-backdrop")).toBeDefined();
    } finally {
      spy.mockRestore();
    }
  });

  it("AC4: drag past threshold fires onClose", () => {
    const onClose = vi.fn();
    render(
      <Sheet visible onClose={onClose} title="T">
        <></>
      </Sheet>,
    );
    // screenHeight mock = 844, threshold = 844 * 0.35 = 295.4
    act(() => {
      __gesture.latestPan?.triggerEnd({ translationY: 300 });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("rapid open/close: re-opening leaves sheet mounted", () => {
    const onClose = vi.fn();
    render(
      <Sheet visible onClose={onClose} title="T">
        <></>
      </Sheet>,
    );
    // close
    act(() => {
      renderer!.update(
        <Sheet visible={false} onClose={onClose} title="T">
          <></>
        </Sheet>,
      );
    });
    // immediately re-open before animation completes
    act(() => {
      renderer!.update(
        <Sheet visible onClose={onClose} title="T">
          <></>
        </Sheet>,
      );
    });
    expect(
      renderer!.root.findAll((n) => String(n.type) === "Modal").length,
    ).toBe(1);
  });
});

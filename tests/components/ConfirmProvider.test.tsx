import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TestRenderer, { act, type ReactTestInstance } from "react-test-renderer";

import {
  ConfirmProvider,
  getConfirmHandler,
} from "@/components/ui/ConfirmProvider";

const routerState = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("expo-router", () => ({
  usePathname: () => routerState.pathname,
}));

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

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

vi.mock("@expo/vector-icons", () => ({
  Ionicons: () => React.createElement("span"),
}));

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
  routerState.pathname = "/";
});

describe("ConfirmProvider", () => {
  it("registers an imperative confirm handler on mount and clears it on unmount", () => {
    expect(getConfirmHandler()).toBeNull();

    render(
      React.createElement(ConfirmProvider, null, React.createElement("View")),
    );
    expect(getConfirmHandler()).not.toBeNull();

    act(() => {
      renderer?.unmount();
    });
    renderer = null;
    expect(getConfirmHandler()).toBeNull();
  });

  it("renders children and resolves confirm() true when ConfirmSheet's confirm button is pressed", async () => {
    render(
      React.createElement(
        ConfirmProvider,
        null,
        React.createElement("Text", { testID: "child" }, "hello"),
      ),
    );
    const child = renderer!.root.find((n) => n.props.testID === "child");
    expect(child).toBeDefined();

    // Flush Sheet's mount-time AccessibilityInfo.isReduceMotionEnabled()
    // promise so its state update lands inside act(), not later.
    await act(async () => {});

    let result!: Promise<boolean>;
    act(() => {
      result = getConfirmHandler()!({
        title: "Delete transaction",
        message: "Are you sure?",
        destructive: true,
      });
    });

    const buttons = renderer!.root.findAll(
      (n) =>
        typeof n.type === "string" && n.props.accessibilityRole === "button",
    );
    const confirmButton = buttons.find((b) => {
      const texts = b.findAll((n) => String(n.type) === "Text");
      return texts.some((t) => (t.children ?? []).some((c) => c === "Confirm"));
    });
    expect(confirmButton).toBeDefined();
    act(() => {
      confirmButton!.props.onPress?.();
    });

    await expect(result).resolves.toBe(true);
  });

  it("resolves the pending confirm false when the route changes while it is visible", async () => {
    render(
      React.createElement(ConfirmProvider, null, React.createElement("View")),
    );
    await act(async () => {});

    let result!: Promise<boolean>;
    act(() => {
      result = getConfirmHandler()!({ title: "Delete transaction" });
    });

    // Simulate the calling screen unmounting via navigation (including the
    // browser Back button on web, which a root-mounted Modal cannot
    // intercept) — the sheet is hosted at the app root, so only a pathname
    // check can tell the pending confirm no longer belongs here.
    routerState.pathname = "/transactions";
    act(() => {
      renderer!.update(
        React.createElement(ConfirmProvider, null, React.createElement("View")),
      );
    });

    await expect(result).resolves.toBe(false);
  });

  it("renders the confirm sheet as a root Modal on a normal route", async () => {
    render(
      React.createElement(ConfirmProvider, null, React.createElement("View")),
    );
    await act(async () => {});

    act(() => {
      getConfirmHandler()!({ title: "Delete transaction" });
    });

    const sheetNode = renderer!.root.find(
      (n) => n.props.testID === "confirm-sheet" && typeof n.type === "string",
    );
    expect(sheetNode.type).toBe("Modal");
  });

  it("renders the confirm sheet noModal when opened from a transparentModal route", async () => {
    routerState.pathname = "/budget-form";
    render(
      React.createElement(ConfirmProvider, null, React.createElement("View")),
    );
    await act(async () => {});

    act(() => {
      getConfirmHandler()!({ title: "Delete budget" });
    });

    const sheetNode = renderer!.root.find(
      (n) => n.props.testID === "confirm-sheet" && typeof n.type === "string",
    );
    expect(sheetNode.type).not.toBe("Modal");
  });

  it("keeps a newer provider's handler registered when an older instance unmounts", async () => {
    let rendererA: TestRenderer.ReactTestRenderer;
    act(() => {
      rendererA = TestRenderer.create(
        React.createElement(ConfirmProvider, null, React.createElement("View")),
      );
    });
    await act(async () => {});
    const handlerA = getConfirmHandler();
    expect(handlerA).not.toBeNull();

    act(() => {
      renderer = TestRenderer.create(
        React.createElement(ConfirmProvider, null, React.createElement("View")),
      );
    });
    await act(async () => {});
    const handlerB = getConfirmHandler();
    expect(handlerB).not.toBeNull();
    expect(handlerB).not.toBe(handlerA);

    act(() => {
      rendererA.unmount();
    });

    expect(getConfirmHandler()).toBe(handlerB);
  });
});

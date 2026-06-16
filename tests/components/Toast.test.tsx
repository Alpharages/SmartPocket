import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";

import { Toast } from "@/components/ui/Toast";
import { ToastProvider, useToast } from "@/components/ui/ToastProvider";

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

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
  Ionicons: ({ name }: { name: string }) =>
    React.createElement("Ionicons", { name }),
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, right: 0, bottom: 34, left: 0 }),
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

function press(node: ReactTestInstance): void {
  act(() => {
    node.props.onPress?.();
  });
}

function flatStyle(node: ReactTestInstance): Record<string, unknown> {
  return Array.isArray(node.props.style)
    ? Object.assign({}, ...node.props.style.filter(Boolean))
    : (node.props.style ?? {});
}

/**
 * Count toast items using renderer.toJSON() for a reliable committed-tree snapshot.
 * Live fiber-based traversal (container.children) can return stale data between
 * separate act() calls in React 18; toJSON() always reflects what was last committed.
 */
function toastCount(): number {
  if (!renderer) return 0;
  const json = renderer.toJSON() as Record<string, unknown> | null;
  if (!json) return 0;

  function findContainer(node: unknown): Record<string, unknown> | null {
    if (!node || typeof node !== "object") return null;
    if (Array.isArray(node)) {
      for (const n of node) {
        const found = findContainer(n);
        if (found) return found;
      }
      return null;
    }
    const rec = node as Record<string, unknown>;
    if ((rec.props as Record<string, unknown>)?.testID === "toast-container") {
      return rec;
    }
    if (Array.isArray(rec.children)) {
      for (const child of rec.children as unknown[]) {
        const found = findContainer(child);
        if (found) return found;
      }
    }
    return null;
  }

  const container = findContainer(json);
  if (!container || !Array.isArray(container.children)) return 0;

  return (container.children as unknown[]).filter((child) => {
    if (!child || typeof child !== "object") return false;
    const testID = (child as Record<string, unknown>).props
      ? ((child as Record<string, unknown>).props as Record<string, unknown>)
          .testID
      : undefined;
    return typeof testID === "string" && /^toast-t-/.test(testID);
  }).length;
}

// ---------------------------------------------------------------------------
// Toast item (individual)
// ---------------------------------------------------------------------------

describe("Toast item", () => {
  it("AC3: renders the toast with message text", () => {
    const root = render(
      <Toast id="t1" type="success" message="Saved!" onDismiss={vi.fn()} />,
    );
    const msg = findByTestId(root, "toast-t1-message");
    expect(msg.props.children).toBe("Saved!");
  });

  it("AC3: success and error toasts show distinct icon names", () => {
    // success
    const successRoot = render(
      <Toast id="ts" type="success" message="ok" onDismiss={vi.fn()} />,
    );
    const successIconName = findByTestId(successRoot, "toast-ts-icon").findAll(
      (n) => String(n.type) === "Ionicons",
    )[0]?.props.name;

    // unmount and switch to error
    act(() => {
      renderer?.unmount();
    });
    renderer = null;

    const errorRoot = render(
      <Toast id="te" type="error" message="fail" onDismiss={vi.fn()} />,
    );
    const errorIconName = findByTestId(errorRoot, "toast-te-icon").findAll(
      (n) => String(n.type) === "Ionicons",
    )[0]?.props.name;

    expect(successIconName).toBeDefined();
    expect(errorIconName).toBeDefined();
    expect(successIconName).not.toBe(errorIconName);
  });

  it("AC4: dismiss button has button role and 'Dismiss' label (≥44pt)", () => {
    const root = render(
      <Toast id="td" type="info" message="hello" onDismiss={vi.fn()} />,
    );
    const btn = findByTestId(root, "toast-td-dismiss");
    expect(btn.props.accessibilityRole).toBe("button");
    expect(btn.props.accessibilityLabel).toBe("Dismiss");
    expect(flatStyle(btn).minHeight).toBeGreaterThanOrEqual(44);
  });

  it("AC4: pressing dismiss calls onDismiss with the toast id", () => {
    const onDismiss = vi.fn();
    const root = render(
      <Toast id="t-dm" type="success" message="ok" onDismiss={onDismiss} />,
    );
    press(findByTestId(root, "toast-t-dm-dismiss"));
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledWith("t-dm");
  });

  it("AC5: foreground text uses token color — not hardcoded hex", () => {
    const root = render(
      <Toast id="t-c" type="success" message="check" onDismiss={vi.fn()} />,
    );
    expect(flatStyle(findByTestId(root, "toast-t-c-message")).color).toBe(
      mockColors.foreground,
    );
  });

  it("AC1: icon container is hidden from accessibility tree (decorative)", () => {
    const root = render(
      <Toast id="t-a11y" type="success" message="ok" onDismiss={vi.fn()} />,
    );
    const iconContainer = findByTestId(root, "toast-t-a11y-icon");
    expect(iconContainer.props.accessibilityElementsHidden).toBe(true);
    expect(iconContainer.props.importantForAccessibility).toBe(
      "no-hide-descendants",
    );
  });

  it("AC4: toast is announced via accessibilityLiveRegion=polite", () => {
    const root = render(
      <Toast id="t-lr" type="info" message="info msg" onDismiss={vi.fn()} />,
    );
    expect(findByTestId(root, "toast-t-lr").props.accessibilityLiveRegion).toBe(
      "polite",
    );
  });
});

// ---------------------------------------------------------------------------
// Auto-dismiss (isolated with fake timers)
// ---------------------------------------------------------------------------

describe("Toast auto-dismiss", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("AC4: auto-dismiss fires onDismiss after default duration", () => {
    const onDismiss = vi.fn();
    act(() => {
      renderer = TestRenderer.create(
        <Toast id="t-auto" type="info" message="auto" onDismiss={onDismiss} />,
      );
    });
    expect(onDismiss).not.toHaveBeenCalled();
    // Advance past duration (3500) + exit animation (250)
    act(() => {
      vi.advanceTimersByTime(3500 + 300);
    });
    expect(onDismiss).toHaveBeenCalledWith("t-auto");
  });

  it("AC4: custom duration is respected", () => {
    const onDismiss = vi.fn();
    act(() => {
      renderer = TestRenderer.create(
        <Toast
          id="t-dur"
          type="info"
          message="custom"
          duration={1000}
          onDismiss={onDismiss}
        />,
      );
    });
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// ToastProvider + useToast
// ---------------------------------------------------------------------------

describe("ToastProvider", () => {
  it("renders overlay container", () => {
    const root = render(
      <ToastProvider>
        <></>
      </ToastProvider>,
    );
    expect(findByTestId(root, "toast-container")).toBeDefined();
  });

  it("AC4: overlay has pointerEvents='box-none' so touches pass through", () => {
    const root = render(
      <ToastProvider>
        <></>
      </ToastProvider>,
    );
    expect(findByTestId(root, "toast-container").props.pointerEvents).toBe(
      "box-none",
    );
  });

  it("AC4: overlay top is offset by safe-area insets (top > 0)", () => {
    const root = render(
      <ToastProvider>
        <></>
      </ToastProvider>,
    );
    const flat = flatStyle(findByTestId(root, "toast-container"));
    // mock insets.top = 44, Spacing.sm = 8 → top = 52
    expect(flat.top).toBeGreaterThan(0);
  });

  it("AC3: show() enqueues one toast", () => {
    let showFn!: ReturnType<typeof useToast>["show"];
    function Harness() {
      showFn = useToast().show;
      return null;
    }

    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );
    act(() => {
      showFn({ type: "success", message: "Created!" });
    });

    expect(toastCount()).toBe(1);
  });

  it("AC4: two show() calls produce two queued toasts", () => {
    let showFn!: ReturnType<typeof useToast>["show"];
    function Harness() {
      showFn = useToast().show;
      return null;
    }

    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );
    // Batch both shows in a single act() to avoid React 18 cross-batch state issues
    act(() => {
      showFn({ type: "success", message: "First" });
      showFn({ type: "error", message: "Second" });
    });

    expect(toastCount()).toBe(2);
  });

  it("AC4: manually dismissing a toast removes it", () => {
    let showFn!: ReturnType<typeof useToast>["show"];
    function Harness() {
      showFn = useToast().show;
      return null;
    }

    const root = render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );
    act(() => {
      showFn({ type: "info", message: "Bye" });
    });

    expect(toastCount()).toBe(1);

    const dismissBtn = root.find(
      (n) =>
        typeof n.props.testID === "string" &&
        n.props.testID.endsWith("-dismiss"),
    );
    press(dismissBtn);

    expect(toastCount()).toBe(0);
  });

  it("useToast throws when called outside ToastProvider", () => {
    function BadConsumer() {
      useToast();
      return null;
    }
    expect(() => {
      act(() => {
        TestRenderer.create(<BadConsumer />);
      });
    }).toThrow("useToast must be used within a <ToastProvider>");
  });
});

// ---------------------------------------------------------------------------
// ToastProvider auto-dismiss (fake timers)
// ---------------------------------------------------------------------------

describe("ToastProvider auto-dismiss", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("AC4: toast auto-dismisses and is removed after duration", () => {
    let showFn!: ReturnType<typeof useToast>["show"];
    function Harness() {
      showFn = useToast().show;
      return null;
    }

    // Access .root OUTSIDE act() to avoid "Can't access .root on unmounted renderer"
    act(() => {
      renderer = TestRenderer.create(
        <ToastProvider>
          <Harness />
        </ToastProvider>,
      );
    });

    act(() => {
      showFn({ type: "info", message: "Bye", duration: 500 });
    });
    expect(toastCount()).toBe(1);

    act(() => {
      vi.advanceTimersByTime(500 + 300);
    });
    expect(toastCount()).toBe(0);
  });
});

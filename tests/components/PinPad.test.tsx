import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";
import { StyleSheet, Text, View } from "react-native";

import { PinPad } from "@/components/ui/PinPad";

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

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = null;
});

function press(node: ReactTestInstance): void {
  act(() => {
    node.props.onPress?.();
  });
}

function keys(root: ReactTestInstance): ReactTestInstance[] {
  return root.findAll(
    (n) => typeof n.type === "string" && n.props.accessibilityRole === "button",
  );
}

function findKey(root: ReactTestInstance, label: string): ReactTestInstance {
  const match = keys(root).find((n) => n.props.accessibilityLabel === label);
  if (!match)
    throw new Error(`No key found with accessibilityLabel "${label}"`);
  return match;
}

function pressDigits(root: ReactTestInstance, digits: string): void {
  for (const digit of digits) {
    press(findKey(root, digit));
  }
}

function dots(root: ReactTestInstance): ReactTestInstance[] {
  return root.findAll(
    (n) => typeof n.type === "string" && n.props.testID === "pin-pad-dot",
  );
}

describe("PinPad", () => {
  it("renders 4 dots", () => {
    const root = render(<PinPad onSubmit={() => {}} />);
    expect(dots(root)).toHaveLength(4);
  });

  it("renders a 0-9 keypad and a backspace key", () => {
    const root = render(<PinPad onSubmit={() => {}} />);
    for (const digit of "0123456789") {
      expect(findKey(root, digit)).toBeTruthy();
    }
    expect(findKey(root, "Backspace")).toBeTruthy();
  });

  it("every key meets the 44pt minimum touch target", () => {
    const root = render(<PinPad onSubmit={() => {}} />);
    for (const node of keys(root)) {
      const style = StyleSheet.flatten(node.props.style);
      expect(style.minHeight ?? style.height).toBeGreaterThanOrEqual(44);
      expect(style.minWidth ?? style.width).toBeGreaterThanOrEqual(44);
    }
  });

  it("every key carries an accessibility label", () => {
    const root = render(<PinPad onSubmit={() => {}} />);
    for (const node of keys(root)) {
      expect(typeof node.props.accessibilityLabel).toBe("string");
      expect(node.props.accessibilityLabel.length).toBeGreaterThan(0);
    }
  });

  it("fills one dot per digit entered", () => {
    const root = render(<PinPad onSubmit={() => {}} />);
    pressDigits(root, "12");
    const filled = dots(root).filter(
      (d) => StyleSheet.flatten(d.props.style).backgroundColor !== undefined,
    );
    expect(filled.length).toBeGreaterThanOrEqual(2);
  });

  it("does not call onSubmit before the 4th digit", () => {
    const onSubmit = vi.fn();
    const root = render(<PinPad onSubmit={onSubmit} />);
    pressDigits(root, "123");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("calls onSubmit with the full PIN on the 4th digit", () => {
    const onSubmit = vi.fn();
    const root = render(<PinPad onSubmit={onSubmit} />);
    pressDigits(root, "1234");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("1234");
  });

  it("removes the last digit when backspace is pressed", () => {
    const onSubmit = vi.fn();
    const root = render(<PinPad onSubmit={onSubmit} />);
    pressDigits(root, "123");
    press(findKey(root, "Backspace"));
    pressDigits(root, "9");
    // Would have been "1239" (submitting) had backspace not removed the "3"
    pressDigits(root, "9");
    expect(onSubmit).toHaveBeenCalledWith("1299");
  });

  it("ignores backspace when no digits are entered", () => {
    const root = render(<PinPad onSubmit={() => {}} />);
    expect(() => press(findKey(root, "Backspace"))).not.toThrow();
  });

  it("resets entered digits after a submit", () => {
    const onSubmit = vi.fn();
    const root = render(<PinPad onSubmit={onSubmit} />);
    pressDigits(root, "1234");
    pressDigits(root, "5678");
    expect(onSubmit).toHaveBeenNthCalledWith(2, "5678");
  });

  it("ignores digit presses once disabled", () => {
    const onSubmit = vi.fn();
    const root = render(<PinPad onSubmit={onSubmit} disabled />);
    pressDigits(root, "1234");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("renders dots in the error color when error is true", () => {
    const root = render(<PinPad onSubmit={() => {}} error />);
    for (const dot of dots(root)) {
      const style = StyleSheet.flatten(dot.props.style);
      expect(style.borderColor ?? style.backgroundColor).toBe(mockColors.error);
    }
  });

  it("does not trigger a React render-phase setState warning when the caller's onSubmit updates its own state", () => {
    // Regression test: `onSubmit` must fire from the event-handler body, not
    // from inside the `setDigits` updater. When a caller's `onSubmit` sets its
    // own state (the real-world case — see SecurityScreen.handleSubmitPin),
    // firing it from inside PinPad's updater makes React log "Cannot update a
    // component while rendering a different component".
    function Harness() {
      const [count, setCount] = React.useState(0);
      return (
        <View>
          <Text>{count}</Text>
          <PinPad onSubmit={() => setCount((c) => c + 1)} />
        </View>
      );
    }

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const root = render(<Harness />);
    pressDigits(root, "1234");
    const renderPhaseWarnings = errorSpy.mock.calls.filter((call) =>
      String(call[0]).includes("Cannot update a component"),
    );
    expect(renderPhaseWarnings).toHaveLength(0);
    errorSpy.mockRestore();
  });

  it("clears entered digits when error becomes true", () => {
    const root = render(<PinPad onSubmit={() => {}} />);
    pressDigits(root, "12");
    act(() => {
      renderer!.update(<PinPad onSubmit={() => {}} error />);
    });
    act(() => {
      renderer!.update(<PinPad onSubmit={() => {}} error={false} />);
    });
    const filled = dots(root).filter(
      (d) => StyleSheet.flatten(d.props.style).backgroundColor !== undefined,
    );
    expect(filled).toHaveLength(0);
  });
});

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";
import { StyleSheet, Text } from "react-native";

import { Button } from "@/components/ui/Button";

/**
 * These tests render the real `Button` through `react-test-renderer` (the React
 * Native renderer) against the prop-preserving `react-native` test double in
 * `__mocks__/`. We use react-test-renderer directly rather than
 * `@testing-library/react-native`: in this vitest (node) setup RNTL resolves to
 * its TS source, whose `require("react-native")` is externalized and bypasses
 * the vitest alias, loading the real Flow-typed package and throwing
 * "Unexpected token 'typeof'". react-test-renderer needs no such interop and
 * lets us drive `onPress` for genuine interaction coverage.
 */

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

/** Simulate a press by invoking the host node's `onPress`, as RN would. */
function press(node: ReactTestInstance): void {
  act(() => {
    node.props.onPress?.();
  });
}

/** The pressable button host node (carries role/label/state/onPress). */
function getButton(root: ReactTestInstance): ReactTestInstance {
  return root.find(
    (n) => typeof n.type === "string" && n.props.accessibilityRole === "button",
  );
}

/** Concatenate the visible text under a node. */
function textOf(node: ReactTestInstance | string): string {
  if (typeof node === "string") return node;
  return (node.children ?? [])
    .map((c) => (typeof c === "string" ? c : textOf(c)))
    .join("");
}

function queryText(root: ReactTestInstance, text: string): ReactTestInstance[] {
  return root.findAll((n) => String(n.type) === "Text" && textOf(n) === text);
}

function getByText(root: ReactTestInstance, text: string): ReactTestInstance {
  const matches = queryText(root, text);
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one Text "${text}", found ${matches.length}`,
    );
  }
  return matches[0];
}

describe("Button", () => {
  describe("rendering", () => {
    it("renders a primary button with its label", () => {
      const root = render(<Button variant="primary" label="Submit" />);
      expect(getByText(root, "Submit")).toBeTruthy();
    });

    it("exposes accessibilityRole='button'", () => {
      const root = render(<Button variant="primary" label="Submit" />);
      expect(getButton(root).props.accessibilityRole).toBe("button");
    });

    it("renders every non-icon-only variant without throwing", () => {
      const variants = [
        "primary",
        "secondary",
        "ghost",
        "destructive",
        "income",
      ] as const;
      for (const variant of variants) {
        const root = render(<Button variant={variant} label="Test" />);
        expect(getByText(root, "Test")).toBeTruthy();
        act(() => renderer?.unmount());
      }
    });

    it("renders the icon-only variant addressable by its accessibilityLabel", () => {
      const root = render(
        <Button
          variant="icon-only"
          accessibilityLabel="Close"
          leftIcon={<Text>×</Text>}
        />,
      );
      expect(getButton(root).props.accessibilityLabel).toBe("Close");
    });

    it("enforces a 44pt minimum touch height on every variant", () => {
      const variants = [
        "primary",
        "secondary",
        "ghost",
        "destructive",
        "income",
        "icon-only",
      ] as const;
      for (const variant of variants) {
        const root = render(
          variant === "icon-only" ? (
            <Button
              variant="icon-only"
              accessibilityLabel="Action"
              leftIcon={<Text>+</Text>}
            />
          ) : (
            <Button variant={variant} label="Tall" />
          ),
        );
        const style = StyleSheet.flatten(getButton(root).props.style);
        expect(style.minHeight).toBeGreaterThanOrEqual(44);
        act(() => renderer?.unmount());
      }
    });

    it("keeps a 44pt touch target across every size AND variant (incl. icon-only)", () => {
      const sizes = ["sm", "md", "lg"] as const;
      const labelVariants = [
        "primary",
        "secondary",
        "ghost",
        "destructive",
        "income",
      ] as const;
      for (const size of sizes) {
        for (const variant of labelVariants) {
          const root = render(
            <Button variant={variant} label="X" size={size} />,
          );
          const style = StyleSheet.flatten(getButton(root).props.style);
          if (style.minHeight < 44) {
            throw new Error(
              `${variant}/${size}: minHeight ${style.minHeight} < 44`,
            );
          }
          expect(style.minHeight).toBeGreaterThanOrEqual(44);
          act(() => renderer?.unmount());
        }
        // icon-only is a fixed square — both width and height must clear 44.
        const root = render(
          <Button
            variant="icon-only"
            accessibilityLabel="Action"
            size={size}
            leftIcon={<Text>+</Text>}
          />,
        );
        const style = StyleSheet.flatten(getButton(root).props.style);
        if (style.height < 44 || style.width < 44) {
          throw new Error(
            `icon-only/${size}: ${style.width}x${style.height} below 44`,
          );
        }
        expect(style.minHeight).toBeGreaterThanOrEqual(44);
        expect(style.height).toBeGreaterThanOrEqual(44);
        expect(style.width).toBeGreaterThanOrEqual(44);
        act(() => renderer?.unmount());
      }
    });
  });

  describe("interaction", () => {
    it("calls onPress exactly once when pressed", () => {
      const onPress = vi.fn();
      const root = render(
        <Button variant="primary" label="Press me" onPress={onPress} />,
      );
      press(getButton(root));
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("does not call onPress when disabled", () => {
      const onPress = vi.fn();
      const root = render(
        <Button
          variant="primary"
          label="Disabled"
          onPress={onPress}
          disabled
        />,
      );
      press(getButton(root));
      expect(onPress).not.toHaveBeenCalled();
    });

    it("reports accessibilityState.disabled when disabled (and not busy)", () => {
      const root = render(
        <Button variant="primary" label="Disabled" disabled />,
      );
      expect(getButton(root).props.accessibilityState).toMatchObject({
        disabled: true,
        busy: false,
      });
    });

    it("handles a missing onPress without throwing", () => {
      const root = render(<Button variant="primary" label="No handler" />);
      expect(() => press(getButton(root))).not.toThrow();
    });
  });

  describe("loading state", () => {
    it("shows a spinner and hides the label when loading", () => {
      const root = render(<Button variant="primary" label="Loading" loading />);
      expect(
        root.find((n) => n.props.testID === "activity-indicator"),
      ).toBeTruthy();
      expect(queryText(root, "Loading")).toHaveLength(0);
    });

    it("blocks onPress while loading", () => {
      const onPress = vi.fn();
      const root = render(
        <Button variant="primary" label="Loading" loading onPress={onPress} />,
      );
      press(getButton(root));
      expect(onPress).not.toHaveBeenCalled();
    });

    it("reports accessibilityState.busy when loading (and not disabled)", () => {
      const root = render(<Button variant="primary" label="Loading" loading />);
      expect(getButton(root).props.accessibilityState).toMatchObject({
        busy: true,
        disabled: false,
      });
    });
  });

  describe("edge cases", () => {
    it("does not double-fire onPress on rapid presses while loading", () => {
      const onPress = vi.fn();
      const root = render(
        <Button variant="primary" label="Busy" loading onPress={onPress} />,
      );
      const button = getButton(root);
      press(button);
      press(button);
      expect(onPress).not.toHaveBeenCalled();
    });

    it("fires once per genuine press when enabled (no spurious double-firing)", () => {
      const onPress = vi.fn();
      const root = render(
        <Button variant="primary" label="Go" onPress={onPress} />,
      );
      const button = getButton(root);
      press(button);
      press(button);
      expect(onPress).toHaveBeenCalledTimes(2);
    });

    it("truncates long labels to a single line (no clipping/overflow)", () => {
      const long = "A very long button label that should not wrap or clip";
      const root = render(<Button variant="primary" label={long} />);
      expect(getByText(root, long).props.numberOfLines).toBe(1);
    });
  });

  describe("sizes", () => {
    it("renders sm, md, and lg sizes without throwing", () => {
      const sizes = ["sm", "md", "lg"] as const;
      for (const size of sizes) {
        const root = render(
          <Button variant="primary" label="Size test" size={size} />,
        );
        expect(getByText(root, "Size test")).toBeTruthy();
        act(() => renderer?.unmount());
      }
    });
  });

  describe("icons", () => {
    it("renders leftIcon alongside the label", () => {
      const root = render(
        <Button
          variant="primary"
          label="With icon"
          leftIcon={<Text>★</Text>}
        />,
      );
      expect(getByText(root, "★")).toBeTruthy();
      expect(getByText(root, "With icon")).toBeTruthy();
    });

    it("renders rightIcon alongside the label", () => {
      const root = render(
        <Button
          variant="primary"
          label="With icon"
          rightIcon={<Text>☆</Text>}
        />,
      );
      expect(getByText(root, "☆")).toBeTruthy();
      expect(getByText(root, "With icon")).toBeTruthy();
    });
  });

  describe("accessibility", () => {
    it("uses the visible label as the accessibility label by default", () => {
      const root = render(<Button variant="primary" label="Auto label" />);
      expect(getButton(root).props.accessibilityLabel).toBe("Auto label");
    });

    it("prefers an explicit accessibilityLabel over the visible label", () => {
      const root = render(
        <Button
          variant="primary"
          label="Visible"
          accessibilityLabel="Hidden description"
        />,
      );
      expect(getButton(root).props.accessibilityLabel).toBe(
        "Hidden description",
      );
      expect(getByText(root, "Visible")).toBeTruthy();
    });
  });
});

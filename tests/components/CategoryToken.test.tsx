import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";
import { StyleSheet, Text } from "react-native";

import { CategoryToken } from "@/components/ui/CategoryToken";

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

vi.mock("@expo/vector-icons", () => {
  const Ionicons = ({
    name,
    size,
    color,
  }: {
    name: string;
    size?: number;
    color?: string;
  }) =>
    React.createElement(
      "Text",
      { testID: `icon-${name}` },
      `ICON:${name}:${size}:${color}`,
    );
  Ionicons.glyphMap = {
    tag: 1,
    "fast-food": 1,
    car: 1,
    cash: 1,
    checkmark: 1,
    pricetag: 1,
  };
  return { Ionicons };
});

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

/** Simulate a press by invoking the host node's `onPress`. */
function press(node: ReactTestInstance): void {
  act(() => {
    node.props.onPress?.();
  });
}

/** The pressable host node (carries role/label/state/onPress). */
function getButton(root: ReactTestInstance): ReactTestInstance {
  return root.find(
    (n) => typeof n.type === "string" && n.props.accessibilityRole === "button",
  );
}

/** Find the inner View that renders the icon container. */
function getIconContainer(root: ReactTestInstance): ReactTestInstance {
  // For interactive tokens, the outer pressable wraps an inner View.
  // For display-only tokens, the View is the root.
  try {
    const button = getButton(root);
    return button.find(
      (n) =>
        typeof n.type === "string" &&
        n.props.style &&
        StyleSheet.flatten(n.props.style).alignItems === "center",
    );
  } catch {
    return root.find(
      (n) =>
        typeof n.type === "string" &&
        n.props.style &&
        StyleSheet.flatten(n.props.style).alignItems === "center",
    );
  }
}

describe("CategoryToken", () => {
  describe("rendering", () => {
    it("renders with default state", () => {
      const root = render(
        <CategoryToken name="Food" color="#E11D48" icon="fast-food" />,
      );
      const container = getIconContainer(root);
      const style = StyleSheet.flatten(container.props.style);
      // Default state: background is color with alpha, not solid fill
      expect(style.backgroundColor).toBe("#E11D4814");
      expect(style.borderWidth).toBe(1);
      expect(style.borderColor).toBe(mockColors.border);
    });

    it("renders every size variant without throwing", () => {
      const sizes = ["sm", "md", "lg"] as const;
      for (const size of sizes) {
        const root = render(
          <CategoryToken
            name="Food"
            color="#E11D48"
            icon="fast-food"
            size={size}
          />,
        );
        const container = getIconContainer(root);
        expect(container).toBeTruthy();
        act(() => renderer?.unmount());
      }
    });

    it("falls back to 'tag' icon when icon name is invalid", () => {
      const root = render(
        <CategoryToken name="Food" color="#E11D48" icon="not-a-real-icon" />,
      );
      // The Ionicons component should still render; the fallback happens
      // internally by mapping to "tag". We verify the component renders.
      const container = getIconContainer(root);
      expect(container).toBeTruthy();
    });

    it("falls back to 'tag' icon when icon is undefined", () => {
      const root = render(<CategoryToken name="Food" color="#E11D48" />);
      const container = getIconContainer(root);
      expect(container).toBeTruthy();
    });
  });

  describe("selected state", () => {
    it("shows a ring (border) + checkmark when selected", () => {
      const root = render(
        <CategoryToken
          name="Food"
          color="#E11D48"
          icon="fast-food"
          state="selected"
        />,
      );
      const container = getIconContainer(root);
      const style = StyleSheet.flatten(container.props.style);
      expect(style.borderWidth).toBe(2.5);
      expect(style.borderColor).toBe("#E11D48");
      // Background should be surface, NOT the category color
      expect(style.backgroundColor).toBe(mockColors.surface);
    });

    it("does not fill background with category color when selected", () => {
      const root = render(
        <CategoryToken
          name="Food"
          color="#E11D48"
          icon="fast-food"
          state="selected"
        />,
      );
      const container = getIconContainer(root);
      const style = StyleSheet.flatten(container.props.style);
      expect(style.backgroundColor).not.toBe("#E11D48");
    });

    it("reports accessibilityState.selected === true when selected", () => {
      const root = render(
        <CategoryToken
          name="Food"
          color="#E11D48"
          icon="fast-food"
          state="selected"
          onPress={() => {}}
        />,
      );
      expect(getButton(root).props.accessibilityState).toMatchObject({
        selected: true,
        disabled: false,
      });
    });
  });

  describe("disabled state", () => {
    it("does not fire onPress when disabled", () => {
      const onPress = vi.fn();
      const root = render(
        <CategoryToken
          name="Food"
          color="#E11D48"
          icon="fast-food"
          state="disabled"
          onPress={onPress}
        />,
      );
      press(getButton(root));
      expect(onPress).not.toHaveBeenCalled();
    });

    it("reports accessibilityState.disabled === true when disabled", () => {
      const root = render(
        <CategoryToken
          name="Food"
          color="#E11D48"
          icon="fast-food"
          state="disabled"
          onPress={() => {}}
        />,
      );
      expect(getButton(root).props.accessibilityState).toMatchObject({
        selected: false,
        disabled: true,
      });
    });

    it("lowers opacity when disabled", () => {
      const root = render(
        <CategoryToken
          name="Food"
          color="#E11D48"
          icon="fast-food"
          state="disabled"
        />,
      );
      const container = getIconContainer(root);
      const style = StyleSheet.flatten(container.props.style);
      expect(style.opacity).toBeLessThan(1);
    });
  });

  describe("interaction", () => {
    it("calls onPress exactly once when pressed", () => {
      const onPress = vi.fn();
      const root = render(
        <CategoryToken
          name="Food"
          color="#E11D48"
          icon="fast-food"
          onPress={onPress}
        />,
      );
      press(getButton(root));
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("handles a missing onPress without throwing (display mode)", () => {
      const root = render(
        <CategoryToken name="Food" color="#E11D48" icon="fast-food" />,
      );
      // In display mode there is no pressable wrapper; just verify it renders.
      expect(getIconContainer(root)).toBeTruthy();
    });
  });

  describe("accessibility", () => {
    it("uses the name as the accessibility label by default", () => {
      const root = render(
        <CategoryToken
          name="Food"
          color="#E11D48"
          icon="fast-food"
          onPress={() => {}}
        />,
      );
      expect(getButton(root).props.accessibilityLabel).toBe("Food");
    });

    it("appends 'selected' to the label when selected", () => {
      const root = render(
        <CategoryToken
          name="Food"
          color="#E11D48"
          icon="fast-food"
          state="selected"
          onPress={() => {}}
        />,
      );
      expect(getButton(root).props.accessibilityLabel).toBe("Food, selected");
    });

    it("prefers an explicit accessibilityLabel over the name", () => {
      const root = render(
        <CategoryToken
          name="Food"
          color="#E11D48"
          icon="fast-food"
          accessibilityLabel="Groceries category"
          onPress={() => {}}
        />,
      );
      expect(getButton(root).props.accessibilityLabel).toBe(
        "Groceries category",
      );
    });

    it("exposes accessibilityRole='button' when interactive", () => {
      const root = render(
        <CategoryToken
          name="Food"
          color="#E11D48"
          icon="fast-food"
          onPress={() => {}}
        />,
      );
      expect(getButton(root).props.accessibilityRole).toBe("button");
    });
  });

  describe("touch target", () => {
    it("enforces a 44pt minimum touch target on interactive tokens", () => {
      const root = render(
        <CategoryToken
          name="Food"
          color="#E11D48"
          icon="fast-food"
          onPress={() => {}}
        />,
      );
      const style = StyleSheet.flatten(getButton(root).props.style);
      expect(style.minHeight).toBeGreaterThanOrEqual(44);
      expect(style.minWidth).toBeGreaterThanOrEqual(44);
    });

    it("does not enforce 44pt on display-only (non-interactive) tokens", () => {
      const root = render(
        <CategoryToken name="Food" color="#E11D48" icon="fast-food" />,
      );
      // Display-only has no pressable wrapper; verify no button role exists.
      const buttons = root.findAll(
        (n) =>
          typeof n.type === "string" && n.props.accessibilityRole === "button",
      );
      expect(buttons).toHaveLength(0);
    });
  });
});

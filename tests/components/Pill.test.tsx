import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";
import { StyleSheet, Text } from "react-native";

import { Pill } from "@/components/ui/Pill";
import { FilterChipGroup } from "@/components/ui/FilterChipGroup";

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

/** Simulate a press by invoking the host node's `onPress`. */
function press(node: ReactTestInstance): void {
  act(() => {
    node.props.onPress?.();
  });
}

/** The pressable pill host node (carries role/label/state/onPress). */
function getPill(root: ReactTestInstance): ReactTestInstance {
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
  return root.findAll(
    (n) => String(n.type) === "Text" && textOf(n) === text,
  );
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

describe("Pill", () => {
  describe("rendering", () => {
    it("renders a pill with its label", () => {
      const root = render(<Pill label="Filter" />);
      expect(getByText(root, "Filter")).toBeTruthy();
    });

    it("exposes accessibilityRole='button'", () => {
      const root = render(<Pill label="Filter" />);
      expect(getPill(root).props.accessibilityRole).toBe("button");
    });

    it("renders selected and unselected states without throwing", () => {
      const root1 = render(<Pill label="Off" selected={false} />);
      expect(getByText(root1, "Off")).toBeTruthy();
      act(() => renderer?.unmount());

      const root2 = render(<Pill label="On" selected={true} />);
      expect(getByText(root2, "On")).toBeTruthy();
    });

    it("enforces a 44pt minimum touch height", () => {
      const root = render(<Pill label="Tall" />);
      const style = StyleSheet.flatten(getPill(root).props.style);
      expect(style.minHeight).toBeGreaterThanOrEqual(44);
    });

    it("has full radius applied via the resolved style (not just className)", () => {
      const root = render(<Pill label="Round" />);
      const style = StyleSheet.flatten(getPill(root).props.style);
      // NativeWind className is dropped on the Animated(Pressable) on web, so
      // the full radius must be on the style prop to actually render.
      expect(style.borderRadius).toBeGreaterThanOrEqual(999);
    });

    it("applies horizontal padding via the resolved style", () => {
      const root = render(<Pill label="Padded" />);
      const style = StyleSheet.flatten(getPill(root).props.style);
      expect(style.paddingHorizontal).toBeGreaterThan(0);
    });

    it("renders a count badge when count > 0", () => {
      const root = render(<Pill label="Filter" count={5} />);
      expect(getByText(root, "5")).toBeTruthy();
    });

    it("hides count badge when count is 0", () => {
      const root = render(<Pill label="Filter" count={0} />);
      expect(queryText(root, "0")).toHaveLength(0);
    });

    it("renders a leftIcon alongside the label", () => {
      const root = render(
        <Pill label="With icon" leftIcon={<Text>★</Text>} />,
      );
      expect(getByText(root, "★")).toBeTruthy();
      expect(getByText(root, "With icon")).toBeTruthy();
    });
  });

  describe("interaction", () => {
    it("calls onPress exactly once when pressed", () => {
      const onPress = vi.fn();
      const root = render(<Pill label="Press me" onPress={onPress} />);
      press(getPill(root));
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("does not call onPress when disabled", () => {
      const onPress = vi.fn();
      const root = render(
        <Pill label="Disabled" onPress={onPress} disabled />,
      );
      press(getPill(root));
      expect(onPress).not.toHaveBeenCalled();
    });

    it("handles a missing onPress without throwing", () => {
      const root = render(<Pill label="No handler" />);
      expect(() => press(getPill(root))).not.toThrow();
    });
  });

  describe("accessibility", () => {
    it("reflects accessibilityState.selected when selected", () => {
      const root = render(<Pill label="Selected" selected />);
      expect(getPill(root).props.accessibilityState).toMatchObject({
        selected: true,
        disabled: false,
      });
    });

    it("reflects accessibilityState.selected when unselected", () => {
      const root = render(<Pill label="Unselected" selected={false} />);
      expect(getPill(root).props.accessibilityState).toMatchObject({
        selected: false,
        disabled: false,
      });
    });

    it("reflects accessibilityState.disabled when disabled", () => {
      const root = render(<Pill label="Disabled" disabled />);
      expect(getPill(root).props.accessibilityState).toMatchObject({
        selected: false,
        disabled: true,
      });
    });

    it("uses the visible label as the accessibility label by default", () => {
      const root = render(<Pill label="Auto label" />);
      expect(getPill(root).props.accessibilityLabel).toBe("Auto label");
    });

    it("prefers an explicit accessibilityLabel over the visible label", () => {
      const root = render(
        <Pill label="Visible" accessibilityLabel="Hidden description" />,
      );
      expect(getPill(root).props.accessibilityLabel).toBe("Hidden description");
      expect(getByText(root, "Visible")).toBeTruthy();
    });
  });

  describe("states", () => {
    it("applies primary background when selected", () => {
      const root = render(<Pill label="Active" selected />);
      const style = StyleSheet.flatten(getPill(root).props.style);
      expect(style.backgroundColor).toBe(mockColors.primary);
    });

    it("applies surface background when unselected", () => {
      const root = render(<Pill label="Inactive" selected={false} />);
      const style = StyleSheet.flatten(getPill(root).props.style);
      expect(style.backgroundColor).toBe(mockColors.surface);
    });

    it("lowers opacity when disabled", () => {
      const root = render(<Pill label="Dimmed" disabled />);
      const style = StyleSheet.flatten(getPill(root).props.style);
      expect(style.opacity).toBeLessThan(1);
    });
  });
});

describe("FilterChipGroup", () => {
  const options = [
    { value: "all", label: "All" },
    { value: "income", label: "Income" },
    { value: "expense", label: "Expense" },
  ];

  describe("single select (segment mode)", () => {
    it("renders all options", () => {
      const root = render(
        <FilterChipGroup
          mode="single"
          options={options}
          value="all"
          onChange={() => {}}
        />,
      );
      expect(getByText(root, "All")).toBeTruthy();
      expect(getByText(root, "Income")).toBeTruthy();
      expect(getByText(root, "Expense")).toBeTruthy();
    });

    it("marks the current value as selected", () => {
      const root = render(
        <FilterChipGroup
          mode="single"
          options={options}
          value="income"
          onChange={() => {}}
        />,
      );
      const pills = root.findAll(
        (n) => typeof n.type === "string" && n.props.accessibilityRole === "button",
      );
      const incomePill = pills.find((p) =>
        p.findAll((n) => String(n.type) === "Text" && textOf(n) === "Income").length > 0,
      );
      expect(incomePill).toBeTruthy();
      expect(incomePill!.props.accessibilityState.selected).toBe(true);
    });

    it("calls onChange with the new value when a different pill is pressed", () => {
      const onChange = vi.fn();
      const root = render(
        <FilterChipGroup
          mode="single"
          options={options}
          value="all"
          onChange={onChange}
        />,
      );
      const pills = root.findAll(
        (n) => typeof n.type === "string" && n.props.accessibilityRole === "button",
      );
      const expensePill = pills.find((p) =>
        p.findAll((n) => String(n.type) === "Text" && textOf(n) === "Expense").length > 0,
      );
      press(expensePill!);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith("expense");
    });

    it("exposes radiogroup accessibility role in single mode", () => {
      const root = render(
        <FilterChipGroup
          mode="single"
          options={options}
          value="all"
          onChange={() => {}}
        />,
      );
      const group = root.find(
        (n) => typeof n.type === "string" && n.props.accessibilityRole === "radiogroup",
      );
      expect(group).toBeTruthy();
    });
  });

  describe("multi select (filter mode)", () => {
    it("toggles a value on when pressed", () => {
      const onChange = vi.fn();
      const root = render(
        <FilterChipGroup
          mode="multi"
          options={options}
          value={[]}
          onChange={onChange}
        />,
      );
      const pills = root.findAll(
        (n) => typeof n.type === "string" && n.props.accessibilityRole === "button",
      );
      const incomePill = pills.find((p) =>
        p.findAll((n) => String(n.type) === "Text" && textOf(n) === "Income").length > 0,
      );
      press(incomePill!);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(["income"]);
    });

    it("toggles a value off when pressed again", () => {
      const onChange = vi.fn();
      const root = render(
        <FilterChipGroup
          mode="multi"
          options={options}
          value={["income", "expense"]}
          onChange={onChange}
        />,
      );
      const pills = root.findAll(
        (n) => typeof n.type === "string" && n.props.accessibilityRole === "button",
      );
      const incomePill = pills.find((p) =>
        p.findAll((n) => String(n.type) === "Text" && textOf(n) === "Income").length > 0,
      );
      press(incomePill!);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(["expense"]);
    });

    it("allows multiple values to be selected", () => {
      const onChange = vi.fn();
      const root = render(
        <FilterChipGroup
          mode="multi"
          options={options}
          value={["income"]}
          onChange={onChange}
        />,
      );
      const pills = root.findAll(
        (n) => typeof n.type === "string" && n.props.accessibilityRole === "button",
      );
      const expensePill = pills.find((p) =>
        p.findAll((n) => String(n.type) === "Text" && textOf(n) === "Expense").length > 0,
      );
      press(expensePill!);
      expect(onChange).toHaveBeenCalledTimes(1);
      const callArg = onChange.mock.calls[0][0];
      expect(callArg).toContain("income");
      expect(callArg).toContain("expense");
      expect(callArg).toHaveLength(2);
    });

    it("does not expose radiogroup role in multi mode", () => {
      const root = render(
        <FilterChipGroup
          mode="multi"
          options={options}
          value={[]}
          onChange={() => {}}
        />,
      );
      const group = root.findAll(
        (n) => typeof n.type === "string" && n.props.accessibilityRole === "radiogroup",
      );
      expect(group).toHaveLength(0);
    });
  });

  describe("edge cases", () => {
    it("renders nothing without crashing when options is empty", () => {
      const root = render(
        <FilterChipGroup
          mode="single"
          options={[]}
          value={undefined}
          onChange={() => {}}
        />,
      );
      const pills = root.findAll(
        (n) => typeof n.type === "string" && n.props.accessibilityRole === "button",
      );
      expect(pills).toHaveLength(0);
    });

    it("respects per-option disabled state", () => {
      const opts = [
        { value: "a", label: "A" },
        { value: "b", label: "B", disabled: true },
      ];
      const onChange = vi.fn();
      const root = render(
        <FilterChipGroup
          mode="single"
          options={opts}
          value="a"
          onChange={onChange}
        />,
      );
      const pills = root.findAll(
        (n) => typeof n.type === "string" && n.props.accessibilityRole === "button",
      );
      const bPill = pills.find((p) =>
        p.findAll((n) => String(n.type) === "Text" && textOf(n) === "B").length > 0,
      );
      expect(bPill!.props.accessibilityState.disabled).toBe(true);
      press(bPill!);
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});

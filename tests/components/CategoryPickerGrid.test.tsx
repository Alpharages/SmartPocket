import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";

import { CategoryPickerGrid } from "@/components/ui/CategoryPickerGrid";
import type { Category } from "@/lib/expense-context";

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

/** Get all interactive tokens (radios) in the grid. */
function getTokens(root: ReactTestInstance): ReactTestInstance[] {
  return root.findAll(
    (n) => typeof n.type === "string" && n.props.accessibilityRole === "radio",
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

const mockCategories: Category[] = [
  {
    id: 1,
    userId: 1,
    name: "Food",
    type: "expense",
    color: "#E11D48",
    icon: "fast-food",
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 2,
    userId: 1,
    name: "Transport",
    type: "expense",
    color: "#2563EB",
    icon: "car",
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 3,
    userId: 1,
    name: "Salary",
    type: "income",
    color: "#059669",
    icon: "cash",
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe("CategoryPickerGrid", () => {
  describe("rendering", () => {
    it("renders all categories as tokens", () => {
      const root = render(
        <CategoryPickerGrid
          categories={mockCategories}
          selectedId={null}
          onSelect={() => {}}
        />,
      );
      expect(getTokens(root)).toHaveLength(3);
    });

    it("renders empty state when categories is empty", () => {
      const root = render(
        <CategoryPickerGrid
          categories={[]}
          selectedId={null}
          onSelect={() => {}}
          emptyText="No items"
        />,
      );
      expect(queryText(root, "No items")).toHaveLength(1);
      expect(getTokens(root)).toHaveLength(0);
    });

    it("uses default empty text when none provided", () => {
      const root = render(
        <CategoryPickerGrid
          categories={[]}
          selectedId={null}
          onSelect={() => {}}
        />,
      );
      expect(queryText(root, "No categories available")).toHaveLength(1);
    });

    it("exposes radiogroup accessibility role", () => {
      const root = render(
        <CategoryPickerGrid
          categories={mockCategories}
          selectedId={null}
          onSelect={() => {}}
        />,
      );
      const group = root.find(
        (n) =>
          typeof n.type === "string" &&
          n.props.accessibilityRole === "radiogroup",
      );
      expect(group).toBeTruthy();
      expect(group.props.accessibilityLabel).toBe("Category picker");
    });
  });

  describe("selection", () => {
    it("marks the selected category as selected", () => {
      const root = render(
        <CategoryPickerGrid
          categories={mockCategories}
          selectedId={2}
          onSelect={() => {}}
        />,
      );
      const tokens = getTokens(root);
      // Token at index 1 should be Transport (id=2)
      expect(tokens[1].props.accessibilityState.checked).toBe(true);
      expect(tokens[0].props.accessibilityState.checked).toBe(false);
      expect(tokens[2].props.accessibilityState.checked).toBe(false);
    });

    it("calls onSelect with the category id when pressed", () => {
      const onSelect = vi.fn();
      const root = render(
        <CategoryPickerGrid
          categories={mockCategories}
          selectedId={null}
          onSelect={onSelect}
        />,
      );
      const tokens = getTokens(root);
      press(tokens[0]);
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith(1);
    });
  });

  describe("recently-used ordering (AC3)", () => {
    it("floats recently-used categories to the front", () => {
      const transactions = [
        { categoryId: 3, date: new Date("2024-01-03") },
        { categoryId: 1, date: new Date("2024-01-02") },
        { categoryId: 2, date: new Date("2024-01-01") },
      ];
      const onSelect = vi.fn();
      const root = render(
        <CategoryPickerGrid
          categories={mockCategories}
          selectedId={null}
          onSelect={onSelect}
          transactions={transactions}
        />,
      );
      const tokens = getTokens(root);
      // Order should be: Salary (3), Food (1), Transport (2)
      press(tokens[0]);
      expect(onSelect).toHaveBeenCalledWith(3);
      press(tokens[1]);
      expect(onSelect).toHaveBeenCalledWith(1);
      press(tokens[2]);
      expect(onSelect).toHaveBeenCalledWith(2);
    });

    it("deduplicates recent category ids", () => {
      const transactions = [
        { categoryId: 1, date: new Date("2024-01-03") },
        { categoryId: 1, date: new Date("2024-01-02") },
        { categoryId: 2, date: new Date("2024-01-01") },
      ];
      const onSelect = vi.fn();
      const root = render(
        <CategoryPickerGrid
          categories={mockCategories}
          selectedId={null}
          onSelect={onSelect}
          transactions={transactions}
        />,
      );
      const tokens = getTokens(root);
      // Order should be: Food (1), Transport (2), Salary (3)
      press(tokens[0]);
      expect(onSelect).toHaveBeenCalledWith(1);
      press(tokens[1]);
      expect(onSelect).toHaveBeenCalledWith(2);
      press(tokens[2]);
      expect(onSelect).toHaveBeenCalledWith(3);
    });

    it("respects recentLimit", () => {
      const transactions = [
        { categoryId: 3, date: new Date("2024-01-03") },
        { categoryId: 1, date: new Date("2024-01-02") },
        { categoryId: 2, date: new Date("2024-01-01") },
      ];
      const onSelect = vi.fn();
      const root = render(
        <CategoryPickerGrid
          categories={mockCategories}
          selectedId={null}
          onSelect={onSelect}
          transactions={transactions}
          recentLimit={1}
        />,
      );
      const tokens = getTokens(root);
      // Only the most recent (Salary, id=3) should float
      press(tokens[0]);
      expect(onSelect).toHaveBeenCalledWith(3);
      press(tokens[1]);
      expect(onSelect).toHaveBeenCalledWith(1);
      press(tokens[2]);
      expect(onSelect).toHaveBeenCalledWith(2);
    });

    it("falls back to original order when no transactions provided", () => {
      const onSelect = vi.fn();
      const root = render(
        <CategoryPickerGrid
          categories={mockCategories}
          selectedId={null}
          onSelect={onSelect}
        />,
      );
      const tokens = getTokens(root);
      press(tokens[0]);
      expect(onSelect).toHaveBeenCalledWith(1);
      press(tokens[1]);
      expect(onSelect).toHaveBeenCalledWith(2);
      press(tokens[2]);
      expect(onSelect).toHaveBeenCalledWith(3);
    });

    it("is a no-op when transactions is empty", () => {
      const onSelect = vi.fn();
      const root = render(
        <CategoryPickerGrid
          categories={mockCategories}
          selectedId={null}
          onSelect={onSelect}
          transactions={[]}
        />,
      );
      const tokens = getTokens(root);
      press(tokens[0]);
      expect(onSelect).toHaveBeenCalledWith(1);
    });
  });

  describe("edge cases", () => {
    it("handles categories with missing icons gracefully", () => {
      const categories: Category[] = [
        {
          id: 1,
          userId: 1,
          name: "Misc",
          type: "expense",
          color: "#6B7280",
          icon: "",
          isDefault: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      const root = render(
        <CategoryPickerGrid
          categories={categories}
          selectedId={null}
          onSelect={() => {}}
        />,
      );
      expect(getTokens(root)).toHaveLength(1);
    });

    it("handles zero transactions gracefully", () => {
      const root = render(
        <CategoryPickerGrid
          categories={mockCategories}
          selectedId={null}
          onSelect={() => {}}
          transactions={[]}
        />,
      );
      expect(getTokens(root)).toHaveLength(3);
    });
  });
});

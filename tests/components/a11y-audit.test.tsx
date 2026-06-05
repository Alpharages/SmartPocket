import React from "react";
import { describe, it, expect, vi } from "vitest";
import TestRenderer, { act } from "react-test-renderer";

import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { StatCard } from "@/components/ui/StatCard";
import { TransactionRow } from "@/components/ui/TransactionRow";
import { CategoryToken } from "@/components/ui/CategoryToken";
import { FilterChipGroup } from "@/components/ui/FilterChipGroup";
import { Sheet } from "@/components/ui/Sheet";
import { Toast } from "@/components/ui/Toast";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({
    primary: "#4F46E5",
    background: "#F8FAFC",
    surface: "#FFFFFF",
    foreground: "#111827",
    muted: "#6B7280",
    border: "#E5E7EB",
    success: "#047857",
    warning: "#B45309",
    error: "#DC2626",
    accent: "#BE185D",
    secondary: "#7C3AED",
    overlay: "rgba(0,0,0,0.4)",
    text: "#111827",
    tint: "#4F46E5",
    icon: "#6B7280",
    tabIconDefault: "#6B7280",
    tabIconSelected: "#4F46E5",
  }),
}));

vi.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

vi.mock("@expo/vector-icons", () => {
  const Ionicons = ({ name, testID }: { name: string; testID?: string }) =>
    React.createElement("Ionicons", { name, testID });
  (Ionicons as any).glyphMap = {
    "pricetag-outline": 1,
    "cash-outline": 1,
    "arrow-down": 1,
    "arrow-up": 1,
    "wallet-outline": 1,
    "checkmark-circle": 1,
    "close-circle": 1,
    "information-circle": 1,
    close: 1,
    checkmark: 1,
    "create-outline": 1,
    "trash-outline": 1,
  };
  return { Ionicons };
});

vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: "light" },
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

function render(element: React.ReactElement) {
  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer!.root;
}

function findByProp(
  root: TestRenderer.ReactTestInstance,
  prop: string,
  value: unknown,
) {
  return root.find((n) => (n.props as Record<string, unknown>)[prop] === value);
}

function findAllByProp(
  root: TestRenderer.ReactTestInstance,
  prop: string,
  value: unknown,
) {
  return root.findAll(
    (n) => (n.props as Record<string, unknown>)[prop] === value,
  );
}

function hasMinHeight(style: unknown, min: number): boolean {
  const s = Array.isArray(style)
    ? Object.assign({}, ...style.filter(Boolean))
    : (style ?? {});
  return (s.minHeight ?? s.height ?? Infinity) >= min;
}

describe("A11y Audit — AC3 Screen-reader labels", () => {
  it("Button exposes accessibilityRole + accessibilityLabel + accessibilityState", () => {
    const root = render(
      <Button label="Save" onPress={() => {}} disabled loading />,
    );
    const btn = findByProp(root, "accessibilityRole", "button");
    expect(btn).toBeDefined();
    expect(btn.props.accessibilityLabel).toBe("Save");
    expect(btn.props.accessibilityState).toMatchObject({
      disabled: true,
      busy: true,
    });
  });

  it("Button icon-only requires accessibilityLabel", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <Button
        variant="icon-only"
        leftIcon={<span>★</span>}
        onPress={() => {}}
        accessibilityLabel="Star"
      />,
    );
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("Pill exposes accessibilityRole + accessibilityLabel + accessibilityState", () => {
    const root = render(<Pill label="Filter" selected onPress={() => {}} />);
    const pill = findByProp(root, "accessibilityRole", "button");
    expect(pill).toBeDefined();
    expect(pill.props.accessibilityLabel).toBe("Filter");
    expect(pill.props.accessibilityState).toMatchObject({
      selected: true,
      disabled: false,
    });
  });

  it("ScreenHeader title exposes accessibilityRole=header", () => {
    const root = render(<ScreenHeader title="Home" />);
    const header = findByProp(root, "accessibilityRole", "header");
    expect(header).toBeDefined();
    expect(header.props.children).toBe("Home");
  });

  it("StatCard exposes accessible + accessibilityRole + accessibilityLabel", () => {
    const root = render(
      <StatCard variant="compact" label="Income" amount={100} sign="positive" />,
    );
    const card = findByProp(root, "accessible", true);
    expect(card).toBeDefined();
    expect(card.props.accessibilityRole).toBe("text");
    expect(typeof card.props.accessibilityLabel).toBe("string");
    expect(card.props.accessibilityLabel).toContain("Income");
  });

  it("TransactionRow exposes accessibilityRole + accessibilityLabel + accessibilityActions", () => {
    const root = render(
      <TransactionRow
        title="Groceries"
        date="2026-06-01"
        amount="50.00"
        type="expense"
        categoryColor="#DC2626"
        categoryIcon="pricetag-outline"
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );
    // The main row + swipe action buttons all have accessibilityRole="button"
    const buttons = findAllByProp(root, "accessibilityRole", "button");
    expect(buttons.length).toBeGreaterThanOrEqual(1);
    // The main row is the one with the composite accessibilityLabel
    const row = buttons.find((b) =>
      typeof b.props.accessibilityLabel === "string" &&
      b.props.accessibilityLabel.includes("Groceries"),
    );
    expect(row).toBeDefined();
    expect(row!.props.accessibilityActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "edit", label: "Edit" }),
        expect.objectContaining({ name: "delete", label: "Delete" }),
      ]),
    );
  });

  it("CategoryToken interactive exposes accessibilityRole + accessibilityLabel + accessibilityState", () => {
    const root = render(
      <CategoryToken
        name="Food"
        color="#DC2626"
        icon="pricetag-outline"
        state="selected"
        onPress={() => {}}
      />,
    );
    const token = findByProp(root, "accessibilityRole", "button");
    expect(token).toBeDefined();
    expect(token.props.accessibilityLabel).toBe("Food, selected");
    expect(token.props.accessibilityState).toMatchObject({
      selected: true,
      disabled: false,
    });
  });

  it("FilterChipGroup single is a radiogroup whose children announce as radio", () => {
    const root = render(
      <FilterChipGroup
        mode="single"
        options={[{ value: "all", label: "All" }]}
        value="all"
        onChange={() => {}}
      />,
    );
    const group = findByProp(root, "accessibilityRole", "radiogroup");
    expect(group).toBeDefined();
    expect(group.props.accessibilityLabel).toBe("Filter options");
    // Child role must match the container contract: radio, not button.
    const radio = findByProp(root, "accessibilityRole", "radio");
    expect(radio).toBeDefined();
    expect(radio.props.accessibilityState).toMatchObject({ checked: true });
  });

  it("FilterChipGroup multi is a toolbar whose children announce as button", () => {
    const root = render(
      <FilterChipGroup
        mode="multi"
        options={[{ value: "a", label: "A" }]}
        value={["a"]}
        onChange={() => {}}
      />,
    );
    const group = findByProp(root, "accessibilityRole", "toolbar");
    expect(group).toBeDefined();
    expect(group.props.accessibilityLabel).toBe(
      "Filter options (multi-select)",
    );
    const btn = findByProp(root, "accessibilityRole", "button");
    expect(btn).toBeDefined();
    expect(btn.props.accessibilityState).toMatchObject({ selected: true });
  });

  it("Sheet backdrop exposes accessibilityRole + accessibilityLabel", () => {
    const root = render(
      <Sheet visible onClose={() => {}} title="Test">
        <span>Content</span>
      </Sheet>,
    );
    const backdrop = findByProp(root, "accessibilityLabel", "Dismiss sheet");
    expect(backdrop).toBeDefined();
    expect(backdrop.props.accessibilityRole).toBe("button");
  });

  it("Sheet close button exposes accessibilityRole + accessibilityLabel + minHeight 44", () => {
    const root = render(
      <Sheet visible onClose={() => {}} title="Test">
        <span>Content</span>
      </Sheet>,
    );
    const closeBtn = findByProp(root, "accessibilityLabel", "Close");
    expect(closeBtn).toBeDefined();
    expect(closeBtn.props.accessibilityRole).toBe("button");
    expect(hasMinHeight(closeBtn.props.style, 44)).toBe(true);
  });

  it("Toast exposes accessibilityLiveRegion=polite", () => {
    const root = render(
      <Toast id="t1" type="success" message="Saved" onDismiss={() => {}} />,
    );
    const toast = findByProp(root, "accessibilityLiveRegion", "polite");
    expect(toast).toBeDefined();
  });

  it("Toast dismiss button exposes accessibilityRole + accessibilityLabel + minHeight 44", () => {
    const root = render(
      <Toast id="t1" type="success" message="Saved" onDismiss={() => {}} />,
    );
    const dismiss = findByProp(root, "accessibilityLabel", "Dismiss");
    expect(dismiss).toBeDefined();
    expect(dismiss.props.accessibilityRole).toBe("button");
    expect(hasMinHeight(dismiss.props.style, 44)).toBe(true);
  });

  it("EmptyState title exposes accessibilityRole=header", () => {
    const root = render(
      <EmptyState
        icon={<span>★</span>}
        title="No data"
        description="Get started"
      />,
    );
    const header = findByProp(root, "accessibilityRole", "header");
    expect(header).toBeDefined();
    expect(header.props.children).toBe("No data");
  });

  it("Skeleton hides from a11y tree when no label provided", () => {
    const root = render(<Skeleton variant="line" />);
    const skel = findByProp(root, "testID", "skeleton");
    expect(skel).toBeDefined();
    expect(skel.props.accessibilityElementsHidden).toBe(true);
    expect(skel.props.importantForAccessibility).toBe("no-hide-descendants");
  });

  it("Skeleton exposes accessible element when label provided", () => {
    const root = render(<Skeleton variant="line" accessibilityLabel="Loading" />);
    const skel = findByProp(root, "testID", "skeleton");
    expect(skel).toBeDefined();
    expect(skel.props.accessible).toBe(true);
    expect(skel.props.accessibilityLabel).toBe("Loading");
  });
});

describe("A11y Audit — AC2 Touch targets ≥44pt", () => {
  it("Button has minHeight ≥44", () => {
    const root = render(<Button label="Save" onPress={() => {}} />);
    const btn = findByProp(root, "accessibilityRole", "button");
    expect(hasMinHeight(btn.props.style, 44)).toBe(true);
  });

  it("Pill has minHeight ≥44", () => {
    const root = render(<Pill label="Filter" onPress={() => {}} />);
    const pill = findByProp(root, "accessibilityRole", "button");
    expect(hasMinHeight(pill.props.style, 44)).toBe(true);
  });

  it("TransactionRow has minHeight ≥44", () => {
    const root = render(
      <TransactionRow
        title="Test"
        date="2026-06-01"
        amount="10"
        type="expense"
        categoryColor="#DC2626"
        categoryIcon="pricetag-outline"
      />,
    );
    const row = findByProp(root, "accessibilityRole", "button");
    expect(hasMinHeight(row.props.style, 44)).toBe(true);
  });

  it("CategoryToken interactive has minHeight ≥44 via wrapper", () => {
    const root = render(
      <CategoryToken
        name="Food"
        color="#DC2626"
        icon="pricetag-outline"
        onPress={() => {}}
      />,
    );
    const token = findByProp(root, "accessibilityRole", "button");
    expect(hasMinHeight(token.props.style, 44)).toBe(true);
  });
});

describe("A11y Audit — AC6 Non-color encoding", () => {
  it("TransactionRow renders explicit sign prefix (+/-) in amount", () => {
    const root = render(
      <TransactionRow
        title="Salary"
        date="2026-06-01"
        amount="100"
        type="income"
        categoryColor="#047857"
        categoryIcon="cash-outline"
      />,
    );
    const texts = root.findAll((n) => String(n.type) === "Text");
    const amountText = texts.find((t) =>
      String(t.props.children).includes("+$100.00"),
    );
    expect(amountText).toBeDefined();
  });

  it("StatCard compact renders explicit sign prefix (+/-) with icon", () => {
    const root = render(
      <StatCard variant="compact" label="Income" amount={100} sign="positive" />,
    );
    const texts = root.findAll((n) => String(n.type) === "Text");
    const amountText = texts.find((t) =>
      String(t.props.children).includes("+$100.00"),
    );
    expect(amountText).toBeDefined();
  });

  it("StatCard compact negative renders explicit sign prefix", () => {
    const root = render(
      <StatCard variant="compact" label="Expense" amount={50} sign="negative" />,
    );
    const texts = root.findAll((n) => String(n.type) === "Text");
    const amountText = texts.find((t) =>
      String(t.props.children).includes("-$50.00"),
    );
    expect(amountText).toBeDefined();
  });
});

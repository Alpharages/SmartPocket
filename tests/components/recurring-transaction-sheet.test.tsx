import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TestRenderer, { act, type ReactTestRenderer } from "react-test-renderer";

import { RecurringTransactionSheet } from "@/components/ui/RecurringTransactionSheet";
import { useExpense } from "@/lib/expense-context";

vi.mock("@/lib/expense-context", () => ({
  useExpense: vi.fn(),
}));

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ show: vi.fn() }),
}));

vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: "light" },
}));

vi.mock("@expo/vector-icons", () => {
  const Ionicons = ({ name, testID }: { name: string; testID?: string }) =>
    React.createElement("Ionicons", { name, testID });
  (Ionicons as any).glyphMap = {
    "grid-outline": 1,
    "fast-food-outline": 1,
    remove: 1,
    add: 1,
    close: 1,
  };
  return { Ionicons };
});

const mockColors = {
  primary: "#4F46E5",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  foreground: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  success: "#059669",
  error: "#DC2626",
  overlay: "rgba(0,0,0,0.4)",
  warning: "#D97706",
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

vi.mock("@/lib/theme-provider", () => ({
  useThemeTokens: () => ({ colors: mockColors }),
}));

vi.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

vi.mock("@/lib/currency-provider", () => ({
  useCurrency: () => ({ currency: "USD" }),
}));

vi.mock("@/lib/currency", () => ({
  getCurrencySymbol: () => "$",
}));

const TOKENS = vi.hoisted(() => ({
  Radius: { sm: 8, md: 12, lg: 16, full: 9999 },
  Spacing: { sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32, xs: 4 },
  Typography: {
    body: { fontSize: 14, lineHeight: 20, fontWeight: "400" },
    caption: { fontSize: 12, lineHeight: 16, fontWeight: "400" },
    h2: { fontSize: 24, lineHeight: 32, fontWeight: "700" },
    h3: { fontSize: 18, lineHeight: 26, fontWeight: "600" },
    label: { fontSize: 13, lineHeight: 18, fontWeight: "500" },
  },
}));

vi.mock("@/constants/theme", () => ({
  resolveCategoryColor: (color: string) => color,
  CATEGORY_COLOR_LIGHT_VALUES: ["#4F46E5"],
  CATEGORY_DEFAULT_COLOR: "#4F46E5",
  resolveCategoryIcon: (icon?: string | null) =>
    !icon || icon === "tag" ? "pricetag-outline" : icon,
  DEFAULT_CATEGORY_ICON: "pricetag-outline",
  ...TOKENS,
}));

vi.mock("@/lib/_core/theme", () => ({
  // Bottom clearance for the floating tab bar (SP-062).
  TAB_BAR_CLEARANCE: 128,
  getElevationStyle: () => ({}),
  ...TOKENS,
  Motion: {
    press: { scale: 0.97, durationMs: 120 },
    sheet: { durationMs: 0, closeDurationMs: 0, backdropOpacity: 0.6 },
    screen: { durationMs: 280, easing: "easeOutCubic" },
    countUp: { durationMs: 700, easing: "easeOut" },
    celebration: { durationMs: 220, scaleFrom: 0.85, easing: "easeOutBack" },
    fade: { durationMs: 200 },
  },
  Elevation: {
    card: { shadowColor: "#000", shadowOpacity: 0.1, elevation: 2 },
  },
  ContentMaxWidth: { modal: 560 },
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 34, left: 0 }),
}));

function findByLabel(tree: ReactTestRenderer, label: string) {
  return tree.root.findAll(
    (node) =>
      node.props?.accessibilityLabel === label ||
      node.props?.["aria-label"] === label,
  );
}

function textOf(node: { children?: unknown[] }): string {
  return (node.children ?? [])
    .map((c) =>
      typeof c === "string" ? c : textOf(c as { children?: unknown[] }),
    )
    .join("");
}

function findText(tree: ReactTestRenderer, text: string) {
  return tree.root.findAll(
    (node) => String(node.type) === "Text" && textOf(node).includes(text),
  );
}

describe("RecurringTransactionSheet", () => {
  const addRecurringTransaction = vi.fn().mockResolvedValue(undefined);
  const updateRecurringTransaction = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    addRecurringTransaction.mockClear();
    updateRecurringTransaction.mockClear();
    vi.mocked(useExpense).mockReturnValue({
      categories: [
        {
          id: 1,
          userId: 1,
          name: "Rent",
          type: "expense",
          color: "#4F46E5",
          icon: "home-outline",
          isDefault: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      creditCards: [],
      addRecurringTransaction,
      updateRecurringTransaction,
    } as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("blocks submit with invalid amount and shows inline error", async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <RecurringTransactionSheet visible onClose={vi.fn()} />,
      );
    });

    const amountInput = findByLabel(tree, "Recurring amount")[0];
    await act(async () => {
      amountInput.props.onChangeText("1.999");
    });

    const createButton = tree.root.findByProps({ label: "Create" });
    expect(createButton.props.disabled).not.toBe(true);

    await act(async () => {
      await createButton.props.onPress();
    });

    expect(addRecurringTransaction).not.toHaveBeenCalled();
    expect(findText(tree, "Enter a valid amount").length).toBeGreaterThan(0);
  });

  it("blocks submit without category and shows inline error", async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <RecurringTransactionSheet visible onClose={vi.fn()} />,
      );
    });

    await act(async () => {
      findByLabel(tree, "Recurring amount")[0].props.onChangeText("50.00");
    });

    const createButton = tree.root.findByProps({ label: "Create" });
    await act(async () => {
      await createButton.props.onPress();
    });

    expect(addRecurringTransaction).not.toHaveBeenCalled();
    expect(findText(tree, "Select a category").length).toBeGreaterThan(0);
  });

  it("keeps the sheet open when create mutation fails (AC8)", async () => {
    addRecurringTransaction.mockRejectedValueOnce(new Error("network"));
    const onClose = vi.fn();

    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <RecurringTransactionSheet visible onClose={onClose} />,
      );
    });

    await act(async () => {
      findByLabel(tree, "Recurring amount")[0].props.onChangeText("50.00");
      tree.root.findByProps({ accessibilityLabel: "Rent" }).props.onPress();
    });

    const createButton = tree.root.findByProps({ label: "Create" });
    await act(async () => {
      await createButton.props.onPress();
    });

    expect(addRecurringTransaction).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(findByLabel(tree, "Recurring amount")[0].props.value).toBe("50.00");
  });

  it("calls create with validated payload on save", async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <RecurringTransactionSheet
          visible
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />,
      );
    });

    await act(async () => {
      findByLabel(tree, "Recurring amount")[0].props.onChangeText("50.00");
      tree.root.findByProps({ accessibilityLabel: "Rent" }).props.onPress();
    });

    const createButton = tree.root.findByProps({ label: "Create" });
    await act(async () => {
      await createButton.props.onPress();
    });

    expect(addRecurringTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: "50.00",
        categoryId: 1,
        type: "expense",
        frequency: "monthly",
        interval: 1,
        endCondition: "never",
      }),
    );
  });
});

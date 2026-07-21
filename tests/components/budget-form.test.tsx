import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";

import { isPositiveBudgetAmount } from "@/lib/budget-validation";
import { useExpense } from "@/lib/expense-context";
import { BudgetFormSheet } from "@/components/budgets/BudgetFormSheet";

vi.mock("@/lib/expense-context", () => ({
  useExpense: vi.fn(),
}));

vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: "light" },
}));

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ show: vi.fn() }),
}));

vi.mock("@expo/vector-icons", () => {
  const Ionicons = ({ name, testID }: { name: string; testID?: string }) =>
    React.createElement("Ionicons", { name, testID });
  (Ionicons as any).glyphMap = {
    "grid-outline": 1,
    "fast-food-outline": 1,
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
  CATEGORY_COLOR_LIGHT_VALUES: ["#4F46E5", "#047857", "#E11D48"],
  CATEGORY_DEFAULT_COLOR: "#4F46E5",
  resolveCategoryIcon: (icon?: string | null) =>
    !icon || icon === "tag" ? "pricetag-outline" : icon,
  DEFAULT_CATEGORY_ICON: "pricetag-outline",
  ...TOKENS,
}));

vi.mock("@/lib/_core/theme", () => ({
  getElevationStyle: () => ({}),
  ...TOKENS,
  Motion: {
    sheet: { durationMs: 300, closeDurationMs: 250 },
    fade: { durationMs: 200 },
  },
  Elevation: {
    card: { shadowColor: "#000", shadowOpacity: 0.1, elevation: 2 },
  },
  ContentMaxWidth: {
    dashboard: 1120,
    screen: 960,
    sheet: 560,
    modal: 640,
    card: 420,
  },
}));

const mockExpenseCategory = {
  id: 10,
  userId: 1,
  name: "Food",
  type: "expense" as const,
  color: "#E11D48",
  icon: "fast-food-outline",
  isDefault: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockAddBudget = vi.fn().mockResolvedValue(undefined);
const mockUpdateBudget = vi.fn().mockResolvedValue(undefined);
const mockOnClose = vi.fn();
const mockOnSaved = vi.fn();

const baseExpenseContext = {
  categories: [mockExpenseCategory],
  transactions: [],
  addBudget: mockAddBudget,
  updateBudget: mockUpdateBudget,
};

let renderer: ReactTestRenderer | null = null;

function renderForm(): ReactTestInstance {
  (useExpense as ReturnType<typeof vi.fn>).mockReturnValue(baseExpenseContext);
  act(() => {
    renderer = TestRenderer.create(
      <BudgetFormSheet onClose={mockOnClose} onSaved={mockOnSaved} />,
    );
  });
  return renderer!.root;
}

function findByTestId(
  root: ReactTestInstance,
  testID: string,
): ReactTestInstance {
  return root.findByProps({ testID });
}

function collectText(node: ReactTestInstance | string): string {
  if (typeof node === "string") return node;
  return (node.children ?? [])
    .map((child) => collectText(child as ReactTestInstance))
    .join("");
}

function findAllByRole(
  root: ReactTestInstance,
  role: string,
): ReactTestInstance[] {
  return root.findAll(
    (node) =>
      (node.props as { accessibilityRole?: string; role?: string })
        .accessibilityRole === role ||
      (node.props as { role?: string }).role === role,
  );
}

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = null;
  vi.clearAllMocks();
});

describe("isPositiveBudgetAmount", () => {
  it("accepts positive amounts with up to two decimals", () => {
    expect(isPositiveBudgetAmount("0.01")).toBe(true);
    expect(isPositiveBudgetAmount("100")).toBe(true);
    expect(isPositiveBudgetAmount("100.50")).toBe(true);
  });

  it("rejects zero, empty, and invalid formats", () => {
    expect(isPositiveBudgetAmount("0")).toBe(false);
    expect(isPositiveBudgetAmount("0.00")).toBe(false);
    expect(isPositiveBudgetAmount("")).toBe(false);
    expect(isPositiveBudgetAmount("1.999")).toBe(false);
  });
});

describe("BudgetFormSheet", () => {
  beforeEach(() => {
    mockAddBudget.mockClear();
    mockUpdateBudget.mockClear();
    mockOnClose.mockClear();
    mockOnSaved.mockClear();
  });

  it("disables save when amount is not positive", () => {
    const root = renderForm();
    expect(findByTestId(root, "budget-save-button").props.disabled).toBe(true);
  });

  it("calls addBudget when creating a valid budget", async () => {
    const root = renderForm();

    act(() => {
      findByTestId(root, "budget-amount-input").props.onChangeText("100");
    });

    const foodChip = findAllByRole(root, "radio").find((node) =>
      collectText(node).includes("Food"),
    );
    expect(foodChip).toBeTruthy();
    act(() => {
      foodChip!.props.onPress();
    });

    await act(async () => {
      await findByTestId(root, "budget-save-button").props.onPress();
    });

    expect(mockAddBudget).toHaveBeenCalledWith({
      categoryId: 10,
      period: "monthly",
      amount: "100",
    });
    expect(mockOnSaved).toHaveBeenCalled();
  });

  it("surfaces server errors inline", async () => {
    mockAddBudget.mockRejectedValueOnce(
      new Error(
        "An active budget already exists for this category and period.",
      ),
    );

    const root = renderForm();

    act(() => {
      findByTestId(root, "budget-amount-input").props.onChangeText("100");
    });

    const foodChip = findAllByRole(root, "radio").find((node) =>
      collectText(node).includes("Food"),
    );
    act(() => {
      foodChip!.props.onPress();
    });

    await act(async () => {
      await findByTestId(root, "budget-save-button").props.onPress();
    });

    expect(findByTestId(root, "budget-form-error").props.children).toContain(
      "active budget already exists",
    );
    expect(mockOnSaved).not.toHaveBeenCalled();
  });
});

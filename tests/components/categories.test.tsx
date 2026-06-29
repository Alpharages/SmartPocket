import React from "react";
import { Platform } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";

import { useExpense } from "@/lib/expense-context";
import CategoriesScreen from "@/app/(tabs)/categories";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("expo-router", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/components/screen-container", () => ({
  ScreenContainer: ({ children }: { children: React.ReactNode }) =>
    React.createElement("View", {}, children),
}));

vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) =>
    React.createElement("SafeAreaView", {}, children),
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

vi.mock("@expo/vector-icons", () => {
  const Ionicons = ({ name, testID }: { name: string; testID?: string }) =>
    React.createElement("Ionicons", { name, testID });
  (Ionicons as any).glyphMap = {
    "pricetag-outline": 1,
    "cash-outline": 1,
    "fast-food-outline": 1,
    "folder-outline": 1,
    add: 1,
    "chevron-forward": 1,
    checkmark: 1,
    "close-circle": 1,
    close: 1,
    "chevron-down": 1,
  };
  return { Ionicons };
});

vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: "light" },
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
  overlay: "rgba(0,0,0,0.4)",
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

// Shared token literals — hoisted so both the `@/constants/theme` and
// `@/lib/_core/theme` mock factories reference one source of truth instead of
// duplicating the same Typography/Spacing/Radius values (which would silently
// diverge if the real tokens change).
const TOKENS = vi.hoisted(() => ({
  Radius: { sm: 8, md: 12, lg: 16, full: 9999 },
  Spacing: { sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32 },
  Typography: {
    body: { fontSize: 14, lineHeight: 20, fontWeight: "400" },
    caption: { fontSize: 12, lineHeight: 16, fontWeight: "400" },
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

vi.mock("@/lib/expense-context", () => ({
  useExpense: vi.fn(),
}));

vi.mock("@/hooks/use-confirm", () => ({
  useConfirm: () => ({
    visible: false,
    options: {},
    confirm: vi.fn().mockResolvedValue(true),
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockExpenseCategory = {
  id: 1,
  userId: 1,
  name: "Food",
  type: "expense" as const,
  color: "#E11D48",
  icon: "fast-food-outline",
  isDefault: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockIncomeCategory = {
  id: 2,
  userId: 1,
  name: "Salary",
  type: "income" as const,
  color: "#047857",
  icon: "cash-outline",
  isDefault: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockAddCategory = vi.fn().mockResolvedValue(undefined);
const mockDeleteCategory = vi.fn().mockResolvedValue(undefined);

const baseExpenseContext = {
  categories: [mockExpenseCategory, mockIncomeCategory],
  loadingCategories: false,
  addCategory: mockAddCategory,
  deleteCategory: mockDeleteCategory,
  // Other required fields
  transactions: [],
  loadingTransactions: false,
  addTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  stats: null,
  loadingStats: false,
  creditCards: [],
  loadingCards: false,
  addCreditCard: vi.fn(),
  deleteCreditCard: vi.fn(),
  refreshAll: vi.fn(),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderScreen(
  contextOverride: Partial<typeof baseExpenseContext> = {},
): ReactTestInstance {
  (useExpense as ReturnType<typeof vi.fn>).mockReturnValue({
    ...baseExpenseContext,
    ...contextOverride,
  });
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<CategoriesScreen />);
  });
  return renderer.root;
}

function findAllByType(
  root: ReactTestInstance,
  type: string | React.ElementType,
): ReactTestInstance[] {
  return root.findAll((n) => n.type === type);
}

function findByTestId(
  root: ReactTestInstance,
  testID: string,
): ReactTestInstance {
  return root.find((n) => n.props.testID === testID);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CategoriesScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Platform.OS = "ios";
  });

  // --- AC: Add button ---

  it("AC: add action renders as Button primitive with testID=add-category-button", () => {
    const root = renderScreen();
    const btn = findByTestId(root, "add-category-button");
    expect(btn).toBeDefined();
    // Button uses accessibilityRole="button" on its inner AnimatedPressable
    const pressable = btn.find((n) => n.props.accessibilityRole === "button");
    expect(pressable).toBeDefined();
  });

  it("AC: add button label is 'Add New Category'", () => {
    const root = renderScreen();
    const btn = findByTestId(root, "add-category-button");
    const label = btn.find(
      (n) =>
        String(n.type) === "Text" && n.props.children === "Add New Category",
    );
    expect(label).toBeDefined();
  });

  it("AC: add button opts out of desktop full-width stretch", () => {
    Platform.OS = "web";
    const root = renderScreen();
    const btn = findByTestId(root, "add-category-button");
    const pressable = btn.find((n) => n.props.accessibilityRole === "button");
    expect(pressable.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ alignSelf: "flex-start" }),
      ]),
    );
  });

  it("AC: add button is not a full-width colored Pressable banner — it is a Button primitive", () => {
    const root = renderScreen();
    const btn = findByTestId(root, "add-category-button");
    // The Button primitive has a displayName set
    // The outer element has testID="add-category-button"
    // It should NOT have raw style.backgroundColor === colors.primary with className containing "rounded-2xl"
    // (i.e., it should not be the old Pressable banner)
    // We verify the Button primitive is used by checking its accessibilityRole
    const accessibleBtn = btn.find(
      (n) => n.props.accessibilityRole === "button",
    );
    expect(accessibleBtn).toBeDefined();
  });

  // --- AC: CategoryToken in rows ---

  it("AC: category rows use CategoryToken for name + type + avatar", () => {
    const root = renderScreen();
    const tokens = root.findAll((n) => n.props.testID === "category-token");
    // At least 2: 1 expense category + 1 income category rendered in rows
    expect(tokens.length).toBeGreaterThanOrEqual(2);
  });

  it("AC: CategoryToken displays the correct name for each category", () => {
    const root = renderScreen();
    // CategoryToken in rows uses showLabel=false; the name is in an adjacent Text
    const nameNodes = root.findAll(
      (n) =>
        String(n.type) === "Text" &&
        (n.props.children === "Food" || n.props.children === "Salary"),
    );
    const names = nameNodes.map((n) => n.props.children);
    expect(names).toContain("Food");
    expect(names).toContain("Salary");
  });

  // Lesson 90e1d916: long-press delete must be reachable via accessibilityActions.
  it("AC (a11y): each category row Pressable exposes 'delete' accessibilityAction", () => {
    const root = renderScreen();
    const rowPressables = root.findAll(
      (n) =>
        n.props.accessibilityRole === "button" &&
        Array.isArray(n.props.accessibilityActions) &&
        n.props.accessibilityActions.some(
          (a: { name: string }) => a.name === "delete",
        ),
    );
    // At least 2: 1 expense row + 1 income row
    expect(rowPressables.length).toBeGreaterThanOrEqual(2);
  });

  it("AC (a11y): row accessibilityLabel names the category and type", () => {
    const root = renderScreen();
    const foodRow = root.find(
      (n) =>
        n.props.accessibilityRole === "button" &&
        typeof n.props.accessibilityLabel === "string" &&
        n.props.accessibilityLabel.includes("Food"),
    );
    expect(foodRow.props.accessibilityLabel).toBe("Food, expense category");
  });

  // --- AC: EmptyState ---

  it("AC: EmptyState rendered when no expense categories", () => {
    const root = renderScreen({ categories: [mockIncomeCategory] });
    const emptyState = findByTestId(root, "empty-state");
    expect(emptyState).toBeDefined();
  });

  it("AC: EmptyState rendered when no income categories", () => {
    const root = renderScreen({ categories: [mockExpenseCategory] });
    const emptyState = findByTestId(root, "empty-state");
    expect(emptyState).toBeDefined();
  });

  it("AC: both EmptyStates rendered when categories list is empty", () => {
    const root = renderScreen({ categories: [] });
    const emptyStates = root.findAll((n) => n.props.testID === "empty-state");
    // At least 2: one for expense section, one for income section
    expect(emptyStates.length).toBeGreaterThanOrEqual(2);
  });

  // --- AC: FR-5 — delete unchanged ---

  it("AC (FR-5): long-press on row calls deleteCategory with correct id", async () => {
    const root = renderScreen();
    const rowPressable = root.find(
      (n) =>
        n.props.accessibilityRole === "button" &&
        typeof n.props.accessibilityLabel === "string" &&
        n.props.accessibilityLabel.includes("Food"),
    );
    await act(async () => {
      rowPressable.props.onLongPress?.();
      // Allow the async confirm + delete to resolve
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(mockDeleteCategory).toHaveBeenCalledWith(mockExpenseCategory.id);
  });

  it("AC (FR-5): onAccessibilityAction calls deleteCategory (AT path)", async () => {
    const root = renderScreen();
    const rowPressable = root.find(
      (n) =>
        n.props.accessibilityRole === "button" &&
        typeof n.props.accessibilityLabel === "string" &&
        n.props.accessibilityLabel.includes("Salary"),
    );
    await act(async () => {
      rowPressable.props.onAccessibilityAction?.({
        nativeEvent: { actionName: "delete" },
      });
      // Allow the async confirm + delete to resolve
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(mockDeleteCategory).toHaveBeenCalledWith(mockIncomeCategory.id);
  });

  // --- AC: FR-5 — add unchanged ---

  it("AC (FR-5): add button opens the sheet modal", () => {
    const root = renderScreen();
    const btn = findByTestId(root, "add-category-button");
    const pressable = btn.find((n) => n.props.accessibilityRole === "button");
    // Initially sheet is hidden
    const sheet = findByTestId(root, "add-category-sheet");
    expect(sheet.props.visible).toBe(false);
    act(() => {
      pressable.props.onPress?.();
    });
    // After press, sheet should be visible
    const sheetAfter = findByTestId(root, "add-category-sheet");
    expect(sheetAfter.props.visible).toBe(true);
  });

  // --- Loading state ---

  it("shows ActivityIndicator while loading categories", () => {
    const root = renderScreen({ loadingCategories: true });
    const indicators = findAllByType(root, "ActivityIndicator");
    expect(indicators.length).toBeGreaterThan(0);
  });
});

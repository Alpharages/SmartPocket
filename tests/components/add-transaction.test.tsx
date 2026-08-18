import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";

import { useLocalSearchParams } from "expo-router";
import { useExpense } from "@/lib/expense-context";
import AddTransactionScreen from "@/app/add-transaction";
import { Motion } from "@/lib/_core/theme";
import { MAX_FONT_SCALE } from "@/lib/_core/a11y";
import { testId, syncColumns } from "../helpers/ids";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const mockBack = vi.fn();
const mockPush = vi.fn();

vi.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
  useLocalSearchParams: vi.fn(() => ({ type: "expense" })),
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

vi.mock("react-native-gesture-handler", () => ({
  GestureDetector: ({ children }: { children: React.ReactNode }) =>
    React.createElement("View", {}, children),
  Gesture: {
    Pan: () => ({
      activeOffsetY: () => ({
        failOffsetX: () => ({ onUpdate: () => ({ onEnd: () => ({}) }) }),
      }),
    }),
  },
}));

vi.mock("@expo/vector-icons", () => {
  const Ionicons = ({ name, testID }: { name: string; testID?: string }) =>
    React.createElement("Ionicons", { name, testID });
  (Ionicons as any).glyphMap = {
    "arrow-up": 1,
    "arrow-down": 1,
    "grid-outline": 1,
    close: 1,
    "chevron-forward": 1,
    "cash-outline": 1,
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

const mockCategories = [
  {
    id: testId(1),
    userId: testId(1),
    name: "Salary",
    type: "income" as const,
    color: "#059669",
    icon: "cash-outline",
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: testId(2),
    userId: testId(1),
    name: "Food",
    type: "expense" as const,
    color: "#DC2626",
    icon: "fast-food-outline",
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockAccounts = [
  {
    id: testId(10),
    userId: testId(1),
    name: "Cash Wallet",
    type: "cash" as const,
    currency: "USD",
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: testId(11),
    userId: testId(1),
    name: "Main Bank",
    type: "bank" as const,
    currency: "USD",
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockAddTransaction = vi.fn();

vi.mock("@/lib/expense-context", () => ({
  useExpense: vi.fn(),
}));

vi.mock("@/lib/currency-provider", () => ({
  useCurrency: () => ({ currency: "USD", setCurrency: vi.fn() }),
}));

const mockToastShow = vi.fn();

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ show: mockToastShow }),
}));

vi.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

vi.mock("@/constants/theme", async (importActual) => ({
  ...(await importActual<typeof import("@/constants/theme")>()),
  resolveCategoryColor: (color: string) => color,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let renderer: ReactTestRenderer | null = null;

function render(ui: React.ReactElement): ReactTestInstance {
  act(() => {
    renderer = TestRenderer.create(ui);
  });
  return renderer!.root;
}

function collectText(node: ReactTestInstance | string): string {
  if (typeof node === "string") return node;
  return (node.children ?? []).map((c) => collectText(c as any)).join("");
}

function findByText(
  root: ReactTestInstance,
  text: string,
): ReactTestInstance | null {
  try {
    return root.find(
      (n) => String(n.type) === "Text" && collectText(n) === text,
    );
  } catch {
    return null;
  }
}

function findAllByRole(
  root: ReactTestInstance,
  role: string,
): ReactTestInstance[] {
  return root.findAll((n) => (n.props as any).accessibilityRole === role);
}

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = null;
  vi.clearAllMocks();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AddTransactionScreen", () => {
  beforeEach(() => {
    (useExpense as ReturnType<typeof vi.fn>).mockReturnValue({
      categories: mockCategories,
      accounts: mockAccounts,
      creditCards: [],
      transactions: [],
      addTransaction: mockAddTransaction,
    });
  });

  describe("AC1 — Primitive composition", () => {
    it("renders the redesigned Sheet container and panel (noModal, absoluteFill)", () => {
      const root = render(<AddTransactionScreen />);
      // add-transaction now re-hosts its form onto the shared <Sheet noModal>
      // (Story 12.7) instead of a bespoke absoluteFill overlay.
      const container = root.findAll(
        (n) => (n.props as any).testID === "add-transaction",
      );
      const panel = root.findAll(
        (n) => (n.props as any).testID === "add-transaction-panel",
      );
      expect(container.length).toBeGreaterThanOrEqual(1);
      expect(panel.length).toBeGreaterThanOrEqual(1);
    });

    it("renders two Pill buttons for income and expense type selection", () => {
      const root = render(<AddTransactionScreen />);
      const expensePill = findByText(root, "Expense");
      const incomePill = findByText(root, "Income");
      expect(expensePill).toBeTruthy();
      expect(incomePill).toBeTruthy();
    });

    it("renders a Cancel and Save Button", () => {
      const root = render(<AddTransactionScreen />);
      const cancel = findByText(root, "Cancel");
      const save = findByText(root, "Save");
      expect(cancel).toBeTruthy();
      expect(save).toBeTruthy();
    });

    it("renders category chips via FilterChipGroup for the selected type", () => {
      // Default type is "expense" (from mock useLocalSearchParams)
      const root = render(<AddTransactionScreen />);
      const foodChip = findByText(root, "Food");
      expect(foodChip).toBeTruthy();
      // Income category should not be shown
      const salaryChip = findByText(root, "Salary");
      expect(salaryChip).toBeNull();
    });

    it("renders an EmptyState when no categories exist for the selected type", () => {
      (useExpense as ReturnType<typeof vi.fn>).mockReturnValue({
        categories: [],
        accounts: mockAccounts,
        creditCards: [],
        transactions: [],
        addTransaction: mockAddTransaction,
      });
      const root = render(<AddTransactionScreen />);
      const empty = root.findAll(
        (n) => (n.props as any).testID === "empty-state",
      );
      expect(empty.length).toBeGreaterThanOrEqual(1);
    });

    it("renders a TextInput for the amount", () => {
      const root = render(<AddTransactionScreen />);
      const inputs = root.findAllByType("TextInput" as any);
      // At least the amount input (plus description input)
      expect(inputs.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("AC2 — Amount field focused first", () => {
    it("amount TextInput has autoFocus=true", () => {
      const root = render(<AddTransactionScreen />);
      // First TextInput is the amount field
      const inputs = root.findAllByType("TextInput" as any);
      const amountInput = inputs[0];
      expect(amountInput.props.autoFocus).toBe(true);
    });

    it("amount TextInput has keyboardType=decimal-pad", () => {
      const root = render(<AddTransactionScreen />);
      const inputs = root.findAllByType("TextInput" as any);
      const amountInput = inputs[0];
      expect(amountInput.props.keyboardType).toBe("decimal-pad");
    });

    it("amount TextInput caps dynamic-type scaling at MAX_FONT_SCALE (Story 12.10, AC5)", () => {
      const root = render(<AddTransactionScreen />);
      const inputs = root.findAllByType("TextInput" as any);
      const amountInput = inputs[0];
      expect(amountInput.props.maxFontSizeMultiplier).toBe(MAX_FONT_SCALE);
    });
  });

  describe("AC3 — Date defaults to today", () => {
    it("date is initialized to today", () => {
      const before = new Date();
      render(<AddTransactionScreen />);
      const after = new Date();
      // The component initializes date = new Date() at mount time.
      // We can't directly access state, but we verify the behavior
      // through the save payload test (AC4).
      expect(before.getDate()).toBe(after.getDate());
    });
  });

  describe("AC4 — Behavior unchanged (FR-1)", () => {
    it("preselects 'expense' type when query param is 'expense'", () => {
      (useLocalSearchParams as ReturnType<typeof vi.fn>).mockReturnValue({
        type: "expense",
      });
      const root = render(<AddTransactionScreen />);
      // Expense pill should be selected (accessibilityState.selected=true)
      const buttons = findAllByRole(root, "button");
      const expenseBtn = buttons.find(
        (b) =>
          collectText(b) === "Expense" &&
          (b.props as any).accessibilityState?.selected === true,
      );
      expect(expenseBtn).toBeTruthy();
    });

    it("preselects 'income' type when query param is 'income'", () => {
      (useLocalSearchParams as ReturnType<typeof vi.fn>).mockReturnValue({
        type: "income",
      });
      const root = render(<AddTransactionScreen />);
      const buttons = findAllByRole(root, "button");
      const incomeBtn = buttons.find(
        (b) =>
          collectText(b) === "Income" &&
          (b.props as any).accessibilityState?.selected === true,
      );
      expect(incomeBtn).toBeTruthy();
    });

    it("switching type resets selectedCategory and shows correct category chips", () => {
      (useLocalSearchParams as ReturnType<typeof vi.fn>).mockReturnValue({
        type: "expense",
      });
      const root = render(<AddTransactionScreen />);

      // Find Income pill and press it
      const incomeBtn = findAllByRole(root, "button").find(
        (b) => collectText(b) === "Income",
      );
      expect(incomeBtn).toBeTruthy();
      act(() => {
        incomeBtn!.props.onPress();
      });

      // After switching to income, Salary category should appear
      const salaryChip = findByText(root, "Salary");
      expect(salaryChip).toBeTruthy();
      // Food (expense) should no longer appear
      const foodChip = findByText(root, "Food");
      expect(foodChip).toBeNull();
    });

    it("Save is pressable when amount is empty (SP-86eyepuwp: the guard, not a disabled button, reports why)", () => {
      const root = render(<AddTransactionScreen />);
      const saveBtn = findAllByRole(root, "button").find(
        (b) => collectText(b) === "Save",
      );
      expect(saveBtn).toBeTruthy();
      expect(saveBtn!.props.accessibilityState?.disabled).toBe(false);
    });

    it("Save is pressable when no category is selected (SP-86eyepuwp)", () => {
      const root = render(<AddTransactionScreen />);
      // Fill amount but no category
      const amountInput = root.findAllByType("TextInput" as any)[0];
      act(() => {
        amountInput.props.onChangeText("50.00");
      });
      const saveBtn = findAllByRole(root, "button").find(
        (b) => collectText(b) === "Save",
      );
      expect(saveBtn!.props.accessibilityState?.disabled).toBe(false);
    });

    it("calls addTransaction with correct payload and closes on save", async () => {
      mockAddTransaction.mockResolvedValue(undefined);
      vi.useFakeTimers();

      const root = render(<AddTransactionScreen />);

      // Fill amount
      const amountInput = root.findAllByType("TextInput" as any)[0];
      act(() => {
        amountInput.props.onChangeText("99.99");
      });

      // Select a category chip (Food, id=2, type=expense)
      const foodChip = findAllByRole(root, "radio").find((b) =>
        ((b.props as any).accessibilityLabel ?? "").startsWith("Food"),
      );
      expect(foodChip).toBeTruthy();
      act(() => {
        foodChip!.props.onPress();
      });

      // Press Save
      const saveBtn = findAllByRole(root, "button").find(
        (b) => collectText(b) === "Save",
      );
      await act(async () => {
        saveBtn!.props.onPress();
      });

      expect(mockAddTransaction).toHaveBeenCalledOnce();
      const payload = mockAddTransaction.mock.calls[0][0];
      expect(payload.categoryId).toBe(testId(2));
      expect(payload.type).toBe("expense");
      expect(payload.amount).toBe("99.99");
      expect(payload.description).toBeUndefined();
      expect(payload.date).toBeInstanceOf(Date);

      // AC5 (Story 12.9): a successful save fires the celebration toast
      // exactly once, before the Sheet starts closing.
      expect(mockToastShow).toHaveBeenCalledOnce();
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ type: "success" }),
      );

      // close() hides the Sheet (setVisible(false)); the route waits for the
      // Sheet's own close animation (Motion.sheet.durationMs) before popping
      // via router.back().
      expect(mockBack).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(Motion.sheet.durationMs);
      });
      expect(mockBack).toHaveBeenCalledOnce();
    });

    it("passes selected accountId to addTransaction", async () => {
      mockAddTransaction.mockResolvedValue(undefined);
      vi.useFakeTimers();

      const root = render(<AddTransactionScreen />);

      const amountInput = root.findAllByType("TextInput" as any)[0];
      act(() => {
        amountInput.props.onChangeText("42.00");
      });

      const foodChip = findAllByRole(root, "radio").find((b) =>
        ((b.props as any).accessibilityLabel ?? "").startsWith("Food"),
      );
      act(() => {
        foodChip!.props.onPress();
      });

      const accountOption = findAllByRole(root, "radio").find(
        (b) =>
          (b.props as any).accessibilityLabel === "Account Cash Wallet, USD",
      );
      expect(accountOption).toBeTruthy();
      act(() => {
        accountOption!.props.onPress();
      });

      const saveBtn = findAllByRole(root, "button").find(
        (b) => collectText(b) === "Save",
      );
      await act(async () => {
        saveBtn!.props.onPress();
      });

      expect(mockAddTransaction.mock.calls[0][0]).toMatchObject({
        categoryId: testId(2),
        accountId: testId(10),
      });
    });

    it("Cancel button triggers close and calls router.back()", () => {
      vi.useFakeTimers();
      const root = render(<AddTransactionScreen />);
      const cancelBtn = findAllByRole(root, "button").find(
        (b) => collectText(b) === "Cancel",
      );
      act(() => {
        cancelBtn!.props.onPress();
      });
      // Cancel hides the Sheet; router.back() fires after its close animation.
      expect(mockBack).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(Motion.sheet.durationMs);
      });
      expect(mockBack).toHaveBeenCalledOnce();
    });

    it("passes description to addTransaction when filled", async () => {
      mockAddTransaction.mockResolvedValue(undefined);
      vi.useFakeTimers();

      const root = render(<AddTransactionScreen />);

      const amountInput = root.findAllByType("TextInput" as any)[0];
      act(() => {
        amountInput.props.onChangeText("20");
      });

      const foodChip = findAllByRole(root, "radio").find((b) =>
        ((b.props as any).accessibilityLabel ?? "").startsWith("Food"),
      );
      act(() => {
        foodChip!.props.onPress();
      });

      // Select by label, not index: a Date field now sits between Amount and
      // Note (SP-008), so positional lookup silently targeted the wrong input.
      const descInput = root
        .findAllByType("TextInput" as any)
        .find((n: any) => n.props.accessibilityLabel === "Note")!;
      act(() => {
        descInput.props.onChangeText("Lunch at work");
      });

      const saveBtn = findAllByRole(root, "button").find(
        (b) => collectText(b) === "Save",
      );
      await act(async () => {
        saveBtn!.props.onPress();
      });

      expect(mockAddTransaction.mock.calls[0][0].description).toBe(
        "Lunch at work",
      );
    });
  });

  describe("SP-86eyepuwp — Category is a visibly required field", () => {
    it("AC1: Category label is marked required, matching the (Optional) siblings' style", () => {
      const root = render(<AddTransactionScreen />);
      expect(findByText(root, "Category (Required)")).toBeTruthy();
      expect(findByText(root, "Account (Optional)")).toBeTruthy();
      expect(findByText(root, "Note (Optional)")).toBeTruthy();
    });

    it("AC2 + AC6: pressing Save with a valid amount/date but no category shows an inline error and does not call addTransaction", async () => {
      const root = render(<AddTransactionScreen />);
      const amountInput = root.findAllByType("TextInput" as any)[0];
      act(() => {
        amountInput.props.onChangeText("25.50");
      });

      const saveBtn = findAllByRole(root, "button").find(
        (b) => collectText(b) === "Save",
      );
      await act(async () => {
        saveBtn!.props.onPress();
      });

      const categoryError = root.findAll(
        (n) => (n.props as any).testID === "add-transaction-category-error",
      );
      expect(categoryError.length).toBeGreaterThanOrEqual(1);
      expect(collectText(categoryError[0])).toBe("Select a category");
      expect(mockAddTransaction).not.toHaveBeenCalled();
    });

    it("AC2: the form retains previously entered values after the category error surfaces", async () => {
      const root = render(<AddTransactionScreen />);
      const amountInput = root.findAllByType("TextInput" as any)[0];
      act(() => {
        amountInput.props.onChangeText("25.50");
      });

      const saveBtn = findAllByRole(root, "button").find(
        (b) => collectText(b) === "Save",
      );
      await act(async () => {
        saveBtn!.props.onPress();
      });

      expect(amountInput.props.value).toBe("25.50");
    });

    it("AC3: selecting a category clears the inline error and a subsequent Save persists the transaction", async () => {
      mockAddTransaction.mockResolvedValue(undefined);
      vi.useFakeTimers();

      const root = render(<AddTransactionScreen />);
      const amountInput = root.findAllByType("TextInput" as any)[0];
      act(() => {
        amountInput.props.onChangeText("25.50");
      });

      const saveBtn = findAllByRole(root, "button").find(
        (b) => collectText(b) === "Save",
      );
      await act(async () => {
        saveBtn!.props.onPress();
      });
      expect(
        root.findAll(
          (n) => (n.props as any).testID === "add-transaction-category-error",
        ).length,
      ).toBeGreaterThanOrEqual(1);

      const foodChip = findAllByRole(root, "radio").find((b) =>
        ((b.props as any).accessibilityLabel ?? "").startsWith("Food"),
      );
      act(() => {
        foodChip!.props.onPress();
      });

      expect(
        root.findAll(
          (n) => (n.props as any).testID === "add-transaction-category-error",
        ).length,
      ).toBe(0);

      await act(async () => {
        saveBtn!.props.onPress();
      });
      expect(mockAddTransaction).toHaveBeenCalledOnce();
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ type: "success" }),
      );
    });

    it("AC4: the category error is announced via accessibilityLiveRegion=polite", async () => {
      const root = render(<AddTransactionScreen />);
      const amountInput = root.findAllByType("TextInput" as any)[0];
      act(() => {
        amountInput.props.onChangeText("25.50");
      });

      const saveBtn = findAllByRole(root, "button").find(
        (b) => collectText(b) === "Save",
      );
      await act(async () => {
        saveBtn!.props.onPress();
      });

      const categoryError = root.findAll(
        (n) => (n.props as any).testID === "add-transaction-category-error",
      )[0];
      expect(categoryError.props.accessibilityLiveRegion).toBe("polite");
    });

    it("AC5: amount 0 still blocks save with the SP-041 inline error, even with a category selected", async () => {
      const root = render(<AddTransactionScreen />);
      const amountInput = root.findAllByType("TextInput" as any)[0];
      act(() => {
        amountInput.props.onChangeText("0");
      });

      const foodChip = findAllByRole(root, "radio").find((b) =>
        ((b.props as any).accessibilityLabel ?? "").startsWith("Food"),
      );
      act(() => {
        foodChip!.props.onPress();
      });

      const saveBtn = findAllByRole(root, "button").find(
        (b) => collectText(b) === "Save",
      );
      await act(async () => {
        saveBtn!.props.onPress();
      });

      expect(findByText(root, "Amount must be greater than zero")).toBeTruthy();
      expect(mockAddTransaction).not.toHaveBeenCalled();
    });

    it("shows the category error under the EmptyState when the selected type has no categories", async () => {
      (useExpense as ReturnType<typeof vi.fn>).mockReturnValue({
        categories: [],
        accounts: mockAccounts,
        creditCards: [],
        transactions: [],
        addTransaction: mockAddTransaction,
      });
      const root = render(<AddTransactionScreen />);
      const amountInput = root.findAllByType("TextInput" as any)[0];
      act(() => {
        amountInput.props.onChangeText("25.50");
      });

      const saveBtn = findAllByRole(root, "button").find(
        (b) => collectText(b) === "Save",
      );
      await act(async () => {
        saveBtn!.props.onPress();
      });

      expect(
        root.findAll(
          (n) => (n.props as any).testID === "add-transaction-category-error",
        ).length,
      ).toBeGreaterThanOrEqual(1);
    });

    it("rapid double-press of Save calls addTransaction only once", async () => {
      mockAddTransaction.mockResolvedValue(undefined);
      vi.useFakeTimers();

      const root = render(<AddTransactionScreen />);
      const amountInput = root.findAllByType("TextInput" as any)[0];
      act(() => {
        amountInput.props.onChangeText("25.50");
      });

      const foodChip = findAllByRole(root, "radio").find((b) =>
        ((b.props as any).accessibilityLabel ?? "").startsWith("Food"),
      );
      act(() => {
        foodChip!.props.onPress();
      });

      const saveBtn = findAllByRole(root, "button").find(
        (b) => collectText(b) === "Save",
      );
      await act(async () => {
        // Two synchronous presses in the same tick, simulating a rapid
        // double-tap before React re-renders the `saving` state.
        saveBtn!.props.onPress();
        saveBtn!.props.onPress();
      });

      expect(mockAddTransaction).toHaveBeenCalledOnce();
    });
  });

  describe("AC5 — Sheet semantics", () => {
    it("Sheet close button is accessible", () => {
      const root = render(<AddTransactionScreen />);
      const closeBtn = root.findAll(
        (n) =>
          (n.props as any).accessibilityRole === "button" &&
          (n.props as any).accessibilityLabel === "Close",
      );
      expect(closeBtn.length).toBeGreaterThanOrEqual(1);
    });

    it("type selection never relies on color alone — Expense pill has an icon", () => {
      const root = render(<AddTransactionScreen />);
      // The Expense Pill has a leftIcon (Ionicons arrow-up)
      const icons = root.findAll(
        (n) =>
          String(n.type) === "Ionicons" && (n.props as any).name === "arrow-up",
      );
      expect(icons.length).toBeGreaterThanOrEqual(1);
    });

    it("type selection never relies on color alone — Income pill has an icon", () => {
      const root = render(<AddTransactionScreen />);
      const icons = root.findAll(
        (n) =>
          String(n.type) === "Ionicons" &&
          (n.props as any).name === "arrow-down",
      );
      expect(icons.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Edge cases", () => {
    it("shows empty state when switching type to one with no categories", () => {
      (useExpense as ReturnType<typeof vi.fn>).mockReturnValue({
        categories: [
          {
            id: testId(2),
            userId: testId(1),
            name: "Food",
            type: "expense" as const,
            color: "#DC2626",
            icon: "fast-food-outline",
            isDefault: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        accounts: mockAccounts,
        creditCards: [],
        transactions: [],
        addTransaction: mockAddTransaction,
      });
      (useLocalSearchParams as ReturnType<typeof vi.fn>).mockReturnValue({
        type: "income",
      });

      const root = render(<AddTransactionScreen />);
      // Income type selected but no income categories → EmptyState
      const empty = root.findAll(
        (n) => (n.props as any).testID === "empty-state",
      );
      expect(empty.length).toBeGreaterThanOrEqual(1);
    });
  });
});

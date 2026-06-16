import React from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";

import { Alert } from "react-native";
import { useExpense } from "@/lib/expense-context";
import TransactionsScreen, {
  groupTransactionsByDate,
} from "@/app/(tabs)/transactions";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const mockPush = vi.fn();
const mockBack = vi.fn();

vi.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
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
    search: 1,
    "close-circle": 1,
    "search-outline": 1,
    "receipt-outline": 1,
    "arrow-up": 1,
    "arrow-down": 1,
    "pricetag-outline": 1,
    "fast-food-outline": 1,
    "cash-outline": 1,
    "create-outline": 1,
    "trash-outline": 1,
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

vi.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

vi.mock("@/lib/currency-provider", () => ({
  useCurrency: () => ({
    currency: "USD",
    setCurrency: vi.fn(),
    isReady: true,
  }),
}));

vi.mock("@/lib/first-day-of-week-provider", () => ({
  useFirstDayOfWeek: () => ({
    firstDayOfWeek: 0,
    setFirstDayOfWeek: vi.fn(),
    isReady: true,
  }),
}));

vi.mock("@/lib/expense-context", () => ({
  useExpense: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date("2026-06-04T10:00:00Z");
const YESTERDAY = new Date("2026-06-03T10:00:00Z");
const LAST_MONTH = new Date("2026-05-01T10:00:00Z");
const LAST_WEEK = new Date("2026-05-28T10:00:00Z");

const mockCategories = [
  {
    id: 1,
    userId: 1,
    name: "Salary",
    type: "income" as const,
    color: "#059669",
    icon: "cash-outline",
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 2,
    userId: 1,
    name: "Food",
    type: "expense" as const,
    color: "#DC2626",
    icon: "fast-food-outline",
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

function makeTransaction(
  overrides: Partial<{
    id: number;
    categoryId: number | null;
    type: "income" | "expense";
    amount: string;
    description: string | null;
    date: Date;
  }> = {},
) {
  return {
    id: overrides.id ?? 1,
    // Use `in` check so explicit `null` is preserved (null ?? 2 === 2 in JS)
    categoryId: "categoryId" in overrides ? overrides.categoryId : 2,
    type: overrides.type ?? "expense",
    amount: overrides.amount ?? "50.00",
    description: overrides.description ?? null,
    date: overrides.date ?? NOW,
    userId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const mockDeleteTransaction = vi.fn();

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
  // Use findAll to tolerate multiple matching nodes (find() throws on >1 match)
  const matches = root.findAll(
    (n) => String(n.type) === "Text" && collectText(n) === text,
  );
  return matches.length > 0 ? matches[0] : null;
}

function findAllByType(
  root: ReactTestInstance,
  type: string,
): ReactTestInstance[] {
  return root.findAll((n) => String(n.type) === type);
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
// Unit: groupTransactionsByDate
// ---------------------------------------------------------------------------

describe("groupTransactionsByDate", () => {
  it("groups today's transactions under 'Today'", () => {
    const t = makeTransaction({ date: new Date() });
    const sections = groupTransactionsByDate([t]);
    expect(sections[0].title).toBe("Today");
    expect(sections[0].data).toHaveLength(1);
  });

  it("groups yesterday's transactions under 'Yesterday'", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const t = makeTransaction({ date: yesterday });
    const sections = groupTransactionsByDate([t]);
    expect(sections[0].title).toBe("Yesterday");
  });

  it("formats older dates as 'MMM D'", () => {
    const old = new Date("2026-05-01T00:00:00");
    const t = makeTransaction({ date: old });
    const sections = groupTransactionsByDate([t]);
    expect(sections[0].title).toBe("May 1");
  });

  it("preserves newest-first section order", () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const t1 = makeTransaction({ id: 1, date: today });
    const t2 = makeTransaction({ id: 2, date: yesterday });

    // Already sorted newest-first
    const sections = groupTransactionsByDate([t1, t2]);
    expect(sections[0].title).toBe("Today");
    expect(sections[1].title).toBe("Yesterday");
  });

  it("groups multiple transactions on the same day into one section", () => {
    const today = new Date();
    const t1 = makeTransaction({ id: 1, date: today });
    const t2 = makeTransaction({ id: 2, date: today });
    const sections = groupTransactionsByDate([t1, t2]);
    expect(sections).toHaveLength(1);
    expect(sections[0].data).toHaveLength(2);
  });

  it("returns empty array for empty input", () => {
    expect(groupTransactionsByDate([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Component: TransactionsScreen
// ---------------------------------------------------------------------------

describe("TransactionsScreen", () => {
  beforeEach(() => {
    (useExpense as ReturnType<typeof vi.fn>).mockReturnValue({
      transactions: [],
      categories: mockCategories,
      loadingTransactions: false,
      deleteTransaction: mockDeleteTransaction,
    });
  });

  // -------------------------------------------------------------------------
  // AC: ScreenHeader
  // -------------------------------------------------------------------------

  describe("ScreenHeader", () => {
    it("renders the 'Activity' title", () => {
      const root = render(<TransactionsScreen />);
      const title = findByText(root, "Activity");
      expect(title).toBeTruthy();
    });

    it("shows '0 transactions' subtitle when empty", () => {
      const root = render(<TransactionsScreen />);
      const subtitle = findByText(root, "0 transactions");
      expect(subtitle).toBeTruthy();
    });

    it("shows '1 transaction' (singular) when one transaction", () => {
      (useExpense as ReturnType<typeof vi.fn>).mockReturnValue({
        transactions: [makeTransaction()],
        categories: mockCategories,
        loadingTransactions: false,
        deleteTransaction: mockDeleteTransaction,
      });
      const root = render(<TransactionsScreen />);
      const subtitle = findByText(root, "1 transaction");
      expect(subtitle).toBeTruthy();
    });

    it("shows 'N transactions' (plural) for multiple", () => {
      (useExpense as ReturnType<typeof vi.fn>).mockReturnValue({
        transactions: [makeTransaction({ id: 1 }), makeTransaction({ id: 2 })],
        categories: mockCategories,
        loadingTransactions: false,
        deleteTransaction: mockDeleteTransaction,
      });
      const root = render(<TransactionsScreen />);
      const subtitle = findByText(root, "2 transactions");
      expect(subtitle).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // AC: Search
  // -------------------------------------------------------------------------

  describe("Search", () => {
    it("renders a search TextInput", () => {
      const root = render(<TransactionsScreen />);
      const inputs = findAllByType(root, "TextInput");
      expect(inputs.length).toBeGreaterThanOrEqual(1);
      const searchInput = inputs.find(
        (n) => (n.props as any).placeholder === "Search transactions…",
      );
      expect(searchInput).toBeTruthy();
    });

    it("filters transactions by description when search text is typed", () => {
      const lunch = makeTransaction({
        id: 1,
        description: "Lunch at work",
        date: NOW,
      });
      const coffee = makeTransaction({
        id: 2,
        description: "Coffee",
        date: NOW,
      });
      (useExpense as ReturnType<typeof vi.fn>).mockReturnValue({
        transactions: [lunch, coffee],
        categories: mockCategories,
        loadingTransactions: false,
        deleteTransaction: mockDeleteTransaction,
      });

      const root = render(<TransactionsScreen />);
      const searchInput = findAllByType(root, "TextInput")[0];

      act(() => {
        searchInput.props.onChangeText("Lunch");
      });

      // After filtering, "Lunch at work" note should appear; "Coffee" should not
      const lunchNote = findByText(root, "Lunch at work");
      const coffeeNote = findByText(root, "Coffee");
      expect(lunchNote).toBeTruthy();
      expect(coffeeNote).toBeNull();
    });

    it("filters by amount substring", () => {
      const t1 = makeTransaction({ id: 1, amount: "123.00", date: NOW });
      const t2 = makeTransaction({ id: 2, amount: "456.00", date: NOW });
      (useExpense as ReturnType<typeof vi.fn>).mockReturnValue({
        transactions: [t1, t2],
        categories: mockCategories,
        loadingTransactions: false,
        deleteTransaction: mockDeleteTransaction,
      });

      const root = render(<TransactionsScreen />);
      const searchInput = findAllByType(root, "TextInput")[0];
      act(() => {
        searchInput.props.onChangeText("123");
      });

      // t1 should show (amount matches), t2 should not
      // TransactionRow renders the amount — verify t2's amount is absent
      const amount2 = findByText(root, "+$456.00");
      expect(amount2).toBeNull();
    });

    it("shows a clear (×) button when search text is present", () => {
      const root = render(<TransactionsScreen />);
      const searchInput = findAllByType(root, "TextInput")[0];

      act(() => {
        searchInput.props.onChangeText("abc");
      });

      const clearBtn = root.find(
        (n) =>
          (n.props as any).accessibilityLabel === "Clear search" &&
          (n.props as any).accessibilityRole === "button",
      );
      expect(clearBtn).toBeTruthy();
    });

    it("clear button resets search text", () => {
      const root = render(<TransactionsScreen />);
      const searchInput = findAllByType(root, "TextInput")[0];
      act(() => {
        searchInput.props.onChangeText("abc");
      });

      const clearBtn = root.find(
        (n) => (n.props as any).accessibilityLabel === "Clear search",
      );
      act(() => {
        clearBtn.props.onPress();
      });

      const updatedInput = findAllByType(root, "TextInput")[0];
      expect(updatedInput.props.value).toBe("");
    });
  });

  // -------------------------------------------------------------------------
  // AC: Filter chips (FR-3 behavior unchanged)
  // -------------------------------------------------------------------------

  describe("Filter chips", () => {
    function seedTransactions() {
      const incomeNow = makeTransaction({
        id: 1,
        type: "income",
        categoryId: 1,
        date: NOW,
      });
      const expenseNow = makeTransaction({
        id: 2,
        type: "expense",
        categoryId: 2,
        date: NOW,
      });
      const lastMonth = makeTransaction({
        id: 3,
        type: "expense",
        categoryId: 2,
        date: LAST_MONTH,
      });
      const lastWeek = makeTransaction({
        id: 4,
        type: "expense",
        categoryId: 2,
        date: LAST_WEEK,
      });
      return [incomeNow, expenseNow, lastMonth, lastWeek];
    }

    it("renders all five filter chip labels", () => {
      const root = render(<TransactionsScreen />);
      for (const label of [
        "All",
        "Income",
        "Expense",
        "This Month",
        "This Week",
      ]) {
        expect(findByText(root, label)).toBeTruthy();
      }
    });

    it("'All' chip is selected by default", () => {
      const root = render(<TransactionsScreen />);
      // Pill uses accessibilityRole="button"; check accessibilityState.selected
      const allBtn = findAllByRole(root, "button").find(
        (n) =>
          collectText(n) === "All" &&
          (n.props as any).accessibilityState?.selected === true,
      );
      expect(allBtn).toBeTruthy();
    });

    it("Income filter shows only income rows", () => {
      (useExpense as ReturnType<typeof vi.fn>).mockReturnValue({
        transactions: seedTransactions(),
        categories: mockCategories,
        loadingTransactions: false,
        deleteTransaction: mockDeleteTransaction,
      });

      const root = render(<TransactionsScreen />);
      const incomeBtn = findAllByRole(root, "button").find(
        (n) => collectText(n) === "Income",
      );
      expect(incomeBtn).toBeTruthy();
      act(() => {
        incomeBtn!.props.onPress();
      });

      // Salary (income) should appear; Food (expense) should not
      expect(findByText(root, "Salary")).toBeTruthy();
      expect(findByText(root, "Food")).toBeNull();
    });

    it("Expense filter shows only expense rows", () => {
      (useExpense as ReturnType<typeof vi.fn>).mockReturnValue({
        transactions: seedTransactions(),
        categories: mockCategories,
        loadingTransactions: false,
        deleteTransaction: mockDeleteTransaction,
      });

      const root = render(<TransactionsScreen />);
      const expenseBtn = findAllByRole(root, "button").find(
        (n) => collectText(n) === "Expense",
      );
      expect(expenseBtn).toBeTruthy();
      act(() => {
        expenseBtn!.props.onPress();
      });

      expect(findByText(root, "Food")).toBeTruthy();
      expect(findByText(root, "Salary")).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // AC: Date grouping
  // -------------------------------------------------------------------------

  describe("Date grouping", () => {
    it("shows 'Today' section header for today's transactions", () => {
      (useExpense as ReturnType<typeof vi.fn>).mockReturnValue({
        transactions: [makeTransaction({ date: new Date() })],
        categories: mockCategories,
        loadingTransactions: false,
        deleteTransaction: mockDeleteTransaction,
      });

      const root = render(<TransactionsScreen />);
      expect(findByText(root, "Today")).toBeTruthy();
    });

    it("shows 'Yesterday' header for yesterday's transactions", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      (useExpense as ReturnType<typeof vi.fn>).mockReturnValue({
        transactions: [makeTransaction({ date: yesterday })],
        categories: mockCategories,
        loadingTransactions: false,
        deleteTransaction: mockDeleteTransaction,
      });

      const root = render(<TransactionsScreen />);
      expect(findByText(root, "Yesterday")).toBeTruthy();
    });

    it("shows multiple section headers for transactions across different days", () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      (useExpense as ReturnType<typeof vi.fn>).mockReturnValue({
        transactions: [
          makeTransaction({ id: 1, date: today }),
          makeTransaction({ id: 2, date: yesterday }),
        ],
        categories: mockCategories,
        loadingTransactions: false,
        deleteTransaction: mockDeleteTransaction,
      });

      const root = render(<TransactionsScreen />);
      expect(findByText(root, "Today")).toBeTruthy();
      expect(findByText(root, "Yesterday")).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // AC: Category resolution (name / color / icon)
  // -------------------------------------------------------------------------

  describe("Category resolution", () => {
    it("shows category name instead of 'Category {id}'", () => {
      (useExpense as ReturnType<typeof vi.fn>).mockReturnValue({
        transactions: [makeTransaction({ categoryId: 2 })],
        categories: mockCategories,
        loadingTransactions: false,
        deleteTransaction: mockDeleteTransaction,
      });

      const root = render(<TransactionsScreen />);
      // Should display "Food" not "Category 2"
      expect(findByText(root, "Food")).toBeTruthy();
      expect(findByText(root, "Category 2")).toBeNull();
    });

    it("shows 'Uncategorized' when categoryId is null", () => {
      (useExpense as ReturnType<typeof vi.fn>).mockReturnValue({
        transactions: [makeTransaction({ categoryId: null })],
        categories: mockCategories,
        loadingTransactions: false,
        deleteTransaction: mockDeleteTransaction,
      });

      const root = render(<TransactionsScreen />);
      expect(findByText(root, "Uncategorized")).toBeTruthy();
    });

    it("shows 'Uncategorized' when category was deleted (id not in list)", () => {
      (useExpense as ReturnType<typeof vi.fn>).mockReturnValue({
        transactions: [makeTransaction({ categoryId: 999 })],
        categories: mockCategories,
        loadingTransactions: false,
        deleteTransaction: mockDeleteTransaction,
      });

      const root = render(<TransactionsScreen />);
      expect(findByText(root, "Uncategorized")).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // AC: Swipe delete with confirmation
  // -------------------------------------------------------------------------

  describe("Swipe delete", () => {
    let alertSpy: MockInstance;

    beforeEach(() => {
      alertSpy = vi.spyOn(Alert, "alert");
      (useExpense as ReturnType<typeof vi.fn>).mockReturnValue({
        transactions: [makeTransaction({ id: 42, categoryId: 2 })],
        categories: mockCategories,
        loadingTransactions: false,
        deleteTransaction: mockDeleteTransaction,
      });
    });

    it("renders a delete swipe action for each row", () => {
      const root = render(<TransactionsScreen />);
      // Swipeable mock renders right actions; look for a delete-labelled button
      const deleteBtn = root.findAll(
        (n) =>
          (n.props as any).accessibilityLabel?.includes("Delete") &&
          (n.props as any).accessibilityRole === "button",
      );
      expect(deleteBtn.length).toBeGreaterThanOrEqual(1);
    });

    it("pressing delete shows Alert.alert confirmation", () => {
      const root = render(<TransactionsScreen />);
      const deleteBtn = root.find(
        (n) =>
          (n.props as any).accessibilityLabel === "Delete Food" &&
          (n.props as any).accessibilityRole === "button",
      );
      act(() => {
        deleteBtn.props.onPress();
      });
      expect(alertSpy).toHaveBeenCalledOnce();
      expect(alertSpy.mock.calls[0][0]).toBe("Delete Transaction");
    });

    it("confirming delete calls deleteTransaction with the transaction id", () => {
      const root = render(<TransactionsScreen />);
      const deleteBtn = root.find(
        (n) => (n.props as any).accessibilityLabel === "Delete Food",
      );
      act(() => {
        deleteBtn.props.onPress();
      });

      // Grab the destructive button from the Alert call and invoke it
      const buttons: any[] = alertSpy.mock.calls[0][2];
      const destructiveBtn = buttons.find((b) => b.style === "destructive");
      act(() => {
        destructiveBtn.onPress();
      });

      expect(mockDeleteTransaction).toHaveBeenCalledOnce();
      expect(mockDeleteTransaction).toHaveBeenCalledWith(42);
    });

    it("cancelling delete does NOT call deleteTransaction", () => {
      const root = render(<TransactionsScreen />);
      const deleteBtn = root.find(
        (n) => (n.props as any).accessibilityLabel === "Delete Food",
      );
      act(() => {
        deleteBtn.props.onPress();
      });

      const buttons: any[] = alertSpy.mock.calls[0][2];
      const cancelBtn = buttons.find((b) => b.style === "cancel");
      // onPress is undefined for cancel — just verify no delete call
      cancelBtn.onPress?.();
      expect(mockDeleteTransaction).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // AC: Empty states
  // -------------------------------------------------------------------------

  describe("Empty state", () => {
    it("renders 'No transactions yet' EmptyState when list is empty and no filter active", () => {
      const root = render(<TransactionsScreen />);
      expect(findByText(root, "No transactions yet")).toBeTruthy();
    });

    it("renders 'No results found' when filter is active and no matches", () => {
      (useExpense as ReturnType<typeof vi.fn>).mockReturnValue({
        transactions: [makeTransaction({ type: "income", categoryId: 1 })],
        categories: mockCategories,
        loadingTransactions: false,
        deleteTransaction: mockDeleteTransaction,
      });

      const root = render(<TransactionsScreen />);
      const expenseBtn = findAllByRole(root, "button").find(
        (n) => collectText(n) === "Expense",
      );
      expect(expenseBtn).toBeTruthy();
      act(() => {
        expenseBtn!.props.onPress();
      });

      expect(findByText(root, "No results found")).toBeTruthy();
    });

    it("'No results found' empty state has no action button", () => {
      (useExpense as ReturnType<typeof vi.fn>).mockReturnValue({
        transactions: [makeTransaction({ type: "income", categoryId: 1 })],
        categories: mockCategories,
        loadingTransactions: false,
        deleteTransaction: mockDeleteTransaction,
      });

      const root = render(<TransactionsScreen />);
      const expenseBtn = findAllByRole(root, "button").find(
        (n) => collectText(n) === "Expense",
      );
      expect(expenseBtn).toBeTruthy();
      act(() => {
        expenseBtn!.props.onPress();
      });

      const addBtn = findByText(root, "Add Transaction");
      expect(addBtn).toBeNull();
    });

    it("'No transactions yet' EmptyState has 'Add Transaction' action that pushes the route", () => {
      const root = render(<TransactionsScreen />);
      const addBtn = findAllByRole(root, "button").find(
        (n) => collectText(n) === "Add Transaction",
      );
      expect(addBtn).toBeTruthy();
      act(() => {
        addBtn!.props.onPress();
      });
      expect(mockPush).toHaveBeenCalledWith("/add-transaction");
    });

    it("shows ActivityIndicator while loadingTransactions is true", () => {
      (useExpense as ReturnType<typeof vi.fn>).mockReturnValue({
        transactions: [],
        categories: mockCategories,
        loadingTransactions: true,
        deleteTransaction: mockDeleteTransaction,
      });

      const root = render(<TransactionsScreen />);
      const spinner = root.findAll(
        (n) => (n.props as any).testID === "activity-indicator",
      );
      expect(spinner.length).toBeGreaterThanOrEqual(1);
    });
  });

  // -------------------------------------------------------------------------
  // AC: Dead route removed (no crash on row press-without-onPress)
  // -------------------------------------------------------------------------

  describe("Dead route removed", () => {
    it("does not navigate to /transaction/:id when a row is tapped (no dead-end route)", () => {
      (useExpense as ReturnType<typeof vi.fn>).mockReturnValue({
        transactions: [makeTransaction()],
        categories: mockCategories,
        loadingTransactions: false,
        deleteTransaction: mockDeleteTransaction,
      });

      const root = render(<TransactionsScreen />);

      // The row is rendered as an AnimatedPressable — find it and press
      const rows = root.findAll(
        (n) =>
          (n.props as any).accessibilityRole === "button" &&
          (n.props as any).accessibilityLabel?.includes("expense"),
      );

      if (rows.length > 0) {
        act(() => {
          rows[0].props.onPress?.();
        });
      }

      // Should never push the old dead route
      expect(mockPush).not.toHaveBeenCalledWith(
        expect.stringContaining("/transaction/"),
      );
    });
  });
});

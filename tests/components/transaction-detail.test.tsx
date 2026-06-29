import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";

import TransactionDetailScreen from "@/app/transaction/[id]";
import { useExpense } from "@/lib/expense-context";

const mockBack = vi.fn();

vi.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => ({ id: "7" }),
}));

vi.mock("@/components/screen-container", () => ({
  ScreenContainer: ({ children }: { children: React.ReactNode }) =>
    React.createElement("View", {}, children),
}));

vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) =>
    React.createElement("SafeAreaView", {}, children),
}));

vi.mock("@expo/vector-icons", () => {
  const Ionicons = ({ name }: { name: string }) =>
    React.createElement("Ionicons", { name });
  (Ionicons as any).glyphMap = {
    "arrow-down": 1,
    "arrow-up": 1,
    "chevron-back": 1,
    "trash-outline": 1,
    checkmark: 1,
    "fast-food-outline": 1,
    "wallet-outline": 1,
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

vi.mock("@/lib/currency-provider", () => ({
  useCurrency: () => ({ currency: "USD", setCurrency: vi.fn() }),
}));

vi.mock("@/hooks/use-pull-to-refresh", () => ({
  usePullToRefresh: () => ({}),
}));

vi.mock("@/lib/expense-context", () => ({
  useExpense: vi.fn(),
}));

const accounts = [
  {
    id: 10,
    userId: 1,
    name: "Cash Wallet",
    type: "cash" as const,
    currency: "USD",
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 11,
    userId: 1,
    name: "Main Bank",
    type: "bank" as const,
    currency: "USD",
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const transaction = {
  id: 7,
  userId: 1,
  categoryId: 2,
  accountId: 10,
  type: "expense" as const,
  amount: "20.00",
  description: "Lunch",
  date: new Date("2026-06-10"),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const updateTransaction = vi.fn().mockResolvedValue(undefined);

let renderer: ReactTestRenderer | null = null;

function render(): ReactTestInstance {
  act(() => {
    renderer = TestRenderer.create(<TransactionDetailScreen />);
  });
  return renderer!.root;
}

function collectText(node: ReactTestInstance | string): string {
  if (typeof node === "string") return node;
  return (node.children ?? [])
    .map((child) => collectText(child as any))
    .join("");
}

function findAllByRole(
  root: ReactTestInstance,
  role: string,
): ReactTestInstance[] {
  return root.findAll((node) => node.props.accessibilityRole === role);
}

describe("TransactionDetailScreen account assignment", () => {
  beforeEach(() => {
    vi.mocked(useExpense).mockReturnValue({
      transactions: [transaction],
      categories: [
        {
          id: 2,
          userId: 1,
          name: "Food",
          type: "expense",
          color: "#DC2626",
          icon: "fast-food-outline",
          isDefault: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      accounts,
      updateTransaction,
      deleteTransaction: vi.fn(),
      loadingTransactions: false,
      refreshTransactions: vi.fn(),
      refreshAccounts: vi.fn(),
    } as unknown as ReturnType<typeof useExpense>);
  });

  afterEach(() => {
    act(() => {
      renderer?.unmount();
    });
    renderer = null;
    vi.clearAllMocks();
  });

  it("preselects the current account and saves a changed account", async () => {
    const root = render();

    const current = findAllByRole(root, "radio").find(
      (node) =>
        node.props.accessibilityLabel === "Account Cash Wallet, USD" &&
        node.props.accessibilityState?.selected === true,
    );
    expect(current).toBeTruthy();

    const mainBank = findAllByRole(root, "radio").find(
      (node) => node.props.accessibilityLabel === "Account Main Bank, USD",
    );
    act(() => {
      mainBank!.props.onPress();
    });

    const save = findAllByRole(root, "button").find(
      (node) => collectText(node) === "Save account",
    );
    await act(async () => {
      save!.props.onPress();
    });

    expect(updateTransaction).toHaveBeenCalledWith(7, { accountId: 11 });
  });

  it("can clear the account assignment", async () => {
    const root = render();

    const noAccount = findAllByRole(root, "radio").find(
      (node) => node.props.accessibilityLabel === "Account No account",
    );
    act(() => {
      noAccount!.props.onPress();
    });

    const save = findAllByRole(root, "button").find(
      (node) => collectText(node) === "Save account",
    );
    await act(async () => {
      save!.props.onPress();
    });

    expect(updateTransaction).toHaveBeenCalledWith(7, { accountId: null });
  });
});

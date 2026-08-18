import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";

import CardDetailScreen from "@/app/card/card-detail-screen";
import { useExpense } from "@/lib/expense-context";
import { useCardTransactions } from "@/lib/expense-context";
import { testId, syncColumns } from "../helpers/ids";

const mockBack = vi.fn();

vi.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, push: vi.fn() }),
  useLocalSearchParams: () => ({ id: testId(1) }),
}));

vi.mock("@/components/screen-container", () => ({
  ScreenContainer: ({ children }: { children: React.ReactNode }) =>
    React.createElement("View", {}, children),
}));

vi.mock("@expo/vector-icons", () => {
  const Ionicons = ({ name, testID }: { name: string; testID?: string }) =>
    React.createElement("Ionicons", { name, testID });
  (Ionicons as any).glyphMap = {
    "chevron-back": 1,
    "receipt-outline": 1,
    "fast-food-outline": 1,
    "pricetag-outline": 1,
    "hourglass-outline": 1,
    "search-outline": 1,
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
};

vi.mock("@/hooks/use-colors", () => ({
  useColors: () => mockColors,
}));

vi.mock("@/lib/currency-provider", () => ({
  useCurrency: () => ({
    currency: "USD",
    setCurrency: vi.fn(),
    isReady: true,
  }),
}));

vi.mock("@/lib/expense-context", () => ({
  useExpense: vi.fn(),
  useCardTransactions: vi.fn(),
}));

vi.mock("@/components/ui/TransactionRow", () => ({
  TransactionRow: ({ title }: { title: string }) =>
    React.createElement("Pressable", {
      accessibilityRole: "button",
      accessibilityLabel: title,
    }),
}));

vi.mock("@/components/ui/EmptyState", () => ({
  EmptyState: ({ title }: { title: string }) =>
    React.createElement(
      "View",
      { testID: "empty-state" },
      React.createElement("Text", {}, title),
    ),
}));

const mockCard = {
  id: testId(1),
  userId: testId(1),
  name: "My Visa",
  cardNumberLast4: "3456",
  cardholderName: "John Doe",
  expiryMonth: 3,
  expiryYear: 2027,
  creditLimit: "5000",
  color: "#6366F1",
  cardType: "credit",
  currentBalance: "0",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockCategories = [
  {
    id: testId(10),
    userId: testId(1),
    name: "Food",
    type: "expense" as const,
    color: "#DC2626",
    icon: "fast-food-outline",
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockTransactions = [
  {
    id: testId(100),
    userId: testId(1),
    categoryId: testId(10),
    creditCardId: testId(1),
    type: "expense" as const,
    amount: "10.50",
    description: "Groceries",
    date: new Date("2026-06-01"),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: testId(101),
    userId: testId(1),
    categoryId: testId(10),
    creditCardId: testId(1),
    type: "expense" as const,
    amount: "5.25",
    description: "Coffee",
    date: new Date("2026-06-02"),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

function findByTestId(
  root: ReactTestInstance,
  testId: string,
): ReactTestInstance {
  const match = root.find((n) => n.props.testID === testId);
  if (!match) throw new Error(`testID ${testId} not found`);
  return match;
}

function renderScreen(): ReactTestInstance {
  let tree: ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<CardDetailScreen />);
  });
  return tree!.root;
}

describe("CardDetailScreen", () => {
  beforeEach(() => {
    vi.mocked(useExpense).mockReturnValue({
      creditCards: [mockCard],
      categories: mockCategories,
    } as ReturnType<typeof useExpense>);
    vi.mocked(useCardTransactions).mockReturnValue({
      cardTransactions: mockTransactions,
      loadingCardTransactions: false,
      refreshCardTransactions: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders TransactionRows and the card total for linked transactions", () => {
    const root = renderScreen();
    const rows = root.findAll(
      (n) =>
        n.props.accessibilityRole === "button" &&
        n.props.accessibilityLabel === "Food",
    );
    expect(rows.length).toBe(2);
    const total = root.find(
      (n) =>
        typeof n.props.accessibilityLabel === "string" &&
        n.props.accessibilityLabel.includes("15.75"),
    );
    expect(total).toBeDefined();
  });

  it("renders EmptyState when no linked transactions", () => {
    vi.mocked(useCardTransactions).mockReturnValue({
      cardTransactions: [],
      loadingCardTransactions: false,
      refreshCardTransactions: vi.fn(),
    });
    const root = renderScreen();
    const emptyState = findByTestId(root, "empty-state");
    expect(emptyState).toBeDefined();
    const title = root.find(
      (n) =>
        typeof n.props.children === "string" &&
        n.props.children === "No transactions for this card yet",
    );
    expect(title).toBeDefined();
  });

  it("shows loading indicator while card transactions fetch", () => {
    vi.mocked(useCardTransactions).mockReturnValue({
      cardTransactions: [],
      loadingCardTransactions: true,
      refreshCardTransactions: vi.fn(),
    });
    const root = renderScreen();
    const loading = findByTestId(root, "card-detail-loading");
    expect(loading).toBeDefined();
    const totalLoading = findByTestId(root, "card-detail-total-loading");
    expect(totalLoading).toBeDefined();
  });

  it("masks card number to last four digits in the header", () => {
    const root = renderScreen();
    const masked = root.find(
      (n) =>
        typeof n.props.children === "string" &&
        n.props.children.includes("•••• •••• •••• 3456"),
    );
    expect(masked).toBeDefined();
  });
});

describe("CardDetailScreen utilisation label", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  function renderWithUtilisation(
    creditLimit: string,
    transactionAmount: string | null,
  ): ReactTestInstance {
    vi.mocked(useExpense).mockReturnValue({
      creditCards: [{ ...mockCard, creditLimit }],
      categories: mockCategories,
    } as ReturnType<typeof useExpense>);
    vi.mocked(useCardTransactions).mockReturnValue({
      cardTransactions:
        transactionAmount === null
          ? []
          : [{ ...mockTransactions[0], amount: transactionAmount }],
      loadingCardTransactions: false,
      refreshCardTransactions: vi.fn(),
    });
    return renderScreen();
  }

  function utilisationNode(root: ReactTestInstance): ReactTestInstance {
    return root.find((n) => n.props.testID === "card-detail-utilisation");
  }

  function textOf(node: ReactTestInstance | string): string {
    if (typeof node === "string") return node;
    return (node.children ?? [])
      .map((c) => (typeof c === "string" ? c : textOf(c)))
      .join("");
  }

  // Extracts the exact leading percentage token (e.g. "34%", "<1%") so
  // assertions pin the actual value rather than a substring that a
  // regressed value like "100%" could also satisfy.
  function leadingPercentToken(text: string): string {
    return /^(?:<1%|\d+(?:\.\d+)?%)/.exec(text)?.[0] ?? "";
  }

  it.each([
    { total: "0", limit: "10000", expected: "0%" },
    { total: "1", limit: "10000", expected: "<1%" }, // 0.0001
    { total: "34", limit: "10000", expected: "<1%" }, // 0.0034
    { total: "50", limit: "10000", expected: "<1%" }, // 0.005
    { total: "99", limit: "10000", expected: "<1%" }, // 0.0099
    { total: "100", limit: "10000", expected: "1%" }, // 0.01
    { total: "3440", limit: "10000", expected: "34%" }, // 0.344
    { total: "10000", limit: "10000", expected: "100%" }, // 1.0
    { total: "15000", limit: "10000", expected: "150%" }, // 1.5
  ])(
    "never floors a non-zero utilisation to 0% ($total / $limit -> $expected)",
    ({ total, limit, expected }) => {
      const root = renderWithUtilisation(limit, total);
      const node = utilisationNode(root);
      expect(node).toBeDefined();

      const visibleText = textOf(node);
      expect(leadingPercentToken(visibleText)).toBe(expected);

      // "<1%" is spelled out for screen readers (see card-detail-screen.tsx)
      // — the announced value must still match the visible one exactly, in
      // whichever form it takes.
      const accessibleExpected = expected === "<1%" ? "less than 1%" : expected;
      expect(node.props.accessibilityLabel.startsWith(accessibleExpected)).toBe(
        true,
      );
    },
  );

  it("matches the exact 25.50 / 7500.50 example from the ticket", () => {
    const root = renderWithUtilisation("7500.50", "25.50");
    const node = utilisationNode(root);
    const visibleText = textOf(node);
    expect(leadingPercentToken(visibleText)).toBe("<1%");
    expect(node.props.accessibilityLabel.startsWith("less than 1%")).toBe(true);
  });

  it("keeps the genuine-zero case at 0% when balance is zero", () => {
    const root = renderWithUtilisation("5000", null);
    const node = utilisationNode(root);
    const visibleText = textOf(node);
    expect(visibleText.startsWith("0%")).toBe(true);
  });

  it("shows the over-limit suffix unchanged when balance exceeds the limit", () => {
    const root = renderWithUtilisation("10000", "15000");
    const node = utilisationNode(root);
    const visibleText = textOf(node);
    expect(visibleText).toContain("— over limit");
    expect(node.props.accessibilityLabel).toContain(", over limit");
  });

  it("keeps the utilisation block hidden when the card has no limit set", () => {
    const root = renderWithUtilisation("0", "10");
    const nodes = root.findAll(
      (n) => n.props.testID === "card-detail-utilisation",
    );
    expect(nodes).toHaveLength(0);
  });
});

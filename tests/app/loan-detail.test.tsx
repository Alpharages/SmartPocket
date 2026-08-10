import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";

import LoanDetailScreen from "@/app/loan/loan-detail-screen";
import { useLoanDetail } from "@/lib/expense-context";

const mockBack = vi.fn();
const mockUseLocalSearchParams = vi.fn(() => ({ id: "1" }));
const mockFormatCurrency = vi.hoisted(() =>
  vi.fn((amount: number, code?: string) => {
    const symbol = code === "EUR" ? "€" : "$";
    return `${symbol}${amount.toFixed(2)}`;
  }),
);
const mockCurrency = vi.hoisted(() => ({ current: "USD" as string }));

vi.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, push: vi.fn() }),
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

vi.mock("@/components/screen-container", () => ({
  ScreenContainer: ({
    children,
    testID,
  }: {
    children: React.ReactNode;
    testID?: string;
  }) => React.createElement("View", { testID }, children),
}));

vi.mock("@expo/vector-icons", () => {
  const Ionicons = ({ name, testID }: { name: string; testID?: string }) =>
    React.createElement("Ionicons", { name, testID });
  (Ionicons as any).glyphMap = {
    "chevron-back": 1,
    "receipt-outline": 1,
    "alert-circle": 1,
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
  warning: "#D97706",
  error: "#DC2626",
};

vi.mock("@/hooks/use-colors", () => ({
  useColors: () => mockColors,
}));

vi.mock("@/lib/currency-provider", () => ({
  useCurrency: () => ({
    currency: mockCurrency.current,
    setCurrency: vi.fn(),
    isReady: true,
  }),
}));

vi.mock("@/lib/currency", () => ({
  formatCurrency: mockFormatCurrency,
}));

vi.mock("@/lib/expense-context", () => ({
  useLoanDetail: vi.fn(),
  useExpense: () => ({
    refreshLoans: vi.fn().mockResolvedValue(undefined),
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

vi.mock("@/components/ui/StatCard", () => ({
  StatCard: ({
    label,
    amount,
    accessibilityLabel,
  }: {
    label: string;
    amount: number;
    accessibilityLabel?: string;
  }) =>
    React.createElement(
      "View",
      {
        testID: `stat-${label.toLowerCase().replace(/\s+/g, "-")}`,
        accessibilityLabel: accessibilityLabel ?? `${label} ${amount}`,
      },
      React.createElement("Text", {}, label),
    ),
}));

const mockLoanDetail = {
  id: 1,
  userId: 1,
  direction: "lend" as const,
  counterparty: "Alex",
  principal: "1000.00",
  rate: "5.00",
  periodicity: "monthly" as const,
  installmentCount: 12,
  endDate: null,
  nextDueDate: new Date("2026-07-01T00:00:00.000Z"),
  status: "active" as const,
  note: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  remainingBalance: "600.00",
  repayments: [
    {
      id: 1,
      loanId: 1,
      userId: 1,
      amount: "250.00",
      date: new Date("2026-05-01T00:00:00.000Z"),
      note: "First payment",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 2,
      loanId: 1,
      userId: 1,
      amount: "150.00",
      date: new Date("2026-04-01T00:00:00.000Z"),
      note: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
};

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
    tree = TestRenderer.create(<LoanDetailScreen />);
  });
  return tree!.root;
}

describe("LoanDetailScreen", () => {
  beforeEach(() => {
    mockCurrency.current = "USD";
    mockFormatCurrency.mockClear();
    mockUseLocalSearchParams.mockReturnValue({ id: "1" });
    vi.mocked(useLoanDetail).mockReturnValue({
      loanDetail: mockLoanDetail,
      loadingLoanDetail: false,
      loanDetailError: false,
      refreshLoanDetail: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders schedule, remaining balance, and repayment history", () => {
    const root = renderScreen();
    expect(findByTestId(root, "loan-detail-screen")).toBeDefined();
    expect(findByTestId(root, "stat-remaining-balance")).toBeDefined();
    expect(findByTestId(root, "repayment-row-0")).toBeDefined();
    expect(findByTestId(root, "repayment-row-1")).toBeDefined();
  });

  it("renders EmptyState when there are no repayments", () => {
    vi.mocked(useLoanDetail).mockReturnValue({
      loanDetail: { ...mockLoanDetail, repayments: [] },
      loadingLoanDetail: false,
      loanDetailError: false,
      refreshLoanDetail: vi.fn(),
    });
    const root = renderScreen();
    const emptyState = findByTestId(root, "empty-state");
    expect(emptyState).toBeDefined();
    const title = root.find(
      (n) =>
        typeof n.props.children === "string" &&
        n.props.children === "No repayments yet",
    );
    expect(title).toBeDefined();
  });

  it("shows loading indicator while loan detail fetches", () => {
    vi.mocked(useLoanDetail).mockReturnValue({
      loanDetail: null,
      loadingLoanDetail: true,
      loanDetailError: false,
      refreshLoanDetail: vi.fn(),
    });
    const root = renderScreen();
    expect(findByTestId(root, "loan-detail-loading")).toBeDefined();
  });

  it("shows not found for invalid route id", () => {
    mockUseLocalSearchParams.mockReturnValue({ id: "abc" });
    const root = renderScreen();
    expect(findByTestId(root, "loan-detail-invalid")).toBeDefined();
  });

  it("shows not found when loan is missing", () => {
    vi.mocked(useLoanDetail).mockReturnValue({
      loanDetail: null,
      loadingLoanDetail: false,
      loanDetailError: true,
      refreshLoanDetail: vi.fn(),
    });
    const root = renderScreen();
    expect(findByTestId(root, "loan-detail-not-found")).toBeDefined();
  });

  it("shows not found when API returns null without error", () => {
    vi.mocked(useLoanDetail).mockReturnValue({
      loanDetail: null,
      loadingLoanDetail: false,
      loanDetailError: false,
      refreshLoanDetail: vi.fn(),
    });
    const root = renderScreen();
    expect(findByTestId(root, "loan-detail-not-found")).toBeDefined();
  });

  it("does not fetch with an invalid route id", () => {
    mockUseLocalSearchParams.mockReturnValue({ id: "abc" });
    renderScreen();
    expect(useLoanDetail).toHaveBeenCalledWith(Number.NaN);
  });

  it("shows Settled next due label for settled loans", () => {
    vi.mocked(useLoanDetail).mockReturnValue({
      loanDetail: { ...mockLoanDetail, status: "settled" },
      loadingLoanDetail: false,
      loanDetailError: false,
      refreshLoanDetail: vi.fn(),
    });
    const root = renderScreen();
    const settledLabel = root.find(
      (n) =>
        typeof n.props.accessibilityLabel === "string" &&
        n.props.accessibilityLabel === "Next due Settled",
    );
    expect(settledLabel).toBeDefined();
  });

  it("formats money with the configured currency", () => {
    mockCurrency.current = "EUR";
    renderScreen();
    expect(mockFormatCurrency).toHaveBeenCalledWith(600, "EUR");
    expect(mockFormatCurrency).toHaveBeenCalledWith(250, "EUR");
  });

  it("shows record repayment button for active loans", () => {
    const root = renderScreen();
    expect(findByTestId(root, "record-repayment-button")).toBeDefined();
  });

  it("disables record repayment when loan is settled", () => {
    vi.mocked(useLoanDetail).mockReturnValue({
      loanDetail: {
        ...mockLoanDetail,
        status: "settled",
        remainingBalance: "0.00",
      },
      loadingLoanDetail: false,
      loanDetailError: false,
      refreshLoanDetail: vi.fn(),
    });
    const root = renderScreen();
    const button = findByTestId(root, "record-repayment-button");
    expect(button?.props.disabled).toBe(true);
  });

  it("sorts repayments newest first", () => {
    const root = renderScreen();
    const newest = root.find(
      (n) =>
        n.props.testID === "repayment-row-0" &&
        typeof n.props.accessibilityLabel === "string" &&
        n.props.accessibilityLabel.includes("250.00"),
    );
    expect(newest).toBeDefined();
  });

  it("marks overdue next due dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T12:00:00.000Z"));
    vi.mocked(useLoanDetail).mockReturnValue({
      loanDetail: {
        ...mockLoanDetail,
        nextDueDate: new Date("2026-07-01T00:00:00.000Z"),
      },
      loadingLoanDetail: false,
      loanDetailError: false,
      refreshLoanDetail: vi.fn(),
    });
    const root = renderScreen();
    const overdueLabel = root.find(
      (n) =>
        typeof n.props.accessibilityLabel === "string" &&
        n.props.accessibilityLabel.startsWith("Next due Overdue"),
    );
    expect(overdueLabel).toBeDefined();
    vi.useRealTimers();
  });
});

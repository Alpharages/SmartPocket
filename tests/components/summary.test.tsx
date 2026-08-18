import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";

import { useExpense } from "@/lib/expense-context";
import SummaryScreen from "@/app/(tabs)/summary";
import { testId, syncColumns } from "../helpers/ids";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const mockPush = vi.fn();

vi.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: vi.fn() }),
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
    "chevron-back": 1,
    "chevron-forward": 1,
    "wallet-outline": 1,
    "arrow-down": 1,
    "arrow-up": 1,
    "analytics-outline": 1,
    "pie-chart-outline": 1,
    "settings-outline": 1,
    "receipt-outline": 1,
    pricetag: 1,
    "pricetag-outline": 1,
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

// The migrated screen (and GlassSurface, which it now renders inside the
// trend/category cards) reads colors via useThemeTokens() — never the
// theme-agnostic useColors() (AC3). GlassSurface additionally needs `glass`
// + `colorScheme` to resolve its blur/fallback fill (lesson: a shared
// primitive's hook dependency needs its consumers' mocks extended, not the
// primitive itself touched).
vi.mock("@/lib/theme-provider", () => ({
  useThemeTokens: () => ({
    colors: mockColors,
    colorScheme: "light",
    themeId: "aurora",
    glass: {
      blur: 20,
      tint: "#FFFFFF",
      surfaceOpacity: 0.6,
      borderOpacity: 0.4,
    },
    gradient: { colors: ["#818CF8", "#C4B5FD", "#67E8F9"], angle: 135 },
  }),
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

vi.mock("@/lib/expense-context", () => ({
  useExpense: vi.fn(),
}));

const mockUseQuery = vi.hoisted(() => vi.fn());

vi.mock("@/lib/trpc", () => ({
  trpc: {
    summary: {
      monthlyTrend: {
        useQuery: (...args: unknown[]) => mockUseQuery("monthlyTrend", ...args),
      },
      categoryAnomalies: {
        useQuery: (...args: unknown[]) =>
          mockUseQuery("categoryAnomalies", ...args),
      },
    },
  },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date("2026-06-15T10:00:00Z");

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
  {
    id: testId(3),
    userId: testId(1),
    name: "Transport",
    type: "expense" as const,
    color: "#2563EB",
    icon: "car-outline",
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

function makeTransaction(overrides: Partial<any> = {}) {
  return {
    id: overrides.id ?? 1,
    categoryId: overrides.categoryId ?? 2,
    type: overrides.type ?? "expense",
    amount: overrides.amount ?? "40.00",
    description: overrides.description ?? null,
    date: overrides.date ?? new Date("2026-06-10T10:00:00Z"),
  };
}

const defaultMonthlyStats = {
  totalIncome: 5000,
  totalExpense: 1800,
  netBalance: 3200,
};

const defaultExpenseState = {
  monthlyStats: defaultMonthlyStats,
  loadingStats: false,
  loadingTransactions: false,
  refreshMonthlyStats: vi.fn(),
  categories: mockCategories,
  transactions: [
    makeTransaction({ id: testId(1), categoryId: testId(2), amount: "120.00" }),
    makeTransaction({ id: testId(2), categoryId: testId(3), amount: "60.00" }),
    makeTransaction({ id: testId(3), categoryId: testId(2), amount: "30.00" }),
  ],
  refreshTransactions: vi.fn(),
};

function render(ui: React.ReactElement): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(ui);
  });
  return renderer;
}

function collectText(node: ReactTestInstance): string {
  return node
    .findAll(
      (n) =>
        typeof n.type === "string" &&
        n.children.some((c) => typeof c === "string"),
    )
    .flatMap((n) =>
      n.children.filter((c): c is string => typeof c === "string"),
    )
    .join(" ");
}

describe("SummaryScreen", () => {
  beforeEach(() => {
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  function setup(overrides: Partial<typeof defaultExpenseState> = {}) {
    (useExpense as ReturnType<typeof vi.fn>).mockReturnValue({
      ...defaultExpenseState,
      ...overrides,
    });
    mockUseQuery.mockImplementation((kind: string) => {
      if (kind === "monthlyTrend") {
        return { data: [], isLoading: false, refetch: vi.fn() };
      }
      return { data: [], refetch: vi.fn() };
    });
  }

  it("renders the Insights header and monthly stat cards from monthlyStats", () => {
    setup();
    const root = render(<SummaryScreen />);
    const text = collectText(root.root);
    expect(text).toContain("Insights");
    // StatCard amounts render as formatted currency text somewhere in the tree.
    expect(text).toMatch(/3,200|3200/);
    expect(text).toMatch(/5,000|5000/);
    expect(text).toMatch(/1,800|1800/);
  });

  it("computes the category breakdown (FR-9) from the current month's transactions", () => {
    setup();
    const root = render(<SummaryScreen />);
    const text = collectText(root.root);
    // Food: 120 + 30 = 150 (2 transactions), Transport: 60 (1 transaction).
    expect(text).toContain("Food");
    expect(text).toContain("Transport");
    // Food (150) should out-rank Transport (60) — sorted desc by total.
    expect(text.indexOf("Food")).toBeLessThan(text.indexOf("Transport"));
  });

  it("shows the 'No spending data' empty state when there are no transactions this month", () => {
    setup({ transactions: [] });
    const root = render(<SummaryScreen />);
    const text = collectText(root.root);
    expect(text).toContain("No spending data");
  });

  it("shows the 'No spending history' empty state when the trend query has no history", () => {
    setup();
    const root = render(<SummaryScreen />);
    const text = collectText(root.root);
    expect(text).toContain("No spending history");
  });

  it("navigating to the previous month calls refreshMonthlyStats with the new year/month", () => {
    const refreshMonthlyStats = vi.fn();
    setup({ refreshMonthlyStats });
    const root = render(<SummaryScreen />);
    const prevButton = root.root.find(
      (n) => n.props.accessibilityLabel === "Previous month",
    );
    act(() => {
      prevButton.props.onPress();
    });
    // NOW is 2026-06-15 → previous month is May 2026.
    expect(refreshMonthlyStats).toHaveBeenCalledWith(2026, 5);
  });

  it("cannot navigate past the current month (SP-045)", () => {
    // "Next" used to be unbounded, so a user could page indefinitely into
    // empty future months with no shortcut back to today.
    const refreshMonthlyStats = vi.fn();
    setup({ refreshMonthlyStats });
    const root = render(<SummaryScreen />);
    const nextButton = root.root.find(
      (n) => n.props.accessibilityLabel === "Next month",
    );
    expect(nextButton.props.accessibilityState?.disabled).toBe(true);

    act(() => {
      nextButton.props.onPress();
    });
    expect(refreshMonthlyStats).not.toHaveBeenCalled();
  });

  it("navigating back then forward calls refreshMonthlyStats with the new year/month", () => {
    const refreshMonthlyStats = vi.fn();
    setup({ refreshMonthlyStats });
    const root = render(<SummaryScreen />);

    // NOW is 2026-06-15. Step back to May, then forward again to June.
    act(() => {
      root.root
        .find((n) => n.props.accessibilityLabel === "Previous month")
        .props.onPress();
    });
    expect(refreshMonthlyStats).toHaveBeenCalledWith(2026, 5);

    act(() => {
      root.root
        .find((n) => n.props.accessibilityLabel === "Next month")
        .props.onPress();
    });
    expect(refreshMonthlyStats).toHaveBeenLastCalledWith(2026, 6);
  });

  it("renders the settings action button that navigates to /settings", () => {
    setup();
    const root = render(<SummaryScreen />);
    const settingsButton = root.root.find(
      (n) => n.props.accessibilityLabel === "Open settings",
    );
    act(() => {
      settingsButton.props.onPress();
    });
    expect(mockPush).toHaveBeenCalledWith("/settings");
  });
});

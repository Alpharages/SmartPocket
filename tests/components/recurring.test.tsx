import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TestRenderer, { act, type ReactTestRenderer } from "react-test-renderer";

import RecurringScreen from "@/app/recurring";
import { useExpense, type RecurringTransaction } from "@/lib/expense-context";

vi.mock("expo-router", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/lib/expense-context", () => ({
  useExpense: vi.fn(),
}));

vi.mock("@/components/screen-container", () => ({
  ScreenContainer: ({ children }: { children: React.ReactNode }) =>
    React.createElement("View", {}, children),
}));

vi.mock("@/components/responsive-content", () => ({
  ResponsiveContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement("View", {}, children),
}));

vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: "light" },
}));

vi.mock("@expo/vector-icons", () => {
  const Ionicons = ({ name, testID }: { name: string; testID?: string }) =>
    React.createElement("Ionicons", { name, testID });
  (Ionicons as any).glyphMap = {
    "home-outline": 1,
    "chevron-back": 1,
    add: 1,
    repeat: 1,
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
  formatSignedCurrency: (amount: string) => `$${amount}`,
  getCurrencySymbol: () => "$",
}));

vi.mock("@/lib/_core/contrast", () => ({
  readableTextOn: () => "#FFFFFF",
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
  getElevationStyle: () => ({}),
  ...TOKENS,
  Motion: {
    sheet: { durationMs: 0, closeDurationMs: 0, backdropOpacity: 0.6 },
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

const activeRule: RecurringTransaction = {
  id: 42,
  userId: 1,
  categoryId: 1,
  creditCardId: null,
  type: "expense",
  amount: "50.00",
  description: "Rent",
  frequency: "monthly",
  interval: 1,
  endCondition: "never",
  occurrenceCount: null,
  endDate: null,
  startDate: new Date("2026-06-01"),
  nextRunDate: new Date("2026-07-01"),
  lastRunDate: null,
  generatedCount: 0,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("RecurringScreen", () => {
  const cancelRecurringTransaction = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    cancelRecurringTransaction.mockClear();
    vi.mocked(useExpense).mockReturnValue({
      recurringTransactions: [activeRule],
      loadingRecurringTransactions: false,
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
      addRecurringTransaction: vi.fn(),
      updateRecurringTransaction: vi.fn(),
      cancelRecurringTransaction,
    } as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("cancels an active rule via ConfirmSheet (AC6)", async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<RecurringScreen />);
    });

    const stopButton = tree.root.findByProps({
      accessibilityLabel: "Stop recurring rule for Rent",
    });
    await act(async () => {
      stopButton.props.onPress();
    });

    const confirmButton = tree.root.findByProps({ label: "Stop" });
    await act(async () => {
      await confirmButton.props.onPress();
    });

    expect(cancelRecurringTransaction).toHaveBeenCalledWith(42);
  });
});

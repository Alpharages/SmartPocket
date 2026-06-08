import React from "react";
import { Platform } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";

import { useExpense } from "@/lib/expense-context";
import CardsScreen from "@/app/(tabs)/cards";

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
    "card-outline": 1,
    add: 1,
    checkmark: 1,
    close: 1,
    "chevron-down": 1,
    "chevron-forward": 1,
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
// `@/lib/_core/theme` mock factories reference one source of truth.
const TOKENS = vi.hoisted(() => ({
  Radius: { sm: 8, md: 12, lg: 16, full: 9999 },
  Spacing: { sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32 },
  Typography: {
    body: { fontSize: 14, lineHeight: 20, fontWeight: "400" },
    caption: { fontSize: 12, lineHeight: 16, fontWeight: "400" },
    h3: { fontSize: 18, lineHeight: 26, fontWeight: "600" },
    label: { fontSize: 13, lineHeight: 18, fontWeight: "500" },
  },
  ContentMaxWidth: {
    dashboard: 1120,
    screen: 960,
    sheet: 560,
    modal: 640,
    card: 420,
  },
}));

vi.mock("@/constants/theme", () => ({
  resolveCategoryColor: (color: string) => color,
  CATEGORY_COLOR_LIGHT_VALUES: ["#4F46E5", "#047857", "#E11D48"],
  CATEGORY_DEFAULT_COLOR: "#4F46E5",
  ...TOKENS,
}));

vi.mock("@/lib/_core/theme", () => ({
  ...TOKENS,
  Motion: {
    sheet: { durationMs: 300, closeDurationMs: 250 },
    fade: { durationMs: 200 },
  },
  Elevation: { card: { shadowColor: "#000", shadowOpacity: 0.1, elevation: 2 } },
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

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ show: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockCreditCard = {
  id: 1,
  userId: 1,
  name: "My Visa",
  cardNumber: "4111111111111111",
  cardholderName: "John Doe",
  expiryMonth: 12,
  expiryYear: 2030,
  color: "#6366F1",
  creditLimit: "5000",
  currentBalance: "0",
  cardType: "credit",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const baseExpenseContext = {
  categories: [],
  loadingCategories: false,
  addCategory: vi.fn(),
  deleteCategory: vi.fn(),
  transactions: [],
  loadingTransactions: false,
  addTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  stats: null,
  loadingStats: false,
  creditCards: [mockCreditCard],
  loadingCards: false,
  addCreditCard: vi.fn().mockResolvedValue(undefined),
  deleteCreditCard: vi.fn().mockResolvedValue(undefined),
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
    renderer = TestRenderer.create(<CardsScreen />);
  });
  return renderer.root;
}

function findByTestId(root: ReactTestInstance, testID: string): ReactTestInstance {
  return root.find((n) => n.props.testID === testID);
}

function flattenStyle(style: unknown): Record<string, unknown> {
  return Array.isArray(style)
    ? Object.assign({}, ...style.filter(Boolean))
    : ((style as Record<string, unknown>) ?? {});
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CardsScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Platform.OS = "ios";
  });

  it("AC: add card action renders as Button primitive with testID=add-card-button", () => {
    const root = renderScreen();
    const btn = findByTestId(root, "add-card-button");
    const pressable = btn.find((n) => n.props.accessibilityRole === "button");
    expect(pressable).toBeDefined();
  });

  it("AC: add card button opts out of desktop full-width stretch", () => {
    Platform.OS = "web";
    const root = renderScreen();
    const btn = findByTestId(root, "add-card-button");
    const pressable = btn.find((n) => n.props.accessibilityRole === "button");
    expect(pressable.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ alignSelf: "flex-start" }),
      ]),
    );
  });

  it("AC: credit card preview is capped (not edge-to-edge) on web", () => {
    Platform.OS = "web";
    const root = renderScreen();
    const preview = findByTestId(root, "card-preview-0");
    const style = flattenStyle(preview.props.style);
    expect(style.width).toBe("100%");
    expect(style.maxWidth).toBe(420);
    expect(style.alignSelf).toBe("flex-start");
  });

  it("leaves credit card preview unconstrained on native", () => {
    const root = renderScreen();
    const preview = findByTestId(root, "card-preview-0");
    expect(preview.props.style).toBeUndefined();
  });
});

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";

import { useExpense } from "@/lib/expense-context";
import LoansScreen from "@/app/(tabs)/loans";

const mockPush = vi.hoisted(() => vi.fn());

vi.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: vi.fn() }),
  useNavigation: () => ({ setOptions: vi.fn() }),
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
    add: 1,
    "cash-outline": 1,
    close: 1,
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

vi.mock("@/lib/theme-provider", () => ({
  useThemeTokens: () => ({ colors: mockColors }),
}));

vi.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

vi.mock("@/lib/currency-provider", () => ({
  useCurrency: () => ({ currency: { code: "USD" } }),
}));

vi.mock("@/lib/currency", () => ({
  formatCurrency: (amount: number) => `$${amount.toFixed(2)}`,
}));

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

vi.mock("@/lib/_core/theme", () => ({
  getElevationStyle: () => ({}),
  ...TOKENS,
  Motion: {
    press: { scale: 0.97, durationMs: 120 },
    sheet: { durationMs: 300, closeDurationMs: 250 },
    screen: { durationMs: 280, easing: "easeOutCubic" },
    countUp: { durationMs: 700, easing: "easeOut" },
    celebration: { durationMs: 220, scaleFrom: 0.85, easing: "easeOutBack" },
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

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ show: vi.fn() }),
}));

vi.mock("@/lib/expense-context", () => ({
  useExpense: vi.fn(),
}));

const mockLoan = {
  id: 1,
  userId: 1,
  direction: "lend" as const,
  counterparty: "Alex",
  principal: "250.00",
  rate: "5.00",
  periodicity: "monthly" as const,
  installmentCount: 10,
  endDate: null,
  nextDueDate: new Date("2026-07-01T00:00:00.000Z"),
  status: "active" as const,
  note: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockAddLoan = vi.fn().mockResolvedValue(undefined);

const baseExpenseContext = {
  loans: [] as (typeof mockLoan)[],
  loadingLoans: false,
  addLoan: mockAddLoan,
  refreshLoans: vi.fn(),
};

function renderScreen(
  contextOverride: Partial<typeof baseExpenseContext> = {},
): ReactTestRenderer {
  (useExpense as ReturnType<typeof vi.fn>).mockReturnValue({
    ...baseExpenseContext,
    ...contextOverride,
  });
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<LoansScreen />);
  });
  return renderer;
}

function findByTestId(
  root: ReactTestInstance,
  testID: string,
): ReactTestInstance {
  return root.find((n) => n.props.testID === testID);
}

function findAllTextInputs(root: ReactTestInstance): ReactTestInstance[] {
  return root.findAll((n) => String(n.type) === "TextInput");
}

describe("LoansScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders New loan action and empty state when there are no loans", () => {
    const renderer = renderScreen();
    const root = renderer.root;
    expect(findByTestId(root, "new-loan-button")).toBeDefined();
    const emptyTitle = root.find(
      (n) => String(n.type) === "Text" && n.props.children === "No loans yet",
    );
    expect(emptyTitle).toBeDefined();
  });

  it("opens the create sheet when New loan is pressed", () => {
    const renderer = renderScreen();
    const root = renderer.root;
    const button = findByTestId(root, "new-loan-button");
    const pressable = button.find(
      (n) => n.props.accessibilityRole === "button",
    );
    act(() => {
      pressable.props.onPress();
    });
    expect(findByTestId(renderer.root, "new-loan-sheet")).toBeDefined();
  });

  it("keeps Save disabled until principal is entered", () => {
    const renderer = renderScreen();
    act(() => {
      findByTestId(renderer.root, "new-loan-button")
        .find((n) => n.props.accessibilityRole === "button")
        .props.onPress();
    });
    const saveButton = findByTestId(renderer.root, "save-loan-button");
    const savePressable = saveButton.find(
      (n) => n.props.accessibilityRole === "button",
    );
    expect(savePressable.props.accessibilityState?.disabled).toBe(true);
    expect(findByTestId(renderer.root, "loan-form-errors")).toBeDefined();
  });

  it("enables Save once principal is entered with defaults", () => {
    const renderer = renderScreen();
    act(() => {
      findByTestId(renderer.root, "new-loan-button")
        .find((n) => n.props.accessibilityRole === "button")
        .props.onPress();
    });
    const root = renderer.root;
    const principalInput = findAllTextInputs(root).find(
      (input) => input.props.accessibilityLabel === "Principal amount",
    )!;
    act(() => {
      principalInput.props.onChangeText("250");
    });
    const savePressable = findByTestId(root, "save-loan-button").find(
      (n) => n.props.accessibilityRole === "button",
    );
    expect(savePressable.props.accessibilityState?.disabled).toBe(false);
  });

  it("calls addLoan once on valid save and closes the sheet", async () => {
    const renderer = renderScreen();
    act(() => {
      findByTestId(renderer.root, "new-loan-button")
        .find((n) => n.props.accessibilityRole === "button")
        .props.onPress();
    });

    const root = renderer.root;
    const directionLend = root.find(
      (n) =>
        n.props.accessibilityLabel === "lend direction" &&
        n.props.accessibilityRole === "button",
    );
    act(() => {
      directionLend.props.onPress();
    });

    const monthly = root.find(
      (n) =>
        n.props.accessibilityLabel === "monthly periodicity" &&
        n.props.accessibilityRole === "button",
    );
    act(() => {
      monthly.props.onPress();
    });

    const inputs = findAllTextInputs(root);
    const byLabel = (label: string) =>
      inputs.find((input) => input.props.accessibilityLabel === label)!;

    act(() => {
      byLabel("Counterparty").props.onChangeText("Alex");
      byLabel("Principal amount").props.onChangeText("250.00");
      byLabel("Installment count").props.onChangeText("10");
      byLabel("Next due date").props.onChangeText("2026-07-01");
    });

    const savePressable = findByTestId(root, "save-loan-button").find(
      (n) => n.props.accessibilityRole === "button",
    );

    await act(async () => {
      await savePressable.props.onPress();
    });

    expect(mockAddLoan).toHaveBeenCalledTimes(1);
    expect(mockAddLoan).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: "lend",
        counterparty: "Alex",
        principal: "250.00",
        periodicity: "monthly",
        installmentCount: 10,
      }),
    );

    const sheet = findByTestId(renderer.root, "new-loan-sheet");
    expect(sheet.props.visible).toBe(false);
  });

  it("keeps the sheet open when addLoan fails", async () => {
    mockAddLoan.mockRejectedValueOnce(new Error("network"));
    const renderer = renderScreen();

    act(() => {
      findByTestId(renderer.root, "new-loan-button")
        .find((n) => n.props.accessibilityRole === "button")
        .props.onPress();
    });

    const root = renderer.root;
    act(() => {
      root
        .find(
          (n) =>
            n.props.accessibilityLabel === "lend direction" &&
            n.props.accessibilityRole === "button",
        )
        .props.onPress();
      root
        .find(
          (n) =>
            n.props.accessibilityLabel === "none periodicity" &&
            n.props.accessibilityRole === "button",
        )
        .props.onPress();
    });

    const inputs = findAllTextInputs(root);
    act(() => {
      inputs
        .find((input) => input.props.accessibilityLabel === "Principal amount")!
        .props.onChangeText("100.00");
      inputs
        .find((input) => input.props.accessibilityLabel === "Next due date")!
        .props.onChangeText("2026-07-01");
    });

    const savePressable = findByTestId(root, "save-loan-button").find(
      (n) => n.props.accessibilityRole === "button",
    );

    await act(async () => {
      await savePressable.props.onPress();
    });

    expect(findByTestId(renderer.root, "new-loan-sheet").props.visible).toBe(
      true,
    );
  });

  it("lists existing loans", () => {
    const renderer = renderScreen({ loans: [mockLoan] });
    expect(findByTestId(renderer.root, "loan-item-0")).toBeDefined();
  });

  it("navigates to loan detail when a list item is pressed", () => {
    const renderer = renderScreen({ loans: [mockLoan] });
    const item = findByTestId(renderer.root, "loan-item-0");
    const pressable = item.find((n) => n.props.accessibilityRole === "button");
    act(() => {
      pressable.props.onPress();
    });
    expect(mockPush).toHaveBeenCalledWith("/loan/1");
  });
});

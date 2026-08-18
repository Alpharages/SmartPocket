import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";

import { useExpense } from "@/lib/expense-context";
import { formatCurrency } from "@/lib/currency";
import AccountsScreen from "@/app/accounts";
import type { Id } from "@/drizzle/schema";
import { testId, syncColumns } from "../helpers/ids";

const mockBack = vi.hoisted(() => vi.fn());

vi.mock("expo-router", () => ({
  useRouter: () => ({ push: vi.fn(), back: mockBack }),
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
    "arrow-back": 1,
    checkmark: 1,
    "chevron-down": 1,
    pencil: 1,
    "trash-outline": 1,
    "wallet-outline": 1,
    "swap-horizontal": 1,
  };
  return { Ionicons };
});

vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: "light" },
}));

vi.mock("@/hooks/use-press-feedback", () => ({
  usePressFeedback: () => ({
    animatedStyle: {},
    onPressIn: vi.fn(),
    onPressOut: vi.fn(),
  }),
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
  CATEGORY_COLOR_LIGHT_VALUES: ["#4F46E5"],
  CATEGORY_DEFAULT_COLOR: "#4F46E5",
  ...TOKENS,
}));

vi.mock("@/lib/_core/theme", () => ({
  // Bottom clearance for the floating tab bar (SP-062).
  TAB_BAR_CLEARANCE: 128,
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
}));

vi.mock("@/lib/currency-provider", () => ({
  useCurrency: () => ({ currency: "USD", setCurrency: vi.fn() }),
}));

vi.mock("@/lib/expense-context", () => ({
  useExpense: vi.fn(),
}));

const mockConfirm = vi.hoisted(() => vi.fn().mockResolvedValue(true));
const mockToastShow = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-confirm", () => ({
  useConfirm: () => ({
    visible: false,
    options: {},
    confirm: mockConfirm,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  }),
}));

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ show: mockToastShow }),
}));

const sampleAccount = {
  id: testId(1),
  userId: testId(1),
  name: "Cash Wallet",
  type: "cash" as const,
  currency: "USD",
  isDefault: false,
  createdAt: new Date("2026-06-01"),
  updatedAt: new Date("2026-06-01"),
};

const secondAccount = {
  ...sampleAccount,
  id: testId(2),
  name: "Main Bank",
  type: "bank" as const,
};

function findByTestId(
  root: ReactTestInstance,
  testID: string,
): ReactTestInstance | null {
  if (root.props?.testID === testID) return root;
  for (const child of root.children) {
    if (typeof child !== "object" || child === null) continue;
    const found = findByTestId(child as ReactTestInstance, testID);
    if (found) return found;
  }
  return null;
}

function findByAccessibilityLabel(
  root: ReactTestInstance,
  label: string,
): ReactTestInstance | null {
  if (root.props?.accessibilityLabel === label) return root;
  for (const child of root.children) {
    if (typeof child !== "object" || child === null) continue;
    const found = findByAccessibilityLabel(child as ReactTestInstance, label);
    if (found) return found;
  }
  return null;
}

describe("AccountsScreen", () => {
  let renderer: ReactTestRenderer;
  const addAccount = vi.fn().mockResolvedValue(undefined);
  const updateAccount = vi.fn().mockResolvedValue(undefined);
  const deleteAccount = vi.fn().mockResolvedValue(undefined);
  const reassignAndDeleteAccount = vi.fn().mockResolvedValue(undefined);
  const fetchAccountTransactionCount = vi.fn().mockResolvedValue(0);
  const fetchAccountTransferCount = vi.fn().mockResolvedValue(0);
  const refreshAccounts = vi.fn().mockResolvedValue(undefined);
  const refreshAccountBalances = vi.fn().mockResolvedValue(undefined);
  const getAccountBalance = vi.fn((id: Id) => (id === testId(1) ? 125.5 : 0));
  const addTransfer = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.mocked(useExpense).mockReturnValue({
      accounts: [sampleAccount, secondAccount],
      loadingAccounts: false,
      refreshAccounts,
      refreshAccountBalances,
      getAccountBalance,
      addAccount,
      updateAccount,
      deleteAccount,
      reassignAndDeleteAccount,
      fetchAccountTransactionCount,
      fetchAccountTransferCount,
      addTransfer,
    } as unknown as ReturnType<typeof useExpense>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders account rows with accessible labels", async () => {
    await act(async () => {
      renderer = TestRenderer.create(<AccountsScreen />);
    });

    expect(
      findByAccessibilityLabel(
        renderer.root,
        `Cash Wallet, Cash, balance ${formatCurrency(125.5, "USD")}`,
      ),
    ).not.toBeNull();
    expect(
      findByAccessibilityLabel(
        renderer.root,
        `Main Bank, Bank, balance ${formatCurrency(0, "USD")}`,
      ),
    ).not.toBeNull();
  });

  it("formats every account balance in the display currency (SP-D08)", async () => {
    const euroAccount = {
      ...sampleAccount,
      id: testId(3),
      name: "Euro Bank",
      currency: "EUR",
      type: "bank" as const,
    };
    vi.mocked(useExpense).mockReturnValue({
      accounts: [euroAccount],
      loadingAccounts: false,
      refreshAccounts,
      refreshAccountBalances,
      getAccountBalance: vi.fn(() => 99.99),
      addAccount,
      updateAccount,
      deleteAccount,
      reassignAndDeleteAccount,
      fetchAccountTransactionCount,
    } as unknown as ReturnType<typeof useExpense>);

    await act(async () => {
      renderer = TestRenderer.create(<AccountsScreen />);
    });

    expect(
      findByAccessibilityLabel(
        renderer.root,
        `Euro Bank, Bank, balance ${formatCurrency(99.99, "USD")}`,
      ),
    ).not.toBeNull();
  });

  it("formats a foreign-labelled account in the display currency (SP-D08)", async () => {
    const yenAccount = {
      ...sampleAccount,
      id: testId(4),
      name: "Yen Wallet",
      currency: "JPY",
      type: "cash" as const,
    };
    vi.mocked(useExpense).mockReturnValue({
      accounts: [yenAccount],
      loadingAccounts: false,
      refreshAccounts,
      refreshAccountBalances,
      getAccountBalance: vi.fn(() => 0),
      addAccount,
      updateAccount,
      deleteAccount,
      reassignAndDeleteAccount,
      fetchAccountTransactionCount,
    } as unknown as ReturnType<typeof useExpense>);

    await act(async () => {
      renderer = TestRenderer.create(<AccountsScreen />);
    });

    // SP-D08: the account is labelled JPY, but the balance is folded from
    // transaction amounts that are denominated in the display currency — so it
    // must render as USD here, not as "¥0".
    expect(
      findByAccessibilityLabel(
        renderer.root,
        `Yen Wallet, Cash, balance ${formatCurrency(0, "USD")}`,
      ),
    ).not.toBeNull();
  });

  it("renders a negative balance with its sign and currency", async () => {
    vi.mocked(useExpense).mockReturnValue({
      accounts: [sampleAccount],
      loadingAccounts: false,
      refreshAccounts,
      refreshAccountBalances,
      getAccountBalance: vi.fn(() => -42.5),
      addAccount,
      updateAccount,
      deleteAccount,
      reassignAndDeleteAccount,
      fetchAccountTransactionCount,
    } as unknown as ReturnType<typeof useExpense>);

    await act(async () => {
      renderer = TestRenderer.create(<AccountsScreen />);
    });

    expect(formatCurrency(-42.5, "USD")).toContain("-");
    expect(
      findByAccessibilityLabel(
        renderer.root,
        `Cash Wallet, Cash, balance ${formatCurrency(-42.5, "USD")}`,
      ),
    ).not.toBeNull();
  });

  it("shows a balance loading indicator while balances are loading", async () => {
    vi.mocked(useExpense).mockReturnValue({
      accounts: [sampleAccount],
      loadingAccounts: false,
      loadingAccountBalances: true,
      refreshAccounts,
      refreshAccountBalances,
      getAccountBalance,
      addAccount,
      updateAccount,
      deleteAccount,
      reassignAndDeleteAccount,
      fetchAccountTransactionCount,
    } as unknown as ReturnType<typeof useExpense>);

    await act(async () => {
      renderer = TestRenderer.create(<AccountsScreen />);
    });

    expect(
      findByTestId(renderer.root, `account-balance-loading-${testId(1)}`),
    ).not.toBeNull();
    expect(
      findByAccessibilityLabel(
        renderer.root,
        "Cash Wallet, Cash, balance loading",
      ),
    ).not.toBeNull();
  });

  it("shows empty state when there are no accounts", async () => {
    vi.mocked(useExpense).mockReturnValue({
      accounts: [],
      loadingAccounts: false,
      refreshAccounts,
      refreshAccountBalances,
      getAccountBalance,
      addAccount,
      updateAccount,
      deleteAccount,
      reassignAndDeleteAccount,
      fetchAccountTransactionCount,
    } as unknown as ReturnType<typeof useExpense>);

    await act(async () => {
      renderer = TestRenderer.create(<AccountsScreen />);
    });

    expect(
      renderer.root.findByProps({ title: "No accounts yet" }),
    ).toBeTruthy();
  });

  it("opens add account sheet and saves a valid account", async () => {
    await act(async () => {
      renderer = TestRenderer.create(<AccountsScreen />);
    });

    const addButton = findByTestId(renderer.root, "add-account-button");
    expect(addButton).not.toBeNull();
    await act(async () => {
      addButton?.props.onPress();
    });

    expect(findByTestId(renderer.root, "add-account-sheet")).not.toBeNull();

    const nameInput = findByAccessibilityLabel(renderer.root, "Account name");
    await act(async () => {
      nameInput?.props.onChangeText("Travel Wallet");
    });

    const saveButton = findByAccessibilityLabel(renderer.root, "Save account");
    await act(async () => {
      await saveButton?.props.onPress();
    });

    expect(addAccount).toHaveBeenCalledWith({
      name: "Travel Wallet",
      type: "cash",
      currency: "USD",
    });
  });

  it("deletes an account with no linked transactions after confirmation", async () => {
    fetchAccountTransactionCount.mockResolvedValueOnce(0);

    await act(async () => {
      renderer = TestRenderer.create(<AccountsScreen />);
    });

    const deleteButton = findByTestId(
      renderer.root,
      `delete-account-${testId(1)}`,
    );
    await act(async () => {
      await deleteButton?.props.onPress();
    });

    expect(mockConfirm).toHaveBeenCalled();
    expect(deleteAccount).toHaveBeenCalledWith(testId(1));
  });

  it("shows reassignment sheet when deleting an account with transactions", async () => {
    fetchAccountTransactionCount.mockResolvedValueOnce(2);

    await act(async () => {
      renderer = TestRenderer.create(<AccountsScreen />);
    });

    const deleteButton = findByTestId(
      renderer.root,
      `delete-account-${testId(1)}`,
    );
    await act(async () => {
      await deleteButton?.props.onPress();
    });

    expect(
      findByTestId(renderer.root, "reassign-account-sheet"),
    ).not.toBeNull();
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it("opens edit account sheet and saves changes", async () => {
    await act(async () => {
      renderer = TestRenderer.create(<AccountsScreen />);
    });

    const editButton = findByTestId(renderer.root, `edit-account-${testId(1)}`);
    await act(async () => {
      editButton?.props.onPress();
    });

    expect(findByTestId(renderer.root, "edit-account-sheet")).not.toBeNull();

    const nameInput = findByAccessibilityLabel(renderer.root, "Account name");
    await act(async () => {
      nameInput?.props.onChangeText("Updated Wallet");
    });

    const saveButton = findByAccessibilityLabel(renderer.root, "Save account");
    await act(async () => {
      await saveButton?.props.onPress();
    });

    expect(updateAccount).toHaveBeenCalledWith(testId(1), {
      name: "Updated Wallet",
      type: "cash",
      currency: "USD",
    });
  });

  it("confirms reassignment and deletes the source account", async () => {
    fetchAccountTransactionCount.mockResolvedValueOnce(2);

    await act(async () => {
      renderer = TestRenderer.create(<AccountsScreen />);
    });

    const deleteButton = findByTestId(
      renderer.root,
      `delete-account-${testId(1)}`,
    );
    await act(async () => {
      await deleteButton?.props.onPress();
    });

    const confirmReassign = findByAccessibilityLabel(
      renderer.root,
      "Confirm move transactions and delete account, destructive action",
    );
    await act(async () => {
      await confirmReassign?.props.onPress();
    });

    expect(reassignAndDeleteAccount).toHaveBeenCalledWith(testId(1), testId(2));
  });

  it("shows reassignment sheet when deleting an account with transfers only", async () => {
    fetchAccountTransactionCount.mockResolvedValueOnce(0);
    fetchAccountTransferCount.mockResolvedValueOnce(2);

    await act(async () => {
      renderer = TestRenderer.create(<AccountsScreen />);
    });

    const deleteButton = findByTestId(
      renderer.root,
      `delete-account-${testId(1)}`,
    );
    await act(async () => {
      await deleteButton?.props.onPress();
    });

    expect(
      findByTestId(renderer.root, "reassign-account-sheet"),
    ).not.toBeNull();
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it("shows an error toast when activity count lookup fails", async () => {
    fetchAccountTransactionCount.mockRejectedValueOnce(
      new Error("network error"),
    );

    await act(async () => {
      renderer = TestRenderer.create(<AccountsScreen />);
    });

    const deleteButton = findByTestId(
      renderer.root,
      `delete-account-${testId(1)}`,
    );
    await act(async () => {
      await deleteButton?.props.onPress();
    });

    expect(mockToastShow).toHaveBeenCalledWith({
      type: "error",
      message: "Could not verify linked activity",
    });
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("opens transfer sheet and excludes source from destination picker", async () => {
    await act(async () => {
      renderer = TestRenderer.create(<AccountsScreen />);
    });

    await act(async () => {
      findByTestId(renderer.root, "transfer-button")?.props.onPress();
    });

    expect(findByTestId(renderer.root, "transfer-sheet")).not.toBeNull();

    await act(async () => {
      findByAccessibilityLabel(
        renderer.root,
        "Source account, not selected",
      )?.props.onPress();
    });
    await act(async () => {
      findByAccessibilityLabel(renderer.root, "Cash Wallet")?.props.onPress();
    });

    await act(async () => {
      findByAccessibilityLabel(
        renderer.root,
        "Destination account, not selected",
      )?.props.onPress();
    });

    expect(
      findByTestId(renderer.root, "transfer-to-picker-sheet"),
    ).not.toBeNull();
    expect(findByAccessibilityLabel(renderer.root, "Main Bank")).not.toBeNull();
    expect(findByAccessibilityLabel(renderer.root, "Cash Wallet")).toBeNull();
  });

  it("submits a valid transfer", async () => {
    await act(async () => {
      renderer = TestRenderer.create(<AccountsScreen />);
    });

    await act(async () => {
      findByTestId(renderer.root, "transfer-button")?.props.onPress();
    });

    await act(async () => {
      findByAccessibilityLabel(
        renderer.root,
        "Source account, not selected",
      )?.props.onPress();
    });
    await act(async () => {
      findByAccessibilityLabel(renderer.root, "Cash Wallet")?.props.onPress();
    });
    await act(async () => {
      findByAccessibilityLabel(
        renderer.root,
        "Destination account, not selected",
      )?.props.onPress();
    });
    await act(async () => {
      findByAccessibilityLabel(renderer.root, "Main Bank")?.props.onPress();
    });

    await act(async () => {
      findByAccessibilityLabel(
        renderer.root,
        "Transfer amount",
      )?.props.onChangeText("25.00");
    });

    await act(async () => {
      await findByTestId(
        renderer.root,
        "confirm-transfer-button",
      )?.props.onPress();
    });

    expect(addTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        fromAccountId: testId(1),
        toAccountId: testId(2),
        amount: "25.00",
      }),
    );
  });
});

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";

import SettingsScreen from "@/app/settings";

const mockBack = vi.fn();
const mockSetCurrency = vi.fn().mockResolvedValue(undefined);
const mockSetFirstDayOfWeek = vi.fn().mockResolvedValue(undefined);
const mockSetThemePreference = vi.fn().mockResolvedValue(undefined);
const mockClearAllData = vi.fn().mockResolvedValue(undefined);
const mockSetAiEnabled = vi.fn().mockResolvedValue(undefined);

vi.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, push: vi.fn() }),
}));

vi.mock("@/components/screen-container", () => ({
  ScreenContainer: ({ children }: { children: React.ReactNode }) =>
    React.createElement("View", {}, children),
}));

vi.mock("@/components/ui/Sheet", () => ({
  Sheet: ({
    children,
    visible,
    testID,
  }: {
    children: React.ReactNode;
    visible: boolean;
    testID?: string;
  }) => (visible ? React.createElement("View", { testID }, children) : null),
}));

vi.mock("@expo/vector-icons", () => {
  const Ionicons = ({ name }: { name: string }) =>
    React.createElement("Ionicons", { name });
  (Ionicons as any).glyphMap = {
    "chevron-back": 1,
    "cash-outline": 1,
    "calendar-outline": 1,
    "color-palette-outline": 1,
    "download-outline": 1,
    "cloud-upload-outline": 1,
    "trash-outline": 1,
    "server-outline": 1,
    "sparkles-outline": 1,
    "information-circle-outline": 1,
    "chevron-forward": 1,
    checkmark: 1,
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
  useCurrency: () => ({
    currency: "USD",
    setCurrency: mockSetCurrency,
    isReady: true,
  }),
}));

vi.mock("@/lib/first-day-of-week-provider", () => ({
  useFirstDayOfWeek: () => ({
    firstDayOfWeek: 0,
    setFirstDayOfWeek: mockSetFirstDayOfWeek,
    isReady: true,
  }),
}));

vi.mock("@/lib/theme-provider", () => ({
  useThemeContext: () => ({
    colorScheme: "light",
    themePreference: "system",
    setThemePreference: mockSetThemePreference,
    setColorScheme: vi.fn(),
    isReady: true,
  }),
}));

vi.mock("@/lib/expense-context", () => ({
  useExpense: () => ({
    clearAllData: mockClearAllData,
  }),
}));

vi.mock("@/lib/settings-provider", () => ({
  useSettings: () => ({
    aiEnabled: false,
    setAiEnabled: mockSetAiEnabled,
    isSavingAi: false,
    isReady: true,
  }),
}));

let renderer: ReactTestRenderer | null = null;

function render(ui: React.ReactElement): ReactTestInstance {
  act(() => {
    renderer = TestRenderer.create(ui);
  });
  return renderer!.root;
}

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = null;
  mockBack.mockReset();
  mockSetCurrency.mockClear();
  mockSetFirstDayOfWeek.mockClear();
  mockSetThemePreference.mockClear();
  mockClearAllData.mockClear();
  mockSetAiEnabled.mockClear();
});

function findPressableByLabel(
  root: ReactTestInstance,
  label: string,
): ReactTestInstance {
  return root.find(
    (n) =>
      n.props?.accessibilityLabel === label &&
      typeof n.props?.onPress === "function",
  );
}

function textOf(node: ReactTestInstance | string): string {
  if (typeof node === "string") return node;
  return (node.children ?? [])
    .map((c) => (typeof c === "string" ? c : textOf(c)))
    .join("");
}

describe("SettingsScreen", () => {
  it("renders grouped section headers", () => {
    const root = render(<SettingsScreen />);
    const body = textOf(root);
    expect(body).toContain("Preferences");
    expect(body).toContain("Data Management");
    expect(body).toContain("AI");
    expect(body).toContain("About");
  });

  it("shows app name and version from expo-constants", () => {
    const root = render(<SettingsScreen />);
    const body = textOf(root);
    expect(body).toContain("Expense Tracker");
    expect(body).toContain("1.0.0");
  });

  it("renders Settings screen title as a header", () => {
    const root = render(<SettingsScreen />);
    const header = root.find(
      (n) =>
        String(n.type) === "Text" &&
        n.props.accessibilityRole === "header" &&
        textOf(n) === "Settings",
    );
    expect(header).toBeTruthy();
  });

  it("shows active currency in Preferences", () => {
    const root = render(<SettingsScreen />);
    const body = textOf(root);
    expect(body).toMatch(/CurrencyUSD/);
  });

  it("opens currency picker and persists selection", () => {
    const root = render(<SettingsScreen />);

    act(() => {
      findPressableByLabel(root, "Currency, USD").props.onPress();
    });

    const sheet = root.find((n) => n.props?.testID === "currency-picker-sheet");
    expect(sheet).toBeTruthy();

    act(() => {
      findPressableByLabel(sheet, "Euro (EUR)").props.onPress();
    });

    expect(mockSetCurrency).toHaveBeenCalledWith("EUR");
  });

  it("shows active first day of week in Preferences", () => {
    const root = render(<SettingsScreen />);
    const body = textOf(root);
    expect(body).toMatch(/First day of weekSunday/);
  });

  it("opens first day picker and persists selection", () => {
    const root = render(<SettingsScreen />);

    act(() => {
      findPressableByLabel(root, "First day of week, Sunday").props.onPress();
    });

    const sheet = root.find(
      (n) => n.props?.testID === "first-day-picker-sheet",
    );
    expect(sheet).toBeTruthy();

    act(() => {
      findPressableByLabel(sheet, "Monday").props.onPress();
    });

    expect(mockSetFirstDayOfWeek).toHaveBeenCalledWith(1);
  });

  it("does not mark first day of week as coming soon", () => {
    const root = render(<SettingsScreen />);
    expect(
      root.findAll(
        (n) => n.props?.accessibilityLabel === "First day of week, coming soon",
      ),
    ).toHaveLength(0);
  });

  it("renders theme preference control with Light, Dark, and System options", () => {
    const root = render(<SettingsScreen />);
    const body = textOf(root);
    expect(body).toContain("Theme");
    expect(body).toContain("Light");
    expect(body).toContain("Dark");
    expect(body).toContain("System");
  });

  it("does not mark theme as coming soon", () => {
    const root = render(<SettingsScreen />);
    expect(
      root.findAll((n) => n.props?.accessibilityLabel === "Theme, coming soon"),
    ).toHaveLength(0);
  });

  it("renders AI toggle off by default with explanation", () => {
    const root = render(<SettingsScreen />);
    const body = textOf(root);
    expect(body).toContain("AI features");
    expect(body).toContain(
      "Lets SmartPocket suggest categories and answer questions about your spending",
    );

    const toggle = root.find(
      (n) =>
        String(n.type) === "Switch" &&
        n.props?.accessibilityLabel === "AI features",
    );
    expect(toggle.props.value).toBe(false);
    expect(toggle.props.accessibilityState?.checked).toBe(false);
  });

  it("calls setAiEnabled when the AI switch is toggled", () => {
    const root = render(<SettingsScreen />);
    const toggle = root.find(
      (n) =>
        String(n.type) === "Switch" &&
        n.props?.accessibilityLabel === "AI features",
    );

    act(() => {
      toggle.props.onValueChange(true);
    });

    expect(mockSetAiEnabled).toHaveBeenCalledWith(true);
  });

  it("does not mark AI as coming soon", () => {
    const root = render(<SettingsScreen />);
    expect(
      root.findAll(
        (n) => n.props?.accessibilityLabel === "AI suggestions, coming soon",
      ),
    ).toHaveLength(0);
  });

  it("calls setThemePreference when Dark is selected", () => {
    const root = render(<SettingsScreen />);

    act(() => {
      findPressableByLabel(root, "Dark").props.onPress();
    });

    expect(mockSetThemePreference).toHaveBeenCalledWith("dark");
  });

  it("renders export and backup rows as coming soon", () => {
    const root = render(<SettingsScreen />);
    const body = textOf(root);
    expect(body).toContain("Export data");
    expect(body).toContain("Backup");
    expect(body.match(/Coming soon/g)?.length).toBeGreaterThanOrEqual(2);
    expect(
      findPressableByLabel(root, "Export data, coming soon").props.disabled,
    ).toBe(true);
    expect(
      findPressableByLabel(root, "Backup, coming soon").props.disabled,
    ).toBe(true);
  });

  it("does not clear data on the first tap alone", () => {
    const root = render(<SettingsScreen />);

    act(() => {
      findPressableByLabel(
        root,
        "Clear all data, destructive action",
      ).props.onPress();
    });

    expect(mockClearAllData).not.toHaveBeenCalled();
    expect(
      root.find((n) => n.props?.testID === "clear-data-confirmation-sheet"),
    ).toBeTruthy();
  });

  it("clears data only after explicit confirmation", async () => {
    const root = render(<SettingsScreen />);

    act(() => {
      findPressableByLabel(
        root,
        "Clear all data, destructive action",
      ).props.onPress();
    });

    const sheet = root.find(
      (n) => n.props?.testID === "clear-data-confirmation-sheet",
    );

    await act(async () => {
      await findPressableByLabel(
        sheet,
        "Confirm clear all data, destructive action",
      ).props.onPress();
    });

    expect(mockClearAllData).toHaveBeenCalledTimes(1);
  });

  it("does not call clearAllData when confirmation is cancelled", () => {
    const root = render(<SettingsScreen />);

    act(() => {
      findPressableByLabel(
        root,
        "Clear all data, destructive action",
      ).props.onPress();
    });

    const sheet = root.find(
      (n) => n.props?.testID === "clear-data-confirmation-sheet",
    );

    act(() => {
      findPressableByLabel(sheet, "Cancel").props.onPress();
    });

    expect(mockClearAllData).not.toHaveBeenCalled();
  });
});

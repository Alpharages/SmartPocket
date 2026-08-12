import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";

import SecurityScreen from "@/app/security";
import { ToastProvider } from "@/components/ui/ToastProvider";

// Regression coverage for round-2 review finding B4: `app/security.tsx`'s
// load effect used to depend on the whole `useToast()` context object, which
// `ToastProvider` recreated on every render — showing a toast re-ran the
// effect, which showed another toast, forever. `tests/app/security.test.tsx`
// mocks `useToast` with a stable hoisted object, so it can't see this; this
// file mounts the *real* `ToastProvider` to catch it.

const mockBack = vi.fn();

const appLock = vi.hoisted(() => ({
  isAppLockSupported: vi.fn(() => true),
  isPinSet: vi.fn(),
  setPin: vi.fn(),
  verifyPin: vi.fn(),
  clearAppLock: vi.fn(),
  getBiometricLabel: vi.fn(),
  isBiometricEnabled: vi.fn(),
  setBiometricEnabled: vi.fn(),
}));

vi.mock("@/lib/app-lock", () => appLock);

vi.mock("@/lib/trpc", () => ({
  trpc: {
    security: {
      setPin: {
        useMutation: () => ({
          mutateAsync: vi.fn().mockResolvedValue({ pinSet: true }),
        }),
      },
      clearPin: {
        useMutation: () => ({
          mutateAsync: vi.fn().mockResolvedValue({ pinSet: false }),
        }),
      },
    },
  },
}));

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
    title,
    testID,
  }: {
    children: React.ReactNode;
    visible: boolean;
    title?: string;
    testID?: string;
  }) =>
    visible
      ? React.createElement(
          "View",
          { testID },
          title ? React.createElement("Text", {}, title) : null,
          children,
        )
      : null,
}));

vi.mock("@expo/vector-icons", () => {
  const Ionicons = ({ name }: { name: string }) =>
    React.createElement("Ionicons", { name });
  (Ionicons as any).glyphMap = {
    "chevron-back": 1,
    "lock-closed-outline": 1,
    "key-outline": 1,
  };
  return { Ionicons };
});

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, right: 0, bottom: 34, left: 0 }),
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
  useThemeContext: () => ({ colorScheme: "light" }),
  useThemeTokens: () => ({ colors: mockColors }),
}));

let renderer: ReactTestRenderer | null = null;

function render(ui: React.ReactElement): ReactTestInstance {
  act(() => {
    renderer = TestRenderer.create(ui);
  });
  return renderer!.root;
}

async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  appLock.isAppLockSupported.mockReturnValue(true);
  appLock.isPinSet.mockReset();
  appLock.setPin.mockReset().mockResolvedValue(undefined);
  appLock.verifyPin.mockReset().mockResolvedValue(true);
  appLock.clearAppLock.mockReset().mockResolvedValue(undefined);
  appLock.getBiometricLabel.mockReset().mockResolvedValue(null);
  appLock.isBiometricEnabled.mockReset().mockResolvedValue(false);
  appLock.setBiometricEnabled.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = null;
  mockBack.mockReset();
});

describe("SecurityScreen under the real ToastProvider", () => {
  it("reads status once (not in a loop) when the read fails and a toast is shown", async () => {
    appLock.isPinSet.mockResolvedValue(null);

    render(
      <ToastProvider>
        <SecurityScreen />
      </ToastProvider>,
    );
    await flushMicrotasks();

    expect(appLock.isPinSet).toHaveBeenCalledTimes(1);
  });
});

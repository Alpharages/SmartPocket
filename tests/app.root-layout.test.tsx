import React from "react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import TestRenderer, { act, type ReactTestRenderer } from "react-test-renderer";
import { Platform } from "react-native";

const auth = vi.hoisted(() => ({
  getSessionToken: vi.fn(),
  setSessionToken: vi.fn(),
  // AuthGate -> useAuth reads cached user info on native (SP-006).
  getUserInfo: vi.fn().mockResolvedValue(null),
  setUserInfo: vi.fn(),
  clearUserInfo: vi.fn(),
  removeSessionToken: vi.fn(),
}));

const runtime = vi.hoisted(() => ({
}));

// AuthGate's useAuth() (real, unmocked) now pulls in hooks/use-auth.ts's
// logout()-clears-app-lock (Story 13.5), which imports lib/app-lock.ts and
// thus the real `expo-secure-store` — stub it for the same reason `auth`
// above is stubbed (see the AppLockGate comment below).
const appLock = vi.hoisted(() => ({
  clearAppLock: vi.fn(),
}));

// logout() also resets this device's sync state, which is expo-secure-store
// backed for the same reason app-lock is — stub it alongside.
vi.mock("@/lib/sync/sync-state", () => ({ resetSyncState: vi.fn() }));

// The root layout mounts SyncGate, whose real import chain reaches
// expo-secure-store (the device card key) and server/db.ts. This file is
// about the auth bootstrap; SyncGate has its own coverage in
// tests/components/sync-gate.test.tsx.
vi.mock("@/components/sync-gate", () => ({ SyncGate: () => null }));

const oauth = vi.hoisted(() => ({
  getApiBaseUrl: vi.fn(() => "http://localhost:3000"),
  SESSION_TOKEN_KEY: "app_session_token",
}));

const trpc = vi.hoisted(() => ({
  createTRPCClient: vi.fn(() => ({})),
  trpc: {
    Provider: ({ children }: { children: React.ReactNode }) =>
      React.createElement("TrpcProvider", {}, children),
  },
  Provider: ({ children }: { children: React.ReactNode }) =>
    React.createElement("TrpcProvider", {}, children),
}));

const providers = vi.hoisted(() => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement("ThemeProvider", {}, children),
  // SP-D11: the pre-shell fallback reads theme tokens to paint a themed
  // loading/error state instead of the old bare `return null`.
  useThemeTokens: () => ({
    colors: {
      background: "#fff",
      foreground: "#000",
      muted: "#888",
      primary: "#4f46e5",
      surface: "#fff",
      border: "#eee",
      error: "#e11",
      success: "#0a0",
    },
  }),
  ToastProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement("ToastProvider", {}, children),
  ConfirmProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement("ConfirmProvider", {}, children),
  CurrencyProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement("CurrencyProvider", {}, children),
  FirstDayOfWeekProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement("FirstDayOfWeekProvider", {}, children),
  SettingsProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement("SettingsProvider", {}, children),
  ExpenseProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement("ExpenseProvider", {}, children),
}));

// This suite covers dev-auth bootstrap, not app-lock behavior (see
// tests/components/app-lock-gate.test.tsx for that) — stub it as a
// pass-through so it doesn't pull in the real `expo-secure-store` module.
// Rendered as a named host node (not a Fragment) so its position relative to
// <Stack> stays assertable here — a stub a test can't see through can hide a
// placement regression the way it did for ConfirmProvider (Lore lesson
// 6dfb8e49-af88-4dd4-a90c-b78764001847).
const appLockGate = vi.hoisted(() => ({
  AppLockGate: ({ children }: { children: React.ReactNode }) =>
    React.createElement("AppLockGate", {}, children),
}));

vi.mock("@/lib/_core/auth", () => auth);
vi.mock("@/lib/app-lock", () => appLock);
vi.mock("@/constants/api", () => oauth);
vi.mock("@/lib/trpc", () => trpc);
vi.mock("@/lib/theme-provider", () => providers);
vi.mock("@/lib/currency-provider", () => providers);
vi.mock("@/lib/first-day-of-week-provider", () => providers);
vi.mock("@/lib/settings-provider", () => providers);
vi.mock("@/lib/expense-context", () => providers);
vi.mock("@/components/app-lock-gate", () => appLockGate);
vi.mock("@/components/ui/ToastProvider", () => providers);
vi.mock("@/components/ui/ConfirmProvider", () => providers);
vi.mock("expo-router", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  // AuthGate (SP-006) reads the active segment to decide whether the current
  // route is public.
  useSegments: () => ["(tabs)"],
  // SP-079: DocumentTitle derives the web document title from the pathname.
  usePathname: () => "/dashboard",
  Stack: Object.assign(
    ({ children }: { children: React.ReactNode }) =>
      React.createElement("Stack", {}, children),
    {
      Screen: ({ children }: { children?: React.ReactNode }) =>
        React.createElement("StackScreen", {}, children),
    },
  ),
}));
vi.mock("expo-notifications", () => ({
  setNotificationHandler: vi.fn(),
  addNotificationResponseReceivedListener: vi.fn(() => ({ remove: vi.fn() })),
  getLastNotificationResponseAsync: vi.fn().mockResolvedValue(null),
  getPermissionsAsync: vi.fn(),
  SchedulableTriggerInputTypes: { DATE: "date" },
  IosAuthorizationStatus: {
    AUTHORIZED: 2,
    PROVISIONAL: 3,
    EPHEMERAL: 4,
    NOT_DETERMINED: 0,
  },
}));
vi.mock("@/lib/notification-routing", () => ({
  handleLoanNotificationResponse: vi.fn(),
}));
vi.mock("react-native-gesture-handler", () => ({
  GestureHandlerRootView: ({ children }: { children: React.ReactNode }) =>
    React.createElement("GestureHandlerRootView", {}, children),
}));
vi.mock("react-native-safe-area-context", () => {
  const SafeAreaFrameContext = React.createContext(null);
  const SafeAreaInsetsContext = React.createContext(null);

  return {
    SafeAreaFrameContext,
    SafeAreaInsetsContext,
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement("SafeAreaProvider", {}, children),
    initialWindowMetrics: {
      frame: { x: 0, y: 0, width: 0, height: 0 },
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    },
  };
});
vi.mock("expo-status-bar", () => ({
  StatusBar: () => React.createElement("StatusBar"),
}));
vi.mock("react-native-reanimated", () => ({}));
vi.mock("@/lib/_core/nativewind-pressable", () => ({}));

let RootLayout: typeof import("@/app/_layout").default;

type LocalStorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function createLocalStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  } satisfies LocalStorageLike;
}

describe("RootLayout dev auth bootstrap", () => {
  let renderer: ReactTestRenderer | null = null;
  let fetchSpy: MockInstance;

  beforeAll(async () => {
    ({ default: RootLayout } = await import("@/app/_layout"));
  });

  beforeEach(() => {
    Platform.OS = "web";
    auth.getSessionToken.mockReset();
    auth.setSessionToken.mockReset();
    trpc.createTRPCClient.mockClear();

    Object.defineProperty(globalThis, "localStorage", {
      value: createLocalStorageMock(),
      configurable: true,
      writable: true,
    });

    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ token: "dev-token" }),
    } as Response);
  });

  afterEach(() => {
    act(() => {
      renderer?.unmount();
    });
    renderer = null;
    fetchSpy.mockRestore();
  });

  it("keeps the app shell hidden until cold-start dev auto-login stores a token", async () => {
    auth.getSessionToken.mockResolvedValueOnce(null);

    act(() => {
      renderer = TestRenderer.create(<RootLayout />);
    });

    expect(
      renderer!.root.findAllByType(
        "ExpenseProvider" as unknown as React.ElementType,
      ),
    ).toHaveLength(0);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(auth.setSessionToken).toHaveBeenCalledWith("dev-token");
    expect(
      renderer!.root.findByType(
        "ExpenseProvider" as unknown as React.ElementType,
      ),
    ).toBeTruthy();
  });

  it("mounts AppLockGate wrapping the Stack navigator, not as a sibling", async () => {
    (
      globalThis as typeof globalThis & {
        localStorage: LocalStorageLike;
      }
    ).localStorage.setItem(oauth.SESSION_TOKEN_KEY, "existing-token");
    auth.getSessionToken.mockResolvedValueOnce("existing-token");

    act(() => {
      renderer = TestRenderer.create(<RootLayout />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const gate = renderer!.root.findByType(
      "AppLockGate" as unknown as React.ElementType,
    );
    // AC: AppLockGate must wrap <Stack> (paint over the whole navigator),
    // unlike AuthGate, which is a null-rendering sibling — a stub that hides
    // this composition can't catch a regression that demotes it to a sibling.
    expect(
      gate.findByType("Stack" as unknown as React.ElementType),
    ).toBeTruthy();
  });

  it("renders the app shell immediately when a web session token already exists", async () => {
    (
      globalThis as typeof globalThis & {
        localStorage: LocalStorageLike;
      }
    ).localStorage.setItem(oauth.SESSION_TOKEN_KEY, "existing-token");
    auth.getSessionToken.mockResolvedValueOnce("existing-token");

    act(() => {
      renderer = TestRenderer.create(<RootLayout />);
    });

    expect(
      renderer!.root.findByType(
        "ExpenseProvider" as unknown as React.ElementType,
      ),
    ).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();

    await act(async () => {
      await Promise.resolve();
    });
  });

  // local-first-sync-plan.md phase 3: native runs entirely through the
  // in-process tRPC link (lib/trpc.native.ts) and never talks to
  // server/_core/index.ts, so it no longer needs — or waits for — a dev
  // session token. This replaces the old "keeps the native app shell hidden
  // until dev auto-login completes" behaviour.
  it("renders the native app shell immediately, without ever attempting dev auto-login", async () => {
    Platform.OS = "ios";
    auth.getSessionToken.mockResolvedValueOnce(null);

    act(() => {
      renderer = TestRenderer.create(<RootLayout />);
    });

    expect(
      renderer!.root.findByType(
        "ExpenseProvider" as unknown as React.ElementType,
      ),
    ).toBeTruthy();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(auth.setSessionToken).not.toHaveBeenCalled();
    expect(
      renderer!.root.findByType(
        "ExpenseProvider" as unknown as React.ElementType,
      ),
    ).toBeTruthy();
  });
});

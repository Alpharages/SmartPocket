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
}));

const runtime = vi.hoisted(() => ({
  initManusRuntime: vi.fn(),
  subscribeSafeAreaInsets: vi.fn(() => vi.fn()),
}));

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
  ToastProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement("ToastProvider", {}, children),
  ExpenseProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement("ExpenseProvider", {}, children),
}));

vi.mock("@/lib/_core/auth", () => auth);
vi.mock("@/lib/_core/manus-runtime", () => runtime);
vi.mock("@/constants/oauth", () => oauth);
vi.mock("@/lib/trpc", () => trpc);
vi.mock("@/lib/theme-provider", () => providers);
vi.mock("@/lib/expense-context", () => providers);
vi.mock("@/components/ui/ToastProvider", () => providers);
vi.mock("expo-router", () => ({
  Stack: Object.assign(
    ({ children }: { children: React.ReactNode }) =>
      React.createElement("Stack", {}, children),
    {
      Screen: ({ children }: { children?: React.ReactNode }) =>
        React.createElement("StackScreen", {}, children),
    },
  ),
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
    runtime.initManusRuntime.mockReset();
    runtime.subscribeSafeAreaInsets.mockClear();
    trpc.createTRPCClient.mockClear();

    Object.defineProperty(globalThis, "localStorage", {
      value: createLocalStorageMock(),
      configurable: true,
      writable: true,
    });

    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
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

    expect(renderer!.root.findAllByType("ExpenseProvider" as unknown as React.ElementType)).toHaveLength(0);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(auth.setSessionToken).toHaveBeenCalledWith("dev-token");
    expect(renderer!.root.findByType("ExpenseProvider" as unknown as React.ElementType)).toBeTruthy();
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

    expect(renderer!.root.findByType("ExpenseProvider" as unknown as React.ElementType)).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();

    await act(async () => {
      await Promise.resolve();
    });
  });

  it("renders the native app shell immediately and still fires dev auto-login", async () => {
    Platform.OS = "ios";
    auth.getSessionToken.mockResolvedValueOnce(null);

    act(() => {
      renderer = TestRenderer.create(<RootLayout />);
    });

    // Native is never gated — the shell is present from the first render even
    // before auto-login resolves.
    expect(renderer!.root.findByType("ExpenseProvider" as unknown as React.ElementType)).toBeTruthy();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // …and dev auto-login still runs on native (regression guard: the effect
    // must not be scoped to web only).
    expect(fetchSpy).toHaveBeenCalled();
    expect(auth.setSessionToken).toHaveBeenCalledWith("dev-token");
  });
});

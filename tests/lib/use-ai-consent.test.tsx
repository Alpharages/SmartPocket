import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TestRenderer, { act, type ReactTestInstance } from "react-test-renderer";
import { Platform } from "react-native";

const secureStore = vi.hoisted(() => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

vi.mock("expo-secure-store", () => secureStore);

const settingsState = vi.hoisted(() => ({
  aiEnabled: false,
  setAiEnabled: vi.fn().mockResolvedValue(undefined),
  isSavingAi: false,
}));

vi.mock("@/lib/settings-provider", () => ({
  useSettings: () => settingsState,
}));

function createLocalStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

let renderer: TestRenderer.ReactTestRenderer | null = null;

function render(ui: React.ReactElement): ReactTestInstance {
  act(() => {
    renderer = TestRenderer.create(ui);
  });
  return renderer!.root;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  Platform.OS = "ios";
  settingsState.aiEnabled = false;
  settingsState.isSavingAi = false;
  settingsState.setAiEnabled.mockClear();
  settingsState.setAiEnabled.mockResolvedValue(undefined);
  secureStore.getItemAsync.mockReset().mockResolvedValue(null);
  secureStore.setItemAsync.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = null;
});

describe("useAiConsent", () => {
  it("needs consent when AI is off and no prior dismissal", async () => {
    const { useAiConsent } = await import("@/hooks/use-ai-consent");
    let api!: ReturnType<typeof useAiConsent>;

    function Capture() {
      api = useAiConsent();
      return null;
    }
    render(React.createElement(Capture));
    await flush();

    expect(api.needsConsent).toBe(true);
    expect(api.visible).toBe(false);
  });

  it("requestConsent opens the card when AI is off", async () => {
    const { useAiConsent } = await import("@/hooks/use-ai-consent");
    let api!: ReturnType<typeof useAiConsent>;

    function Capture() {
      api = useAiConsent();
      return null;
    }
    render(React.createElement(Capture));
    await flush();

    act(() => {
      api.requestConsent();
    });

    expect(api.visible).toBe(true);
    expect(settingsState.setAiEnabled).not.toHaveBeenCalled();
  });

  it("requestConsent no-ops once AI is already on", async () => {
    settingsState.aiEnabled = true;
    const { useAiConsent } = await import("@/hooks/use-ai-consent");
    let api!: ReturnType<typeof useAiConsent>;

    function Capture() {
      api = useAiConsent();
      return null;
    }
    render(React.createElement(Capture));
    await flush();

    act(() => {
      api.requestConsent();
    });

    expect(api.visible).toBe(false);
  });

  it("enable() calls setAiEnabled(true) exactly once and closes the card", async () => {
    const { useAiConsent } = await import("@/hooks/use-ai-consent");
    let api!: ReturnType<typeof useAiConsent>;

    function Capture() {
      api = useAiConsent();
      return null;
    }
    render(React.createElement(Capture));
    await flush();

    act(() => {
      api.requestConsent();
    });
    expect(api.visible).toBe(true);

    await act(async () => {
      await api.enable();
    });

    expect(settingsState.setAiEnabled).toHaveBeenCalledTimes(1);
    expect(settingsState.setAiEnabled).toHaveBeenCalledWith(true);
    expect(api.visible).toBe(false);
  });

  it("guards against a double-tap on enable while a mutation is in flight", async () => {
    let resolveMutation!: () => void;
    settingsState.setAiEnabled.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveMutation = resolve;
        }),
    );

    const { useAiConsent } = await import("@/hooks/use-ai-consent");
    let api!: ReturnType<typeof useAiConsent>;

    function Capture() {
      api = useAiConsent();
      return null;
    }
    render(React.createElement(Capture));
    await flush();

    let firstCall!: Promise<void>;
    let secondCall!: Promise<void>;
    act(() => {
      firstCall = api.enable();
      secondCall = api.enable();
    });

    resolveMutation();
    await act(async () => {
      await Promise.all([firstCall, secondCall]);
    });

    expect(settingsState.setAiEnabled).toHaveBeenCalledTimes(1);
  });

  it("dismiss() hides the card, sets needsConsent to false, and persists the marker natively", async () => {
    const { useAiConsent } = await import("@/hooks/use-ai-consent");
    let api!: ReturnType<typeof useAiConsent>;

    function Capture() {
      api = useAiConsent();
      return null;
    }
    render(React.createElement(Capture));
    await flush();

    act(() => {
      api.requestConsent();
    });

    act(() => {
      api.dismiss();
    });
    await flush();

    expect(api.visible).toBe(false);
    expect(api.needsConsent).toBe(false);
    expect(settingsState.setAiEnabled).not.toHaveBeenCalled();
    expect(secureStore.setItemAsync).toHaveBeenCalledWith(
      "ai-consent-dismissed",
      "true",
    );
  });

  it("dismiss() persists the marker to localStorage on web", async () => {
    Platform.OS = "web";
    Object.defineProperty(globalThis, "localStorage", {
      value: createLocalStorageMock(),
      configurable: true,
      writable: true,
    });

    const { useAiConsent } = await import("@/hooks/use-ai-consent");
    let api!: ReturnType<typeof useAiConsent>;

    function Capture() {
      api = useAiConsent();
      return null;
    }
    render(React.createElement(Capture));
    await flush();

    act(() => {
      api.dismiss();
    });
    await flush();

    expect(
      (
        globalThis as typeof globalThis & {
          localStorage: { getItem(key: string): string | null };
        }
      ).localStorage.getItem("ai-consent-dismissed"),
    ).toBe("true");
    expect(secureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it("respects a previously persisted dismissal on mount", async () => {
    secureStore.getItemAsync.mockResolvedValue("true");

    const { useAiConsent } = await import("@/hooks/use-ai-consent");
    let api!: ReturnType<typeof useAiConsent>;

    function Capture() {
      api = useAiConsent();
      return null;
    }
    render(React.createElement(Capture));
    await flush();

    expect(api.needsConsent).toBe(false);
  });

  it("does not require consent once AI is already enabled", async () => {
    settingsState.aiEnabled = true;
    const { useAiConsent } = await import("@/hooks/use-ai-consent");
    let api!: ReturnType<typeof useAiConsent>;

    function Capture() {
      api = useAiConsent();
      return null;
    }
    render(React.createElement(Capture));
    await flush();

    expect(api.needsConsent).toBe(false);
  });
});

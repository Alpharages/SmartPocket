import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";
import { Text } from "react-native";
import {
  __emitAppStateChange,
  __resetAppStateMock,
} from "@/__mocks__/react-native";

import { AppLockGate } from "@/components/app-lock-gate";

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

vi.mock("@/lib/theme-provider", () => ({
  useThemeTokens: () => ({ colors: mockColors }),
}));

const appLock = vi.hoisted(() => ({
  isAppLockSupported: vi.fn(() => true),
  isPinSet: vi.fn(),
  verifyPin: vi.fn(),
}));

vi.mock("@/lib/app-lock", () => appLock);

let renderer: ReactTestRenderer | null = null;

function renderGate(): ReactTestInstance {
  act(() => {
    renderer = TestRenderer.create(
      <AppLockGate>
        <Text testID="protected-content">Balance: $1,234</Text>
      </AppLockGate>,
    );
  });
  return renderer!.root;
}

async function flush(times = 3): Promise<void> {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function overlay(root: ReactTestInstance): ReactTestInstance[] {
  return root.findAll(
    (n) => typeof n.type === "string" && n.props.testID === "app-lock-overlay",
  );
}

function content(root: ReactTestInstance): ReactTestInstance[] {
  return root.findAll(
    (n) => typeof n.type === "string" && n.props.testID === "protected-content",
  );
}

function pinKeys(root: ReactTestInstance): ReactTestInstance[] {
  return root.findAll(
    (n) => typeof n.type === "string" && n.props.accessibilityRole === "button",
  );
}

function findKey(root: ReactTestInstance, label: string): ReactTestInstance {
  const match = pinKeys(root).find((n) => n.props.accessibilityLabel === label);
  if (!match)
    throw new Error(`No key found with accessibilityLabel "${label}"`);
  return match;
}

function enterPin(root: ReactTestInstance, pin: string): void {
  for (const digit of pin) {
    act(() => {
      findKey(root, digit).props.onPress?.();
    });
  }
}

beforeEach(() => {
  __resetAppStateMock();
  appLock.isAppLockSupported.mockReturnValue(true);
  appLock.isPinSet.mockReset();
  appLock.verifyPin.mockReset();
});

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = null;
  __resetAppStateMock();
});

describe("AppLockGate", () => {
  it("covers the screen immediately on mount, before isPinSet resolves (no data flash)", () => {
    appLock.isPinSet.mockReturnValue(new Promise(() => {})); // never resolves
    const root = renderGate();

    expect(overlay(root)).toHaveLength(1);
    // Children are mounted continuously (navigation state survives) but the
    // overlay paints over them — we only assert the overlay is present here.
    expect(content(root)).toHaveLength(1);
  });

  it("renders children with no overlay when no PIN is set", async () => {
    appLock.isPinSet.mockResolvedValue(false);
    const root = renderGate();
    await flush();

    expect(overlay(root)).toHaveLength(0);
    expect(content(root)).toHaveLength(1);
  });

  it("shows a full-screen PIN entry overlay on cold start when a PIN is set", async () => {
    appLock.isPinSet.mockResolvedValue(true);
    const root = renderGate();
    await flush();

    expect(overlay(root)).toHaveLength(1);
    expect(findKey(root, "1")).toBeTruthy();
    // Content stays mounted behind the overlay, not unmounted.
    expect(content(root)).toHaveLength(1);
  });

  it("fails closed (locks) when isPinSet cannot be read", async () => {
    appLock.isPinSet.mockResolvedValue(null);
    const root = renderGate();
    await flush();

    expect(overlay(root)).toHaveLength(1);
  });

  it("does nothing at all when app lock is unsupported (web)", async () => {
    appLock.isAppLockSupported.mockReturnValue(true);
    // isAppLockSupported is read once synchronously to decide initial state;
    // simulate the web case where it returns false up front.
    appLock.isAppLockSupported.mockReturnValue(false);
    const root = renderGate();
    await flush();

    expect(overlay(root)).toHaveLength(0);
    expect(content(root)).toHaveLength(1);
    expect(appLock.isPinSet).not.toHaveBeenCalled();
  });

  it("dismisses the lock on a correct PIN without unmounting children", async () => {
    appLock.isPinSet.mockResolvedValue(true);
    appLock.verifyPin.mockResolvedValue(true);
    const root = renderGate();
    await flush();

    const contentBefore = content(root)[0];
    enterPin(root, "1234");
    await flush();

    expect(overlay(root)).toHaveLength(0);
    expect(content(root)).toHaveLength(1);
    expect(content(root)[0]).toBe(contentBefore);
  });

  it("shows an error and stays locked on an incorrect PIN", async () => {
    appLock.isPinSet.mockResolvedValue(true);
    appLock.verifyPin.mockResolvedValue(false);
    const root = renderGate();
    await flush();

    enterPin(root, "0000");
    await flush();

    expect(overlay(root)).toHaveLength(1);
    const dots = root.findAll(
      (n) => typeof n.type === "string" && n.props.testID === "pin-pad-dot",
    );
    expect(
      dots.some((d) => d.props.style?.borderColor === mockColors.error),
    ).toBe(true);
  });

  it("re-locks when the app goes to background while a PIN is set", async () => {
    appLock.isPinSet.mockResolvedValue(true);
    appLock.verifyPin.mockResolvedValue(true);
    const root = renderGate();
    await flush();

    enterPin(root, "1234");
    await flush();
    expect(overlay(root)).toHaveLength(0);

    await act(async () => {
      __emitAppStateChange("background");
      await Promise.resolve();
    });
    await flush();

    expect(overlay(root)).toHaveLength(1);
  });

  it("does not lock on background when no PIN is set (re-checks live)", async () => {
    appLock.isPinSet.mockResolvedValue(false);
    const root = renderGate();
    await flush();
    expect(overlay(root)).toHaveLength(0);

    await act(async () => {
      __emitAppStateChange("background");
      await Promise.resolve();
    });
    await flush();

    expect(overlay(root)).toHaveLength(0);
  });

  it("does not re-lock on 'inactive' (iOS share sheet / document picker)", async () => {
    appLock.isPinSet.mockResolvedValue(true);
    appLock.verifyPin.mockResolvedValue(true);
    const root = renderGate();
    await flush();
    enterPin(root, "1234");
    await flush();
    expect(overlay(root)).toHaveLength(0);

    await act(async () => {
      __emitAppStateChange("inactive");
      await Promise.resolve();
    });
    await flush();

    expect(overlay(root)).toHaveLength(0);
  });
});

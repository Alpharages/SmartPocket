import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";
import { StyleSheet, Text } from "react-native";
import {
  __emitAppStateChange,
  __emitHardwareBackPress,
  __resetAppStateMock,
  __resetBackHandlerMock,
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

const ERROR_FLASH_MS = 600;

vi.mock("@/lib/theme-provider", () => ({
  useThemeTokens: () => ({ colors: mockColors }),
}));

const appLock = vi.hoisted(() => ({
  isAppLockSupported: vi.fn(() => true),
  isPinSet: vi.fn(),
  verifyPin: vi.fn(),
}));

vi.mock("@/lib/app-lock", () => appLock);

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

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

function dots(root: ReactTestInstance): ReactTestInstance[] {
  return root.findAll(
    (n) => typeof n.type === "string" && n.props.testID === "pin-pad-dot",
  );
}

function filledDots(root: ReactTestInstance): ReactTestInstance[] {
  return dots(root).filter(
    (d) => StyleSheet.flatten(d.props.style).backgroundColor !== undefined,
  );
}

function errorDots(root: ReactTestInstance): ReactTestInstance[] {
  return dots(root).filter(
    (d) => StyleSheet.flatten(d.props.style).borderColor === mockColors.error,
  );
}

function messageText(root: ReactTestInstance, text: string): boolean {
  return (
    root.findAll((n) => typeof n.type === "string" && n.props.children === text)
      .length > 0
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  __resetAppStateMock();
  __resetBackHandlerMock();
  appLock.isAppLockSupported.mockReturnValue(true);
  appLock.isPinSet.mockReset();
  appLock.verifyPin.mockReset();
});

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = null;
  vi.clearAllTimers();
  vi.useRealTimers();
  __resetAppStateMock();
  __resetBackHandlerMock();
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

  it("overlay is opaque, full-screen, and stacked above content via zIndex — order-independent, so a JSX reorder can't leak data (P11)", async () => {
    appLock.isPinSet.mockResolvedValue(true);
    const root = renderGate();
    await flush();

    const style = StyleSheet.flatten(overlay(root)[0].props.style);
    expect(style.position).toBe("absolute");
    expect(style.top).toBe(0);
    expect(style.left).toBe(0);
    expect(style.right).toBe(0);
    expect(style.bottom).toBe(0);
    expect(style.backgroundColor).toBe(mockColors.background);
    expect(style.zIndex).toBeGreaterThanOrEqual(10000);
    expect(style.elevation).toBeGreaterThanOrEqual(10000);
  });

  it("fails closed (locks) when isPinSet cannot be read", async () => {
    appLock.isPinSet.mockResolvedValue(null);
    const root = renderGate();
    await flush();

    expect(overlay(root)).toHaveLength(1);
  });

  it("hides the covered content from screen readers while locked, restores it once unlocked (P6)", async () => {
    appLock.isPinSet.mockResolvedValue(true);
    appLock.verifyPin.mockResolvedValue(true);
    const root = renderGate();
    await flush();

    expect(overlay(root)[0].props.accessibilityViewIsModal).toBe(true);
    const coveredWrapperLocked = root.findAll(
      (n) =>
        typeof n.type === "string" &&
        n.props.importantForAccessibility !== undefined,
    )[0];
    expect(coveredWrapperLocked.props.importantForAccessibility).toBe(
      "no-hide-descendants",
    );

    enterPin(root, "1234");
    await flush();

    expect(overlay(root)).toHaveLength(0);
    const coveredWrapperUnlocked = root.findAll(
      (n) =>
        typeof n.type === "string" &&
        n.props.importantForAccessibility !== undefined,
    )[0];
    expect(coveredWrapperUnlocked.props.importantForAccessibility).toBe("auto");
  });

  it("does nothing at all when app lock is unsupported (web)", async () => {
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

  it("shows an error, clears the entry, and the flash resolves after the timeout (P12)", async () => {
    appLock.isPinSet.mockResolvedValue(true);
    appLock.verifyPin.mockResolvedValue(false);
    const root = renderGate();
    await flush();

    enterPin(root, "0000");
    await flush();

    expect(overlay(root)).toHaveLength(1);
    expect(filledDots(root)).toHaveLength(0);
    expect(errorDots(root).length).toBeGreaterThan(0);
    expect(messageText(root, "Incorrect PIN. Try again.")).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(ERROR_FLASH_MS);
    });

    expect(errorDots(root)).toHaveLength(0);
  });

  it("surfaces a distinct message when verifyPin can't determine a result, not 'Incorrect PIN' (P3)", async () => {
    appLock.isPinSet.mockResolvedValue(true);
    appLock.verifyPin.mockResolvedValue(null);
    const root = renderGate();
    await flush();

    enterPin(root, "0000");
    await flush();

    expect(overlay(root)).toHaveLength(1);
    expect(messageText(root, "Couldn't verify your PIN. Try again.")).toBe(
      true,
    );
    expect(messageText(root, "Incorrect PIN. Try again.")).toBe(false);
  });

  it("a keypress during the error flash clears the error instead of erasing the retry (P2)", async () => {
    appLock.isPinSet.mockResolvedValue(true);
    appLock.verifyPin.mockResolvedValue(false);
    const root = renderGate();
    await flush();

    enterPin(root, "0000");
    await flush();
    expect(errorDots(root).length).toBeGreaterThan(0);

    // Mid-flash (well before the 600ms auto-clear), start a new attempt.
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    act(() => {
      findKey(root, "1").props.onPress?.();
    });

    // The new digit landed (not wiped by the falling error edge) and the
    // error visuals are gone immediately, not after the remaining timeout.
    expect(filledDots(root)).toHaveLength(1);
    expect(errorDots(root)).toHaveLength(0);
  });

  it("disables PinPad while a verify is in flight (P9)", async () => {
    appLock.isPinSet.mockResolvedValue(true);
    const verify = deferred<boolean | null>();
    appLock.verifyPin.mockReturnValue(verify.promise);
    const root = renderGate();
    await flush();

    enterPin(root, "1234");
    await flush();

    expect(findKey(root, "1").props.accessibilityState.disabled).toBe(true);

    await act(async () => {
      verify.resolve(true);
      await Promise.resolve();
    });
  });

  it("re-locks synchronously when the app goes to background, before the re-check resolves (P1)", async () => {
    appLock.isPinSet.mockResolvedValueOnce(true); // mount check
    appLock.verifyPin.mockResolvedValue(true);
    const root = renderGate();
    await flush();
    enterPin(root, "1234");
    await flush();
    expect(overlay(root)).toHaveLength(0);

    appLock.isPinSet.mockReturnValueOnce(new Promise(() => {})); // background re-check, held pending
    act(() => {
      __emitAppStateChange("background");
    });

    // Locked immediately — does not wait for the SecureStore round-trip.
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

  it("stays locked when foregrounded again without the correct PIN — the 'reopened' half of AC4 (P13)", async () => {
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

    await act(async () => {
      __emitAppStateChange("active");
      await Promise.resolve();
    });
    await flush();

    // Reopening alone must not unlock — the correct PIN hasn't been entered.
    expect(overlay(root)).toHaveLength(1);
  });

  it("a stale verify that resolves true after a newer background-lock must not unlock (P4)", async () => {
    appLock.isPinSet.mockResolvedValue(true);
    const verify = deferred<boolean | null>();
    appLock.verifyPin.mockReturnValue(verify.promise);
    const root = renderGate();
    await flush();

    enterPin(root, "1234"); // verify in flight, held pending
    await flush(1);

    await act(async () => {
      __emitAppStateChange("background"); // bumps the epoch, locks again
      await Promise.resolve();
    });
    await flush();
    expect(overlay(root)).toHaveLength(1);

    await act(async () => {
      verify.resolve(true); // stale — must be ignored
      await Promise.resolve();
    });
    await flush();

    expect(overlay(root)).toHaveLength(1);
  });

  it("swallows the Android hardware back press while locked, not while unlocked (P10)", async () => {
    appLock.isPinSet.mockResolvedValue(true);
    appLock.verifyPin.mockResolvedValue(true);
    const root = renderGate();
    await flush();

    expect(__emitHardwareBackPress()).toBe(true);

    enterPin(root, "1234");
    await flush();
    expect(overlay(root)).toHaveLength(0);

    expect(__emitHardwareBackPress()).toBe(false);
  });
});

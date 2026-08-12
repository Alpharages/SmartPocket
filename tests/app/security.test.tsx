import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";

import SecurityScreen from "@/app/security";

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

const toast = vi.hoisted(() => ({ show: vi.fn() }));

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => toast,
}));

const security = vi.hoisted(() => ({
  setPinMutateAsync: vi.fn().mockResolvedValue({ pinSet: true }),
  clearPinMutateAsync: vi.fn().mockResolvedValue({ pinSet: false }),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    security: {
      setPin: {
        useMutation: () => ({ mutateAsync: security.setPinMutateAsync }),
      },
      clearPin: {
        useMutation: () => ({ mutateAsync: security.clearPinMutateAsync }),
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
    "finger-print": 1,
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

function findDigitKey(
  root: ReactTestInstance,
  label: string,
): ReactTestInstance {
  return root.find(
    (n) =>
      typeof n.type === "string" &&
      n.props?.accessibilityRole === "button" &&
      n.props?.accessibilityLabel === label,
  );
}

async function submitPin(root: ReactTestInstance, pin: string): Promise<void> {
  for (const digit of pin) {
    await act(async () => {
      findDigitKey(root, digit).props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  appLock.isAppLockSupported.mockReturnValue(true);
  appLock.isPinSet.mockReset().mockResolvedValue(false);
  appLock.setPin.mockReset().mockResolvedValue(undefined);
  appLock.verifyPin.mockReset().mockResolvedValue(true);
  appLock.clearAppLock.mockReset().mockResolvedValue(undefined);
  appLock.getBiometricLabel.mockReset().mockResolvedValue(null);
  appLock.isBiometricEnabled.mockReset().mockResolvedValue(false);
  appLock.setBiometricEnabled.mockReset().mockResolvedValue(undefined);
  toast.show.mockReset();
  security.setPinMutateAsync.mockReset().mockResolvedValue({ pinSet: true });
  security.clearPinMutateAsync.mockReset().mockResolvedValue({ pinSet: false });
});

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = null;
  vi.clearAllTimers();
  vi.useRealTimers();
  mockBack.mockReset();
});

async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("SecurityScreen", () => {
  it("shows App Lock off when no PIN is set", async () => {
    const root = render(<SecurityScreen />);
    await flushMicrotasks();

    const toggle = root.find(
      (n) =>
        String(n.type) === "Switch" &&
        n.props?.accessibilityLabel === "App Lock",
    );
    expect(toggle.props.value).toBe(false);
    expect(toggle.props.accessibilityState?.checked).toBe(false);
  });

  it("shows App Lock on and a Change PIN row when a PIN is already set", async () => {
    appLock.isPinSet.mockResolvedValue(true);
    const root = render(<SecurityScreen />);
    await flushMicrotasks();

    const toggle = root.find(
      (n) =>
        String(n.type) === "Switch" &&
        n.props?.accessibilityLabel === "App Lock",
    );
    expect(toggle.props.value).toBe(true);
    expect(findPressableByLabel(root, "Change PIN")).toBeTruthy();
  });

  it("does not render the toggle when App Lock is unsupported (web)", async () => {
    appLock.isAppLockSupported.mockReturnValue(false);
    const root = render(<SecurityScreen />);
    await flushMicrotasks();

    expect(textOf(root)).toContain(
      "App Lock is only available on iOS and Android.",
    );
    expect(
      root.findAll(
        (n) =>
          String(n.type) === "Switch" &&
          n.props?.accessibilityLabel === "App Lock",
      ),
    ).toHaveLength(0);
  });

  it("enables App Lock once the new PIN is entered and confirmed", async () => {
    const root = render(<SecurityScreen />);
    await flushMicrotasks();

    act(() => {
      root
        .find(
          (n) =>
            String(n.type) === "Switch" &&
            n.props?.accessibilityLabel === "App Lock",
        )
        .props.onValueChange(true);
    });

    expect(
      root.find((n) => n.props?.testID === "security-pin-sheet"),
    ).toBeTruthy();
    expect(textOf(root)).toContain("Enter new PIN");

    await submitPin(root, "1234");
    expect(textOf(root)).toContain("Confirm new PIN");
    expect(appLock.setPin).not.toHaveBeenCalled();

    await submitPin(root, "1234");

    expect(appLock.setPin).toHaveBeenCalledWith("1234");
    expect(
      root.findAll(
        (n) =>
          typeof n.type === "string" &&
          n.props?.testID === "security-pin-sheet",
      ),
    ).toHaveLength(0);
  });

  it("shows an error and restarts the confirm step on mismatch, without discarding the new PIN", async () => {
    const root = render(<SecurityScreen />);
    await flushMicrotasks();

    act(() => {
      root
        .find(
          (n) =>
            String(n.type) === "Switch" &&
            n.props?.accessibilityLabel === "App Lock",
        )
        .props.onValueChange(true);
    });

    await submitPin(root, "1234");
    await submitPin(root, "0000");

    expect(appLock.setPin).not.toHaveBeenCalled();
    expect(textOf(root)).toContain("PINs didn't match");
    expect(textOf(root)).toContain("Confirm new PIN");

    // The confirm step restarted (not the whole flow) — confirming with the
    // original PIN now succeeds.
    await submitPin(root, "1234");
    expect(appLock.setPin).toHaveBeenCalledWith("1234");
  });

  it("requires the current PIN before changing it", async () => {
    appLock.isPinSet.mockResolvedValue(true);
    const root = render(<SecurityScreen />);
    await flushMicrotasks();

    act(() => {
      findPressableByLabel(root, "Change PIN").props.onPress();
    });

    expect(textOf(root)).toContain("Enter current PIN");

    appLock.verifyPin.mockResolvedValue(false);
    await submitPin(root, "9999");
    expect(textOf(root)).toContain("Incorrect PIN");
    expect(appLock.setPin).not.toHaveBeenCalled();

    appLock.verifyPin.mockResolvedValue(true);
    await submitPin(root, "1111");
    expect(textOf(root)).toContain("Enter new PIN");

    await submitPin(root, "5678");
    await submitPin(root, "5678");
    expect(appLock.setPin).toHaveBeenCalledWith("5678");
  });

  it("requires the current PIN and clears the lock when App Lock is turned off", async () => {
    appLock.isPinSet.mockResolvedValue(true);
    const root = render(<SecurityScreen />);
    await flushMicrotasks();

    act(() => {
      root
        .find(
          (n) =>
            String(n.type) === "Switch" &&
            n.props?.accessibilityLabel === "App Lock",
        )
        .props.onValueChange(false);
    });

    expect(textOf(root)).toContain("Enter current PIN to turn off App Lock");

    appLock.verifyPin.mockResolvedValue(true);
    await submitPin(root, "1234");

    expect(appLock.clearAppLock).toHaveBeenCalledTimes(1);
    const toggle = root.find(
      (n) =>
        String(n.type) === "Switch" &&
        n.props?.accessibilityLabel === "App Lock",
    );
    expect(toggle.props.value).toBe(false);
  });

  it("does not clear the lock when the wrong PIN is entered to disable", async () => {
    appLock.isPinSet.mockResolvedValue(true);
    const root = render(<SecurityScreen />);
    await flushMicrotasks();

    act(() => {
      root
        .find(
          (n) =>
            String(n.type) === "Switch" &&
            n.props?.accessibilityLabel === "App Lock",
        )
        .props.onValueChange(false);
    });

    appLock.verifyPin.mockResolvedValue(false);
    await submitPin(root, "0000");

    expect(appLock.clearAppLock).not.toHaveBeenCalled();
    expect(textOf(root)).toContain("Incorrect PIN");
  });

  it("shows a recoverable error state (not an infinite spinner) when the status read fails, and recovers on retry", async () => {
    appLock.isPinSet.mockResolvedValue(null);
    const root = render(<SecurityScreen />);
    await flushMicrotasks();

    expect(textOf(root)).toContain("Couldn't read App Lock status.");
    expect(
      root.findAll(
        (n) =>
          String(n.type) === "Switch" &&
          n.props?.accessibilityLabel === "App Lock",
      ),
    ).toHaveLength(0);
    expect(toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error" }),
    );

    appLock.isPinSet.mockResolvedValue(true);
    act(() => {
      findPressableByLabel(
        root,
        "Retry loading App Lock status",
      ).props.onPress();
    });
    await flushMicrotasks();

    const toggle = root.find(
      (n) =>
        String(n.type) === "Switch" &&
        n.props?.accessibilityLabel === "App Lock",
    );
    expect(toggle.props.value).toBe(true);
  });

  it("surfaces an error toast and does not desync state when clearAppLock rejects mid-disable", async () => {
    appLock.isPinSet.mockResolvedValue(true);
    const root = render(<SecurityScreen />);
    await flushMicrotasks();

    act(() => {
      root
        .find(
          (n) =>
            String(n.type) === "Switch" &&
            n.props?.accessibilityLabel === "App Lock",
        )
        .props.onValueChange(false);
    });

    appLock.verifyPin.mockResolvedValue(true);
    appLock.clearAppLock.mockRejectedValue(new Error("keychain error"));
    // clearAppLock rejected, but the PIN key may already be gone on disk —
    // isPinSet is re-read to resync the toggle with ground truth.
    appLock.isPinSet.mockResolvedValue(false);

    await submitPin(root, "1234");
    await flushMicrotasks();

    expect(toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error" }),
    );
    const toggle = root.find(
      (n) =>
        String(n.type) === "Switch" &&
        n.props?.accessibilityLabel === "App Lock",
    );
    expect(toggle.props.value).toBe(false);
    // N7: the sheet must not strand the user on "Enter current PIN to turn
    // off App Lock" for a lock that has already been resynced to off.
    expect(
      root.findAll(
        (n) =>
          typeof n.type === "string" &&
          n.props?.testID === "security-pin-sheet",
      ),
    ).toHaveLength(0);
  });

  it("surfaces an error toast when setPin rejects instead of leaving the sheet stuck", async () => {
    const root = render(<SecurityScreen />);
    await flushMicrotasks();

    act(() => {
      root
        .find(
          (n) =>
            String(n.type) === "Switch" &&
            n.props?.accessibilityLabel === "App Lock",
        )
        .props.onValueChange(true);
    });

    await submitPin(root, "1234");
    appLock.setPin.mockRejectedValue(new Error("keychain error"));
    appLock.isPinSet.mockResolvedValue(false);
    await submitPin(root, "1234");
    await flushMicrotasks();

    expect(toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error" }),
    );
    // N7: a failed write must not leave the sheet open on a stale step.
    expect(
      root.findAll(
        (n) =>
          typeof n.type === "string" &&
          n.props?.testID === "security-pin-sheet",
      ),
    ).toHaveLength(0);
  });

  it("shows a verification error (not 'Incorrect PIN') when verifyPin cannot determine a result", async () => {
    appLock.isPinSet.mockResolvedValue(true);
    const root = render(<SecurityScreen />);
    await flushMicrotasks();

    act(() => {
      findPressableByLabel(root, "Change PIN").props.onPress();
    });

    appLock.verifyPin.mockResolvedValue(null);
    await submitPin(root, "1234");

    expect(textOf(root)).toContain("Couldn't verify your PIN");
    expect(textOf(root)).not.toContain("Incorrect PIN");
  });

  it("syncs a newly set PIN to the server after the local write succeeds", async () => {
    const root = render(<SecurityScreen />);
    await flushMicrotasks();

    act(() => {
      root
        .find(
          (n) =>
            String(n.type) === "Switch" &&
            n.props?.accessibilityLabel === "App Lock",
        )
        .props.onValueChange(true);
    });

    await submitPin(root, "1234");
    await submitPin(root, "1234");

    expect(appLock.setPin).toHaveBeenCalledWith("1234");
    expect(security.setPinMutateAsync).toHaveBeenCalledWith({ pin: "1234" });
  });

  it("does not fail the local PIN change when the server sync rejects", async () => {
    security.setPinMutateAsync.mockRejectedValue(new Error("offline"));
    const root = render(<SecurityScreen />);
    await flushMicrotasks();

    act(() => {
      root
        .find(
          (n) =>
            String(n.type) === "Switch" &&
            n.props?.accessibilityLabel === "App Lock",
        )
        .props.onValueChange(true);
    });

    await submitPin(root, "1234");
    await submitPin(root, "1234");
    await flushMicrotasks();

    // Local write still succeeded and the sheet closed — server sync failure
    // is surfaced as a toast, not a blocker (local keychain stays the fast path).
    expect(appLock.setPin).toHaveBeenCalledWith("1234");
    expect(
      root.findAll(
        (n) =>
          typeof n.type === "string" &&
          n.props?.testID === "security-pin-sheet",
      ),
    ).toHaveLength(0);
    expect(toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error" }),
    );
  });

  it("clears the server-synced PIN after disabling App Lock locally", async () => {
    appLock.isPinSet.mockResolvedValue(true);
    const root = render(<SecurityScreen />);
    await flushMicrotasks();

    act(() => {
      root
        .find(
          (n) =>
            String(n.type) === "Switch" &&
            n.props?.accessibilityLabel === "App Lock",
        )
        .props.onValueChange(false);
    });

    appLock.verifyPin.mockResolvedValue(true);
    await submitPin(root, "1234");

    expect(appLock.clearAppLock).toHaveBeenCalledTimes(1);
    expect(security.clearPinMutateAsync).toHaveBeenCalledTimes(1);
  });

  it("does not fail the local disable when the server clear-PIN sync rejects", async () => {
    appLock.isPinSet.mockResolvedValue(true);
    security.clearPinMutateAsync.mockRejectedValue(new Error("offline"));
    const root = render(<SecurityScreen />);
    await flushMicrotasks();

    act(() => {
      root
        .find(
          (n) =>
            String(n.type) === "Switch" &&
            n.props?.accessibilityLabel === "App Lock",
        )
        .props.onValueChange(false);
    });

    appLock.verifyPin.mockResolvedValue(true);
    await submitPin(root, "1234");
    await flushMicrotasks();

    const toggle = root.find(
      (n) =>
        String(n.type) === "Switch" &&
        n.props?.accessibilityLabel === "App Lock",
    );
    expect(toggle.props.value).toBe(false);
    expect(toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error" }),
    );
  });

  describe("biometric toggle", () => {
    it("is hidden when no PIN is set, even if biometrics are available", async () => {
      appLock.getBiometricLabel.mockResolvedValue("Face ID");
      const root = render(<SecurityScreen />);
      await flushMicrotasks();

      expect(
        root.findAll(
          (n) =>
            String(n.type) === "Switch" &&
            n.props?.accessibilityLabel === "Face ID",
        ),
      ).toHaveLength(0);
    });

    it("is hidden when a PIN is set but there is no biometric hardware or nothing enrolled", async () => {
      appLock.isPinSet.mockResolvedValue(true);
      appLock.getBiometricLabel.mockResolvedValue(null);
      const root = render(<SecurityScreen />);
      await flushMicrotasks();

      expect(root.findAll((n) => String(n.type) === "Switch")).toHaveLength(1); // only the App Lock switch
    });

    it("shows a toggle labelled with the real biometric method when a PIN is set and biometrics are available", async () => {
      appLock.isPinSet.mockResolvedValue(true);
      appLock.getBiometricLabel.mockResolvedValue("Face ID");
      appLock.isBiometricEnabled.mockResolvedValue(false);
      const root = render(<SecurityScreen />);
      await flushMicrotasks();

      const toggle = root.find(
        (n) =>
          String(n.type) === "Switch" &&
          n.props?.accessibilityLabel === "Face ID",
      );
      expect(toggle.props.value).toBe(false);
    });

    it("reflects the persisted biometric preference", async () => {
      appLock.isPinSet.mockResolvedValue(true);
      appLock.getBiometricLabel.mockResolvedValue("Touch ID");
      appLock.isBiometricEnabled.mockResolvedValue(true);
      const root = render(<SecurityScreen />);
      await flushMicrotasks();

      const toggle = root.find(
        (n) =>
          String(n.type) === "Switch" &&
          n.props?.accessibilityLabel === "Touch ID",
      );
      expect(toggle.props.value).toBe(true);
    });

    it("enables biometric unlock when the toggle is switched on", async () => {
      appLock.isPinSet.mockResolvedValue(true);
      appLock.getBiometricLabel.mockResolvedValue("Face unlock");
      appLock.isBiometricEnabled.mockResolvedValue(false);
      const root = render(<SecurityScreen />);
      await flushMicrotasks();

      await act(async () => {
        root
          .find(
            (n) =>
              String(n.type) === "Switch" &&
              n.props?.accessibilityLabel === "Face unlock",
          )
          .props.onValueChange(true);
        await Promise.resolve();
      });

      expect(appLock.setBiometricEnabled).toHaveBeenCalledWith(true);
      const toggle = root.find(
        (n) =>
          String(n.type) === "Switch" &&
          n.props?.accessibilityLabel === "Face unlock",
      );
      expect(toggle.props.value).toBe(true);
    });

    it("disables biometric unlock when the toggle is switched off", async () => {
      appLock.isPinSet.mockResolvedValue(true);
      appLock.getBiometricLabel.mockResolvedValue("Fingerprint");
      appLock.isBiometricEnabled.mockResolvedValue(true);
      const root = render(<SecurityScreen />);
      await flushMicrotasks();

      await act(async () => {
        root
          .find(
            (n) =>
              String(n.type) === "Switch" &&
              n.props?.accessibilityLabel === "Fingerprint",
          )
          .props.onValueChange(false);
        await Promise.resolve();
      });

      expect(appLock.setBiometricEnabled).toHaveBeenCalledWith(false);
      const toggle = root.find(
        (n) =>
          String(n.type) === "Switch" &&
          n.props?.accessibilityLabel === "Fingerprint",
      );
      expect(toggle.props.value).toBe(false);
    });

    it("surfaces an error toast and resyncs when setBiometricEnabled rejects", async () => {
      appLock.isPinSet.mockResolvedValue(true);
      appLock.getBiometricLabel.mockResolvedValue("Face ID");
      appLock.isBiometricEnabled.mockResolvedValue(false);
      const root = render(<SecurityScreen />);
      await flushMicrotasks();

      appLock.setBiometricEnabled.mockRejectedValue(
        new Error("keychain error"),
      );
      appLock.isBiometricEnabled.mockResolvedValue(false);

      await act(async () => {
        root
          .find(
            (n) =>
              String(n.type) === "Switch" &&
              n.props?.accessibilityLabel === "Face ID",
          )
          .props.onValueChange(true);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ type: "error" }),
      );
      const toggle = root.find(
        (n) =>
          String(n.type) === "Switch" &&
          n.props?.accessibilityLabel === "Face ID",
      );
      expect(toggle.props.value).toBe(false);
    });

    it("turns the biometric toggle off when App Lock (the PIN) is removed", async () => {
      appLock.isPinSet.mockResolvedValue(true);
      appLock.getBiometricLabel.mockResolvedValue("Face ID");
      appLock.isBiometricEnabled.mockResolvedValue(true);
      const root = render(<SecurityScreen />);
      await flushMicrotasks();

      act(() => {
        root
          .find(
            (n) =>
              String(n.type) === "Switch" &&
              n.props?.accessibilityLabel === "App Lock",
          )
          .props.onValueChange(false);
      });

      appLock.verifyPin.mockResolvedValue(true);
      await submitPin(root, "1234");

      expect(appLock.clearAppLock).toHaveBeenCalledTimes(1);
      // The biometric row is gone entirely because App Lock (pinSet) is off.
      expect(
        root.findAll(
          (n) =>
            String(n.type) === "Switch" &&
            n.props?.accessibilityLabel === "Face ID",
        ),
      ).toHaveLength(0);
    });
  });
});

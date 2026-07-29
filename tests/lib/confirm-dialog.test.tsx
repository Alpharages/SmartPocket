import { afterEach, describe, expect, it, vi } from "vitest";
import { Alert, Platform } from "react-native";

import { confirmDestructive } from "@/lib/confirm-dialog";
import { setConfirmHandler } from "@/components/ui/ConfirmProvider";

// ConfirmProvider renders ConfirmSheet -> Sheet, which pulls in real
// react-native-safe-area-context / @expo/vector-icons. Mock them the same
// way tests/components/ConfirmSheet.test.tsx does.
vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({
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
  }),
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

vi.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

const originalOS = Platform.OS;

afterEach(() => {
  Platform.OS = originalOS;
  setConfirmHandler(null);
  vi.restoreAllMocks();
});

describe("confirmDestructive", () => {
  it("delegates to the registered ConfirmProvider handler on web instead of globalThis.confirm", async () => {
    Platform.OS = "web";
    const handler = vi.fn().mockResolvedValue(true);
    setConfirmHandler(handler);
    const confirmSpy = vi.fn();
    vi.stubGlobal("confirm", confirmSpy);

    const result = await confirmDestructive({
      title: "Delete transaction",
      message: "This cannot be undone.",
    });

    expect(result).toBe(true);
    expect(handler).toHaveBeenCalledWith({
      title: "Delete transaction",
      message: "This cannot be undone.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      destructive: true,
    });
    expect(confirmSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("delegates to the registered ConfirmProvider handler on native instead of Alert.alert", async () => {
    Platform.OS = "ios";
    const handler = vi.fn().mockResolvedValue(false);
    setConfirmHandler(handler);
    const alertSpy = vi.spyOn(Alert, "alert");

    const result = await confirmDestructive({ title: "Sign out" });

    expect(result).toBe(false);
    expect(handler).toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("resolves false when the user cancels via the registered handler", async () => {
    Platform.OS = "web";
    setConfirmHandler(vi.fn().mockResolvedValue(false));

    const result = await confirmDestructive({ title: "Delete category" });

    expect(result).toBe(false);
  });

  it("falls back to globalThis.confirm on web when no provider handler is registered", async () => {
    Platform.OS = "web";
    setConfirmHandler(null);
    const confirmSpy = vi.fn().mockReturnValue(true);
    vi.stubGlobal("confirm", confirmSpy);

    const result = await confirmDestructive({
      title: "Delete transaction",
      message: "Gone for good.",
    });

    expect(result).toBe(true);
    expect(confirmSpy).toHaveBeenCalledWith(
      "Delete transaction\n\nGone for good.",
    );
    vi.unstubAllGlobals();
  });

  it("resolves rather than throwing or hanging when no provider is mounted and globalThis.confirm is unavailable", async () => {
    Platform.OS = "web";
    setConfirmHandler(null);
    vi.stubGlobal("confirm", undefined);

    const result = await confirmDestructive({ title: "Delete budget" });

    expect(result).toBe(false);
    vi.unstubAllGlobals();
  });

  it("falls back to Alert.alert on native when no provider handler is registered", async () => {
    Platform.OS = "ios";
    setConfirmHandler(null);
    vi.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
      buttons?.[1]?.onPress?.();
    });

    const result = await confirmDestructive({ title: "Delete loan" });

    expect(result).toBe(true);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { Alert, Platform } from "react-native";

import { confirmDestructive } from "@/lib/confirm-dialog";
import { setConfirmHandler } from "@/lib/confirm-registry";

const originalOS = Platform.OS;

afterEach(() => {
  Platform.OS = originalOS;
  setConfirmHandler(null);
  vi.restoreAllMocks();
  // restoreAllMocks() does not undo vi.stubGlobal() — without this, a test
  // that throws before reaching its own vi.unstubAllGlobals() call would
  // leak a stubbed globalThis.confirm into later tests.
  vi.unstubAllGlobals();
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
  });

  it("always uses Alert.alert on native, even when a ConfirmProvider handler is registered", async () => {
    // Alert.alert presents on the topmost view controller, so it works over
    // a route presented as transparentModal (e.g. budget-form); a provider
    // hosted at the app root cannot reliably layer a Modal over one — see
    // ConfirmProvider.tsx's doc comment. Native must never delegate.
    Platform.OS = "ios";
    const handler = vi.fn().mockResolvedValue(false);
    setConfirmHandler(handler);
    vi.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
      buttons?.[1]?.onPress?.();
    });

    const result = await confirmDestructive({ title: "Sign out" });

    expect(result).toBe(true);
    expect(handler).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalled();
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
  });

  it("resolves rather than throwing or hanging when no provider is mounted and globalThis.confirm is unavailable", async () => {
    Platform.OS = "web";
    setConfirmHandler(null);
    vi.stubGlobal("confirm", undefined);

    const result = await confirmDestructive({ title: "Delete budget" });

    expect(result).toBe(false);
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

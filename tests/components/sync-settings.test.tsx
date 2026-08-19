import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TestRenderer, { act, type ReactTestInstance } from "react-test-renderer";
import { Switch, Text } from "react-native";

import { testId } from "../helpers/ids";
import { SyncSettingsSection } from "@/components/sync-settings";

vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({
    border: "#eee",
    primary: "#4f46e5",
    surface: "#fff",
  }),
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

const toast = vi.hoisted(() => ({ show: vi.fn() }));
vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => toast,
}));

const auth = vi.hoisted(() => ({
  user: null as { id: string } | null,
  isAuthenticated: false,
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => auth,
}));

const syncState = vi.hoisted(() => ({
  isSyncEnabled: vi.fn(),
  isSyncSupported: vi.fn(() => true),
  setSyncEnabled: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/sync/sync-state", () => syncState);

const remoteClient = vi.hoisted(() => ({
  createRemoteSyncClient: vi.fn(() => ({})),
}));
vi.mock("@/lib/sync/remote-client", () => remoteClient);

const expense = vi.hoisted(() => ({
  useExpense: vi.fn(() => ({ refreshAll: vi.fn(async () => {}) })),
}));
vi.mock("@/lib/expense-context", () => expense);

const syncWorker = vi.hoisted(() => ({
  runSync: vi.fn(),
  resolveFirstSync: vi.fn(),
  resolveStaleCursor: vi.fn(),
}));
vi.mock("@/lib/sync/sync-worker", () => syncWorker);

let renderer: TestRenderer.ReactTestRenderer | null = null;

// The section refreshes the expense context after a pull.
function render(): ReactTestInstance {
  act(() => {
    renderer = TestRenderer.create(React.createElement(SyncSettingsSection));
  });
  return renderer!.root;
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = null;
  vi.clearAllMocks();
  syncState.isSyncSupported.mockReturnValue(true);
  syncState.setSyncEnabled.mockResolvedValue(undefined);
});

describe("SyncSettingsSection", () => {
  beforeEach(() => {
    auth.user = null;
    auth.isAuthenticated = false;
    syncState.isSyncEnabled.mockResolvedValue(false);
  });

  it("renders nothing on web, where sync is not supported", () => {
    syncState.isSyncSupported.mockReturnValue(false);
    const root = render();
    expect(root.findAllByType(Switch)).toHaveLength(0);
  });

  it("prompts to sign in instead of showing the toggle when signed out", async () => {
    const root = render();
    await settle();
    expect(root.findAllByType(Switch)).toHaveLength(0);
    expect(
      root
        .findAllByType(Text)
        .some((t) => /Sign in/.test(String(t.props.children))),
    ).toBe(true);
  });

  it("enabling sync runs a sync cycle for the authenticated user", async () => {
    auth.user = { id: testId(1) };
    auth.isAuthenticated = true;
    syncWorker.runSync.mockResolvedValue({
      status: "synced",
      pushed: 0,
      pulled: 0,
    });

    const root = render();
    await settle();

    const toggle = root.findByType(Switch);
    await act(async () => {
      toggle.props.onValueChange(true);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(syncState.setSyncEnabled).toHaveBeenCalledWith(true);
    expect(syncWorker.runSync).toHaveBeenCalledWith(
      expect.anything(),
      testId(1),
    );
  });

  it("shows the first-sync choice sheet when runSync reports a conflict", async () => {
    auth.user = { id: testId(1) };
    auth.isAuthenticated = true;
    syncWorker.runSync.mockResolvedValue({
      status: "needs-first-sync-choice",
      reason: "first-sync",
    });

    const root = render();
    await settle();

    const toggle = root.findByType(Switch);
    await act(async () => {
      toggle.props.onValueChange(true);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      root
        .findAllByProps({ testID: "first-sync-choice-sheet" })
        .filter((i) => (i.type as unknown) === "View"),
    ).toHaveLength(1);
    // The mocked Sheet only renders `children`, not the `title` prop, so the
    // reason-specific copy is asserted via the sheet's body text.
    expect(
      root
        .findAllByType(Text)
        .some((t) =>
          /This phone and this account both have expense data already/.test(
            String(t.props.children),
          ),
        ),
    ).toBe(true);
  });

  it("resolving the first-sync choice calls resolveFirstSync (not resolveStaleCursor) then re-runs sync", async () => {
    auth.user = { id: testId(1) };
    auth.isAuthenticated = true;
    syncWorker.runSync
      .mockResolvedValueOnce({
        status: "needs-first-sync-choice",
        reason: "first-sync",
      })
      .mockResolvedValueOnce({ status: "synced", pushed: 1, pulled: 0 });
    syncWorker.resolveFirstSync.mockResolvedValue(undefined);

    const root = render();
    await settle();
    await act(async () => {
      root.findByType(Switch).props.onValueChange(true);
      await Promise.resolve();
      await Promise.resolve();
    });

    const mergeButton = root
      .findAllByProps({
        accessibilityLabel: "Merge both — some entries may end up duplicated",
      })
      .at(0)!;
    await act(async () => {
      mergeButton.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(syncWorker.resolveFirstSync).toHaveBeenCalledWith(
      expect.anything(),
      "merge",
      testId(1),
    );
    expect(syncWorker.resolveStaleCursor).not.toHaveBeenCalled();
    expect(syncWorker.runSync).toHaveBeenCalledTimes(2);
  });

  it("shows the stale-cursor warning copy and calls resolveStaleCursor (not resolveFirstSync) when the reason is stale-cursor", async () => {
    auth.user = { id: testId(1) };
    auth.isAuthenticated = true;
    syncWorker.runSync
      .mockResolvedValueOnce({
        status: "needs-first-sync-choice",
        reason: "stale-cursor",
      })
      .mockResolvedValueOnce({ status: "synced", pushed: 0, pulled: 3 });
    syncWorker.resolveStaleCursor.mockResolvedValue(undefined);

    const root = render();
    await settle();
    await act(async () => {
      root.findByType(Switch).props.onValueChange(true);
      await Promise.resolve();
      await Promise.resolve();
    });

    // The mocked Sheet only renders `children`, not the `title` prop, so the
    // reason-specific copy is asserted via the sheet's body text.
    expect(
      root
        .findAllByType(Text)
        .some((t) =>
          /Other devices on this account may have made changes/.test(
            String(t.props.children),
          ),
        ),
    ).toBe(true);

    const keepAccountButton = root
      .findAllByProps({
        accessibilityLabel: "Keep the account's data, discarding this phone's",
      })
      .at(0)!;
    await act(async () => {
      keepAccountButton.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(syncWorker.resolveStaleCursor).toHaveBeenCalledWith(
      expect.anything(),
      "keep-account",
      testId(1),
    );
    expect(syncWorker.resolveFirstSync).not.toHaveBeenCalled();
  });

  it("shows an error toast when a sync cycle throws", async () => {
    auth.user = { id: testId(1) };
    auth.isAuthenticated = true;
    syncWorker.runSync.mockRejectedValue(new Error("network down"));

    const root = render();
    await settle();
    await act(async () => {
      root.findByType(Switch).props.onValueChange(true);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error" }),
    );
  });
});

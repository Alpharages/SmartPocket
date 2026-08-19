import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, create } from "react-test-renderer";
import {
  __emitAppStateChange,
  __resetAppStateMock,
} from "@/__mocks__/react-native";
import { testId } from "../helpers/ids";

/**
 * The trigger that was missing entirely: before this component existed,
 * `runSync` was only reachable from the Settings screen, so two devices only
 * stayed in step if the user opened Settings and tapped "Sync now" on each.
 */
const autoSync = vi.hoisted(() => ({
  runGuardedSync: vi.fn(
    async (_userId: string, _options: { minIntervalMs?: number }) => null,
  ),
}));
vi.mock("@/lib/sync/auto-sync", () => autoSync);

const auth = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock("@/hooks/use-auth", () => auth);

// SyncGate refreshes the expense context after a pull — that context, not the
// query cache, is what the screens actually render from.
const expense = vi.hoisted(() => ({
  useExpense: vi.fn(() => ({ refreshAll: vi.fn(async () => {}) })),
}));
vi.mock("@/lib/expense-context", () => expense);

import { SyncGate } from "@/components/sync-gate";

const userId = testId(1);

function renderGate() {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<SyncGate />);
  });
  return tree;
}

describe("SyncGate", () => {
  beforeEach(() => {
    autoSync.runGuardedSync.mockClear().mockResolvedValue(null);
    auth.useAuth.mockReturnValue({ user: { id: userId } });
    __resetAppStateMock();
  });

  it("syncs on launch", () => {
    renderGate();

    expect(autoSync.runGuardedSync).toHaveBeenCalledOnce();
    expect(autoSync.runGuardedSync).toHaveBeenCalledWith(userId, {
      minIntervalMs: 0,
    });
  });

  it("syncs again when the app returns to the foreground", () => {
    renderGate();
    autoSync.runGuardedSync.mockClear();

    act(() => {
      __emitAppStateChange("active");
    });

    // Throttled, unlike the launch run — flicking between apps must not mean
    // a full push/pull each time.
    expect(autoSync.runGuardedSync).toHaveBeenCalledOnce();
    expect(autoSync.runGuardedSync.mock.calls[0][1]).toEqual({
      minIntervalMs: 60_000,
    });
  });

  it("ignores a move to the background", () => {
    renderGate();
    autoSync.runGuardedSync.mockClear();

    act(() => {
      __emitAppStateChange("background");
    });

    expect(autoSync.runGuardedSync).not.toHaveBeenCalled();
  });

  it("does nothing while signed out — there is no account to sync with", () => {
    auth.useAuth.mockReturnValue({ user: null });
    renderGate();

    act(() => {
      __emitAppStateChange("active");
    });

    expect(autoSync.runGuardedSync).not.toHaveBeenCalled();
  });

  // Being offline is the normal state for a local-first app; a rejected cycle
  // must not surface as an unhandled rejection on every foreground.
  it("swallows a failed cycle", async () => {
    autoSync.runGuardedSync.mockRejectedValue(new Error("offline"));

    await act(async () => {
      create(<SyncGate />);
    });

    expect(autoSync.runGuardedSync).toHaveBeenCalled();
  });

  it("stops listening once unmounted", () => {
    const tree = renderGate();
    autoSync.runGuardedSync.mockClear();

    act(() => {
      tree.unmount();
    });
    act(() => {
      __emitAppStateChange("active");
    });

    expect(autoSync.runGuardedSync).not.toHaveBeenCalled();
  });
});

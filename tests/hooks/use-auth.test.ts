import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TestRenderer, { act, type ReactTestInstance } from "react-test-renderer";

import { useAuth } from "@/hooks/use-auth";

const api = vi.hoisted(() => ({
  logout: vi.fn().mockResolvedValue(undefined),
  getMe: vi.fn(),
}));
vi.mock("@/lib/_core/api", () => api);

const auth = vi.hoisted(() => ({
  getSessionToken: vi.fn().mockResolvedValue(null),
  removeSessionToken: vi.fn().mockResolvedValue(undefined),
  getUserInfo: vi.fn().mockResolvedValue(null),
  setUserInfo: vi.fn().mockResolvedValue(undefined),
  clearUserInfo: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/_core/auth", () => auth);

const appLock = vi.hoisted(() => ({
  clearAppLock: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/app-lock", () => appLock);

let renderer: TestRenderer.ReactTestRenderer | null = null;

function render(ui: React.ReactElement): ReactTestInstance {
  act(() => {
    renderer = TestRenderer.create(ui);
  });
  return renderer!.root;
}

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = null;
  vi.clearAllMocks();
  api.logout.mockResolvedValue(undefined);
  auth.removeSessionToken.mockResolvedValue(undefined);
  auth.clearUserInfo.mockResolvedValue(undefined);
  appLock.clearAppLock.mockResolvedValue(undefined);
});

function Capture({ sink }: { sink: (a: ReturnType<typeof useAuth>) => void }) {
  sink(useAuth({ autoFetch: false }));
  return null;
}

describe("useAuth logout", () => {
  it("clears the app lock as part of logout, so the next user of the device is not stranded behind a stale PIN", async () => {
    let hook!: ReturnType<typeof useAuth>;
    render(React.createElement(Capture, { sink: (a) => (hook = a) }));

    await act(async () => {
      await hook.logout();
    });

    expect(appLock.clearAppLock).toHaveBeenCalledTimes(1);
  });

  it("still clears the session even when clearing the app lock fails", async () => {
    appLock.clearAppLock.mockRejectedValueOnce(new Error("keystore error"));
    let hook!: ReturnType<typeof useAuth>;
    render(React.createElement(Capture, { sink: (a) => (hook = a) }));

    await act(async () => {
      await hook.logout();
    });

    expect(auth.removeSessionToken).toHaveBeenCalledTimes(1);
    expect(auth.clearUserInfo).toHaveBeenCalledTimes(1);
  });

  it("clears the app lock even when the logout API call fails", async () => {
    api.logout.mockRejectedValueOnce(new Error("network error"));
    let hook!: ReturnType<typeof useAuth>;
    render(React.createElement(Capture, { sink: (a) => (hook = a) }));

    await act(async () => {
      await hook.logout();
    });

    expect(appLock.clearAppLock).toHaveBeenCalledTimes(1);
  });

  it("does not touch tRPC or any server call — an ordinary sign-out must never clear the account-linked PIN (round-2 review R2)", async () => {
    // logout() is *every* sign-out (Settings' "Sign out" row included), not
    // just Forgot PIN. Clearing the shared account PIN here would wipe it
    // for every device on an everyday sign-out. That responsibility lives in
    // components/app-lock-gate.tsx's handleForgotPin, the one path defined
    // by the user not knowing the PIN — see tests/components/app-lock-gate.test.tsx.
    //
    // The load-bearing guard is the absence of a `vi.mock("@/lib/trpc")` in
    // this file: reintroducing a tRPC hook into logout() would run
    // useMutation outside any QueryClientProvider and blow up here. Do not
    // add that mock back — it would silently disarm this test (round-3
    // review T7).
    let hook!: ReturnType<typeof useAuth>;
    render(React.createElement(Capture, { sink: (a) => (hook = a) }));

    await act(async () => {
      await hook.logout();
    });

    expect(auth.removeSessionToken).toHaveBeenCalledTimes(1);
    expect(auth.clearUserInfo).toHaveBeenCalledTimes(1);
    expect(appLock.clearAppLock).toHaveBeenCalledTimes(1);
  });
});

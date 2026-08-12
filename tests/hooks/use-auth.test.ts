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

const security = vi.hoisted(() => ({
  clearPinMutateAsync: vi.fn().mockResolvedValue({ pinSet: false }),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    security: {
      clearPin: {
        useMutation: () => ({ mutateAsync: security.clearPinMutateAsync }),
      },
    },
  },
}));

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
  security.clearPinMutateAsync.mockReset().mockResolvedValue({ pinSet: false });
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

  it("clears the account-linked PIN on the server before dropping the session token (N1)", async () => {
    let hook!: ReturnType<typeof useAuth>;
    render(React.createElement(Capture, { sink: (a) => (hook = a) }));

    await act(async () => {
      await hook.logout();
    });

    expect(security.clearPinMutateAsync).toHaveBeenCalledTimes(1);
    const clearPinOrder =
      security.clearPinMutateAsync.mock.invocationCallOrder[0];
    const removeTokenOrder =
      auth.removeSessionToken.mock.invocationCallOrder[0];
    expect(clearPinOrder).toBeLessThan(removeTokenOrder);
  });

  it("still completes logout when the server PIN clear fails", async () => {
    security.clearPinMutateAsync.mockRejectedValueOnce(new Error("offline"));
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

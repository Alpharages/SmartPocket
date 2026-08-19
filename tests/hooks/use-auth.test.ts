import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TestRenderer, { act, type ReactTestInstance } from "react-test-renderer";
import { Platform } from "react-native";

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
});

function Capture({ sink }: { sink: (a: ReturnType<typeof useAuth>) => void }) {
  sink(useAuth({ autoFetch: false }));
  return null;
}

// Device-local sync state, cleared by logout(). Stubbed rather than left
// real so this file keeps its deliberate "no expo-secure-store" property —
// see the app-lock note below, which depends on the real module throwing.
const syncState = vi.hoisted(() => ({ resetSyncState: vi.fn() }));
vi.mock("@/lib/sync/sync-state", () => syncState);

/**
 * Installs that predate the ULID migration cached a user whose `id` was the
 * old integer autoincrement value. The native fast path returns that cached
 * identity before any network call, so nothing would ever correct it — and
 * `runSync` re-owns every local row to `user.id`, so a stale `1` re-owns the
 * whole database to an account that does not exist. Caught on a real device.
 */
describe("useAuth cached identity", () => {
  it("rejects a cached user whose id predates ULIDs, and re-fetches", async () => {
    auth.getSessionToken.mockResolvedValue("token");
    auth.getUserInfo.mockResolvedValue({ id: 1, openId: "x", name: "Old" });
    api.getMe.mockResolvedValue({
      id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
      openId: "x",
      name: "Fresh",
      email: null,
      loginMethod: "dev",
      lastSignedIn: new Date().toISOString(),
    });

    let hook!: ReturnType<typeof useAuth>;
    render(React.createElement(Capture, { sink: (a) => (hook = a) }));
    await act(async () => {
      await hook.refresh();
    });

    expect(auth.clearUserInfo).toHaveBeenCalled();
    expect(api.getMe).toHaveBeenCalled();
    expect(hook.user?.id).toBe("01ARZ3NDEKTSV4RRFFQ69G5FAV");
  });

  it("keeps a cached user whose id is a ULID, without a network call", async () => {
    auth.getSessionToken.mockResolvedValue("token");
    auth.getUserInfo.mockResolvedValue({
      id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
      openId: "x",
      name: "Cached",
    });
    api.getMe.mockClear();

    let hook!: ReturnType<typeof useAuth>;
    render(React.createElement(Capture, { sink: (a) => (hook = a) }));
    await act(async () => {
      await hook.refresh();
    });

    expect(api.getMe).not.toHaveBeenCalled();
    expect(hook.user?.name).toBe("Cached");
  });
});

describe("useAuth logout", () => {
  // Local-first-sync-plan.md: the PIN belongs to the device and its local
  // user, not to the account — there is always a local user to own it, so an
  // ordinary sign-out must leave it in place. The load-bearing guard is the
  // absence of a `vi.mock("@/lib/app-lock")` in this file: if logout() ever
  // reintroduces a clearAppLock() call, importing the real
  // `expo-secure-store`-backed module here would throw instead of silently
  // passing, per the same reasoning as the tRPC guard in the last test below.
  it("does not touch the local app lock — an ordinary sign-out must not wipe the device PIN", async () => {
    let hook!: ReturnType<typeof useAuth>;
    render(React.createElement(Capture, { sink: (a) => (hook = a) }));

    await act(async () => {
      await hook.logout();
    });

    expect(auth.removeSessionToken).toHaveBeenCalledTimes(1);
    expect(auth.clearUserInfo).toHaveBeenCalledTimes(1);
  });

  // Signing out must stop sync without deleting a single local row. Leaving
  // this device's sync state behind meant a later sign-in with a *different*
  // account skipped the first-sync prompt and kept reading under the
  // previous account's id.
  it("resets this device's sync state so the next sign-in re-runs first sync", async () => {
    syncState.resetSyncState.mockClear();
    let hook!: ReturnType<typeof useAuth>;
    render(React.createElement(Capture, { sink: (a) => (hook = a) }));

    await act(async () => {
      await hook.logout();
    });

    expect(syncState.resetSyncState).toHaveBeenCalledTimes(1);
  });

  it("still clears the session even when the logout API call fails", async () => {
    api.logout.mockRejectedValueOnce(new Error("network error"));
    let hook!: ReturnType<typeof useAuth>;
    render(React.createElement(Capture, { sink: (a) => (hook = a) }));

    await act(async () => {
      await hook.logout();
    });

    expect(auth.removeSessionToken).toHaveBeenCalledTimes(1);
    expect(auth.clearUserInfo).toHaveBeenCalledTimes(1);
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
  });
});

const sampleApiUser = {
  id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  openId: "open-1",
  name: "Alex",
  email: "alex@example.com",
  loginMethod: "manus",
  lastSignedIn: "2026-06-01T00:00:00.000Z",
};

const cachedUser = {
  id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  openId: "open-1",
  name: "Cached Alex",
  email: "alex@example.com",
  loginMethod: "manus",
  lastSignedIn: new Date("2026-05-01T00:00:00.000Z"),
};

function Autofetch({
  sink,
}: {
  sink: (a: ReturnType<typeof useAuth>) => void;
}) {
  sink(useAuth());
  return null;
}

async function renderAndSettle(): Promise<ReturnType<typeof useAuth>> {
  let hook!: ReturnType<typeof useAuth>;
  act(() => {
    renderer = TestRenderer.create(
      React.createElement(Autofetch, { sink: (a) => (hook = a) }),
    );
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  return hook;
}

describe("useAuth fetchUser — network failure vs. session rejection", () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    auth.getSessionToken.mockResolvedValue(null);
    auth.getUserInfo.mockResolvedValue(null);
  });

  afterEach(() => {
    Platform.OS = originalOS;
  });

  it("web: a thrown network error keeps the cached identity instead of signing out", async () => {
    // local-first-sync-plan.md: "a network failure is treated as a rejected
    // session" is exactly the bug this guards against — Api.getMe() rethrows
    // anything that isn't a 401/403 (SP-D07), and web has no cache
    // fast-path, so it hits this on every fetch.
    Platform.OS = "web";
    auth.getUserInfo.mockResolvedValue(cachedUser);
    api.getMe.mockRejectedValueOnce(new Error("network unreachable"));

    const hook = await renderAndSettle();

    expect(hook.user).toEqual(cachedUser);
    expect(hook.error).toBeInstanceOf(Error);
    // Not treated as a rejection — nothing here was cleared.
    expect(auth.clearUserInfo).not.toHaveBeenCalled();
  });

  it("web: an explicit 401/403 (getMe resolves null) still signs out", async () => {
    Platform.OS = "web";
    auth.getUserInfo.mockResolvedValue(cachedUser);
    api.getMe.mockResolvedValueOnce(null);

    const hook = await renderAndSettle();

    expect(hook.user).toBeNull();
    expect(auth.clearUserInfo).toHaveBeenCalledTimes(1);
  });

  it("native: a thrown network error in the token-but-no-cache window falls back to null rather than clearing the session", async () => {
    Platform.OS = "ios";
    auth.getSessionToken.mockResolvedValue("a-valid-token");
    auth.getUserInfo.mockResolvedValue(null); // narrow window: no cache yet
    api.getMe.mockRejectedValueOnce(new Error("network unreachable"));

    const hook = await renderAndSettle();

    expect(hook.user).toBeNull();
    expect(hook.error).toBeInstanceOf(Error);
    // The key assertion: a network failure must not be treated as the
    // server rejecting the token, so the token is not removed and the
    // (empty) cache is not "cleared" as if a rejection had occurred.
    expect(auth.removeSessionToken).not.toHaveBeenCalled();
    expect(auth.clearUserInfo).not.toHaveBeenCalled();
  });

  it("native: getMe resolving null (an actual 401/403) still removes the token and clears the session", async () => {
    Platform.OS = "ios";
    auth.getSessionToken.mockResolvedValue("a-stale-token");
    auth.getUserInfo.mockResolvedValue(null);
    api.getMe.mockResolvedValueOnce(null);

    const hook = await renderAndSettle();

    expect(hook.user).toBeNull();
    expect(auth.removeSessionToken).toHaveBeenCalledTimes(1);
    expect(auth.clearUserInfo).toHaveBeenCalledTimes(1);
  });

  it("native: a valid token with a successful getMe caches and sets the user, unaffected by the error-path change", async () => {
    Platform.OS = "ios";
    auth.getSessionToken.mockResolvedValue("a-valid-token");
    auth.getUserInfo.mockResolvedValue(null);
    api.getMe.mockResolvedValueOnce(sampleApiUser);

    const hook = await renderAndSettle();

    expect(hook.user).toMatchObject({ id: sampleApiUser.id, name: "Alex" });
    expect(auth.setUserInfo).toHaveBeenCalledTimes(1);
  });
});

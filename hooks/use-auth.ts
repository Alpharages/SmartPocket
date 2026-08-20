import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import { isUlid } from "@shared/ulid";

type UseAuthOptions = {
  autoFetch?: boolean;
};

/**
 * The signed-in identity, shared by every `useAuth()` caller.
 *
 * Each call used to own a private `useState`, so instances could not see each
 * other change. Signing out from Settings therefore left `AuthGate` — a
 * separate instance, mounted beside the navigator — still holding the old
 * user, and its redirect promptly bounced the freshly signed-out user off
 * /login and back onto the dashboard. The session really was gone; only the
 * gate's copy of it was stale.
 *
 * A module-level value plus a listener set is enough to fix that at the root:
 * every instance mirrors one source, so whichever one signs out, all of them
 * find out. No provider to mount and no call site to change.
 */
let sharedUser: Auth.User | null = null;
const listeners = new Set<(user: Auth.User | null) => void>();

function publishUser(user: Auth.User | null): void {
  sharedUser = user;
  for (const listener of listeners) listener(user);
}

type ApiUser = NonNullable<Awaited<ReturnType<typeof Api.getMe>>>;

const toUser = (apiUser: ApiUser): Auth.User => ({
  id: apiUser.id,
  openId: apiUser.openId,
  name: apiUser.name,
  email: apiUser.email,
  loginMethod: apiUser.loginMethod,
  lastSignedIn: new Date(apiUser.lastSignedIn),
});

export function useAuth(options?: UseAuthOptions) {
  const { autoFetch = true } = options ?? {};
  const queryClient = useQueryClient();
  const [user, setLocalUser] = useState<Auth.User | null>(sharedUser);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Every write goes through the shared value, so sibling instances update too.
  const setUser = useCallback((next: Auth.User | null) => {
    publishUser(next);
  }, []);

  useEffect(() => {
    listeners.add(setLocalUser);
    return () => {
      listeners.delete(setLocalUser);
    };
  }, []);

  const fetchUser = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Web platform: use cookie-based auth, fetch user from API
      if (Platform.OS === "web") {
        const apiUser = await Api.getMe();

        if (apiUser) {
          const userInfo = toUser(apiUser);
          setUser(userInfo);
          // Cache user info in localStorage for faster subsequent loads
          await Auth.setUserInfo(userInfo);
        } else {
          setUser(null);
          await Auth.clearUserInfo();
        }
        return;
      }

      // Native platform: use token-based auth
      const sessionToken = await Auth.getSessionToken();
      if (!sessionToken) {
        setUser(null);
        await Auth.clearUserInfo();
        return;
      }

      // SP-D07: the *token* is the session, not the local user-info cache.
      // Treating a missing cache entry as "not authenticated" stranded every
      // path that stores a token without also calling setUserInfo — dev
      // auto-login and the `sessionToken`-in-URL OAuth branch both do — on the
      // Login screen forever, with a perfectly valid session in SecureStore.
      // Ask the API who this token belongs to and cache the answer, so the fix
      // covers every token writer instead of each one remembering to cache.
      const cachedUser = await Auth.getUserInfo();
      // A cached identity is only trustworthy if its id still looks like one
      // this build issues. Installs that predate the ULID migration cached a
      // user whose `id` was the old integer autoincrement value, and this
      // fast path returns before any network call — so that stale id would be
      // trusted forever. It is not a cosmetic staleness: `runSync` re-owns
      // every local row to `user.id`, so a cached `1` silently re-owns the
      // whole database to an account that does not exist, hiding it from the
      // app and from sync. Falling through re-fetches and re-caches the real
      // one, so the install heals itself on the next launch.
      if (cachedUser && isUlid(String(cachedUser.id))) {
        setUser(cachedUser);
        return;
      }
      if (cachedUser) {
        await Auth.clearUserInfo();
      }

      const apiUser = await Api.getMe();
      if (!apiUser) {
        // Server rejected the token (getMe only returns null on 401/403).
        setUser(null);
        await Auth.removeSessionToken();
        await Auth.clearUserInfo();
        return;
      }

      const userInfo = toUser(apiUser);
      setUser(userInfo);
      await Auth.setUserInfo(userInfo);
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error("Failed to fetch user");

      setError(error);
      // A thrown error here means the *network attempt itself* failed —
      // `Api.getMe()` returns `null` only on 401/403 and rethrows everything
      // else (SP-D07) — it is not the server rejecting the session. Treating
      // it as a sign-out is exactly what local-first-sync-plan.md calls out:
      // "a network failure is treated as a rejected session." Reached on web
      // (which has no cache fast-path and hits the network on every fetch)
      // and on native in the narrow window of a stored token with nothing
      // cached yet. Keep whatever identity is already on disk instead of
      // wiping it — sync is unreachable, not the session.
      const cached = await Auth.getUserInfo();
      setUser(cached);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await Api.logout();
    } catch (err) {
      console.error("[Auth] Logout API call failed:", err);
      // Continue with logout even if API call fails
    } finally {
      await Auth.removeSessionToken();
      await Auth.clearUserInfo();
      // Local-first inversion (local-first-sync-plan.md): this used to also
      // call clearAppLock() here, on the reasoning that the app requires an
      // account and a PIN left behind after sign-out "would belong to nobody
      // after the next sign-in." That premise no longer holds — the PIN
      // belongs to the device and its local user, not to the account, and
      // there is always a local user to own it. Disconnecting an account
      // must not wipe the lock protecting data that stays on the phone, so
      // an ordinary sign-out here leaves it untouched. The Forgot-PIN flow
      // (components/app-lock-gate.tsx's handleForgotPin) clears it
      // explicitly instead, since that path — and only that path — is
      // defined by the user not knowing the PIN.
      // Drop this device's sync state too, without touching a single local
      // row. Leaving `firstSyncDone`/`lastPulledSeq` behind meant signing
      // into a *different* account skipped the first-sync prompt entirely
      // and left the device reading under the previous account's id — the
      // one case where "sign out keeps your data" quietly stopped being
      // true. Clearing it makes the next sign-in re-run the association.
      // Imported lazily: this hook is pulled in by the root layout and by
      // most screens, and a static import would drag expo-secure-store (and
      // all of expo-modules-core behind it) into every one of them — and
      // into every test that renders one.
      const { resetSyncState } = await import("@/lib/sync/sync-state");
      await resetSyncState();
      // Every cached query was fetched as the account that is now signed out.
      // Leaving them behind means the next person to sign in on this device
      // sees the previous account's transactions and balances rendered from
      // cache before their own data arrives.
      queryClient.clear();
      setUser(null);
      setError(null);
    }
  }, [queryClient]);

  const isAuthenticated = useMemo(() => Boolean(user), [user]);

  useEffect(() => {
    if (autoFetch) {
      // SP-D07: native used to short-circuit on a cached user *without*
      // checking that a session token existed, so a leftover cache entry alone
      // admitted you to the app shell while every request 401'd. `fetchUser`
      // already reads the cache for a fast native answer — it just checks the
      // token first — so both platforms can share the one path.
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [autoFetch, fetchUser]);

  return {
    user,
    loading,
    error,
    isAuthenticated,
    refresh: fetchUser,
    logout,
  };
}

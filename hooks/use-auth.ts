import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { clearAppLock } from "@/lib/app-lock";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

type UseAuthOptions = {
  autoFetch?: boolean;
};

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
  const [user, setUser] = useState<Auth.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

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
      if (cachedUser) {
        setUser(cachedUser);
        return;
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
      setUser(null);
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
      try {
        // Cleared here (not at each sign-out call site) so every path —
        // Settings, Forgot PIN, any future one — clears a device-local PIN
        // that would otherwise belong to nobody after the next sign-in.
        //
        // Deliberately local-only: this used to also clear the account-linked
        // server PIN, but logout() is *every* sign-out, not just Forgot PIN —
        // that wiped a shared account PIN on an ordinary "Sign out" tap on
        // any device (round-2 review R2). The account-linked PIN is cleared
        // by the Forgot-PIN flow specifically (components/app-lock-gate.tsx),
        // which is the one path defined by the user not knowing the PIN.
        await clearAppLock();
      } catch (err) {
        console.error("[Auth] Failed to clear app lock:", err);
      }
      setUser(null);
      setError(null);
    }
  }, []);

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

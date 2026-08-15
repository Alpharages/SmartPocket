import { useEffect } from "react";
import { useRouter, useSegments } from "expo-router";
import { Platform } from "react-native";

import { useAuth } from "@/hooks/use-auth";

/**
 * Redirects unauthenticated users to /login — web only.
 *
 * QA report SP-006: nothing in the app ever checked for a session, so a
 * release build rendered the dashboard for a signed-out user and every request
 * failed silently. Rendered as a sibling of the navigator (not a wrapper) so
 * the route tree still mounts while auth resolves — otherwise the first paint
 * would flash an empty screen on every cold start.
 *
 * local-first-sync-plan.md phase 3, "AuthGate must stop gating the app
 * shell": native runs entirely through the in-process tRPC link
 * (lib/trpc.native.ts), which resolves every call to the device's synthetic
 * local user regardless of session state — there is no "signed out" error
 * state to redirect away from. Web still goes over the wire to the real
 * server (dataApi.ts) and every procedure there is `protectedProcedure`, so
 * it keeps the redirect.
 */
const PUBLIC_SEGMENTS = new Set(["login", "oauth"]);

export function AuthGate() {
  const { isAuthenticated, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const first = segments[0];
    const onPublicRoute = first != null && PUBLIC_SEGMENTS.has(first);

    if (!isAuthenticated && !onPublicRoute && Platform.OS === "web") {
      router.replace("/login");
      return;
    }
    if (isAuthenticated && first === "login") {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, loading, segments, router]);

  return null;
}

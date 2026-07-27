import { useEffect } from "react";
import { useRouter, useSegments } from "expo-router";

import { useAuth } from "@/hooks/use-auth";

/**
 * Redirects unauthenticated users to /login.
 *
 * QA report SP-006: nothing in the app ever checked for a session, so a
 * release build rendered the dashboard for a signed-out user and every request
 * failed silently. Rendered as a sibling of the navigator (not a wrapper) so
 * the route tree still mounts while auth resolves — otherwise the first paint
 * would flash an empty screen on every cold start.
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

    if (!isAuthenticated && !onPublicRoute) {
      router.replace("/login");
      return;
    }
    if (isAuthenticated && first === "login") {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, loading, segments, router]);

  return null;
}

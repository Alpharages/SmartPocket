import Constants from "expo-constants";
import * as ReactNative from "react-native";

/**
 * Where the API lives, and where the session is kept.
 *
 * Was `constants/oauth.ts`. Everything OAuth-shaped in it belonged to the
 * Manus identity provider and went with it — the portal URL, the app id, the
 * `state` nonce helpers, and a deep-link scheme derived from the bundle id so
 * an external browser could hand the session back. Email and password sign-in
 * posts straight to the API and gets the session in the response, so none of
 * that has a counterpart to be rewritten into.
 */

const API_PORT = process.env.EXPO_PUBLIC_API_PORT ?? "3000";

const env = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "",
};

export const API_BASE_URL = env.apiBaseUrl;

/** Host Metro reports in dev — e.g. "192.168.1.5:8081" or "localhost:8081". */
export function getMetroDevHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)
      ?.debuggerHost;
  if (!hostUri) return null;
  return hostUri.split(":")[0] ?? null;
}

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "[::1]"
  );
}

/**
 * SP-D10: `10.0.2.2` is the *emulator's* alias for the host machine. On a
 * physical Android device it is an unroutable address, so rewriting a loopback
 * API URL to it left the app fetching into the void — permanently blank, with
 * no error. A USB-attached device reaches the host on plain `localhost` via
 * `adb reverse`, which is the standard dev flow (and works on emulators too),
 * so only an actual emulator should get the alias.
 *
 * Detected from `Platform.constants`, which RN already exposes on Android — no
 * extra dependency. Emulator images report a `generic`/`sdk_gphone` build.
 */
export function isAndroidEmulator(): boolean {
  const constants = ReactNative.Platform.constants as
    | { Fingerprint?: string; Model?: string; Brand?: string }
    | undefined;
  const signature = [constants?.Fingerprint, constants?.Model, constants?.Brand]
    .filter(Boolean)
    .join(" ");
  return /generic|emulator|sdk_gphone|vbox|goldfish|ranchu/i.test(signature);
}

/** Best host for the dev API server when running on a native client. */
export function resolveNativeDevApiHost(): string {
  const metroHost = getMetroDevHost();

  if (ReactNative.Platform.OS === "android") {
    if (!metroHost || isLoopbackHost(metroHost)) {
      return isAndroidEmulator() ? "10.0.2.2" : "localhost";
    }
    return metroHost;
  }

  if (metroHost && !isLoopbackHost(metroHost)) {
    return metroHost;
  }

  return "localhost";
}

/**
 * On native, `localhost` in EXPO_PUBLIC_API_BASE_URL points at the device,
 * not the dev machine. Rewrite loopback hosts to Metro's LAN host (or the
 * Android emulator's `10.0.2.2` alias).
 */
export function rewriteLoopbackApiUrlForNativeDev(url: string): string {
  try {
    const parsed = new URL(url);
    if (!isLoopbackHost(parsed.hostname)) {
      return url.replace(/\/$/, "");
    }
    parsed.hostname = resolveNativeDevApiHost();
    return parsed.origin;
  } catch {
    return url.replace(/\/$/, "");
  }
}

/**
 * Get the API base URL, deriving from current hostname if not set.
 * Metro runs on 8081, API server runs on 3000.
 * URL pattern: https://PORT-sandboxid.region.domain
 */
export function getApiBaseUrl(): string {
  if (API_BASE_URL) {
    const trimmed = API_BASE_URL.replace(/\/$/, "");
    if (__DEV__ && ReactNative.Platform.OS !== "web") {
      return rewriteLoopbackApiUrlForNativeDev(trimmed);
    }
    return trimmed;
  }

  // On web, derive from current hostname by replacing port 8081 with 3000
  if (
    ReactNative.Platform.OS === "web" &&
    typeof window !== "undefined" &&
    window.location
  ) {
    const { protocol, hostname } = window.location;
    // Pattern: 8081-sandboxid.region.domain -> 3000-sandboxid.region.domain
    const apiHostname = hostname.replace(/^8081-/, "3000-");
    if (apiHostname !== hostname) {
      return `${protocol}//${apiHostname}`;
    }
    // Plain dev host (no sandbox prefix): Metro and the API share a hostname
    // but run on different ports, so point at the API port directly. Scoped to
    // dev + loopback/LAN so production web (which must set
    // EXPO_PUBLIC_API_BASE_URL) never falls back to a wrong origin.
    if (__DEV__) {
      return `${protocol}//${hostname}:${API_PORT}`;
    }
  }

  // Native dev: relative URLs fail on React Native — point at the local API server.
  if (__DEV__ && ReactNative.Platform.OS !== "web") {
    return `http://${resolveNativeDevApiHost()}:${API_PORT}`;
  }

  // Production native builds must set EXPO_PUBLIC_API_BASE_URL explicitly.
  return "";
}

export const SESSION_TOKEN_KEY = "app_session_token";

/**
 * Renamed off the old "manus-runtime-user-info" key. This caches an identity
 * the app re-fetches from /api/auth/me anyway, so an install that still holds
 * the old key simply misses the cache once and repopulates under the new one —
 * no migration, and no user-visible effect beyond one extra request.
 */
export const USER_INFO_KEY = "app_user_info";

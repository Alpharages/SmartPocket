import Constants from "expo-constants";
import * as Linking from "expo-linking";
import * as ReactNative from "react-native";

const API_PORT = process.env.EXPO_PUBLIC_API_PORT ?? "3000";

// Extract scheme from bundle ID (last segment timestamp, prefixed with "manus")
// e.g., "space.manus.my.app.t20240115103045" -> "manus20240115103045"
const bundleId = "com.app.expensetrackerapp";
const timestamp = bundleId.split(".").pop()?.replace(/^t/, "") ?? "";
const schemeFromBundleId = `manus${timestamp}`;

const env = {
  portal: process.env.EXPO_PUBLIC_OAUTH_PORTAL_URL ?? "",
  server: process.env.EXPO_PUBLIC_OAUTH_SERVER_URL ?? "",
  appId: process.env.EXPO_PUBLIC_APP_ID ?? "",
  ownerId: process.env.EXPO_PUBLIC_OWNER_OPEN_ID ?? "",
  ownerName: process.env.EXPO_PUBLIC_OWNER_NAME ?? "",
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "",
  deepLinkScheme: schemeFromBundleId,
};

export const OAUTH_PORTAL_URL = env.portal;
export const OAUTH_SERVER_URL = env.server;
export const APP_ID = env.appId;
export const OWNER_OPEN_ID = env.ownerId;
export const OWNER_NAME = env.ownerName;
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

/** Best host for the dev API server when running on a native client. */
export function resolveNativeDevApiHost(): string {
  const metroHost = getMetroDevHost();

  if (ReactNative.Platform.OS === "android") {
    if (!metroHost || isLoopbackHost(metroHost)) {
      return "10.0.2.2";
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
export const USER_INFO_KEY = "manus-runtime-user-info";

const encodeState = (value: string) => {
  if (typeof globalThis.btoa === "function") {
    return globalThis.btoa(value);
  }
  const BufferImpl = (globalThis as Record<string, any>).Buffer;
  if (BufferImpl) {
    return BufferImpl.from(value, "utf-8").toString("base64");
  }
  return value;
};

export const OAUTH_STATE_KEY = "app_oauth_state_nonce";

/**
 * CSRF nonce for the OAuth `state` parameter.
 *
 * QA report SP-022: `state` was `base64(redirectUri)` — a deterministic,
 * guessable value that the callback never verified, so it provided no CSRF
 * protection at all. `state` is now `<nonce>.<base64 redirectUri>`; the nonce
 * is random, stored before the redirect, and must match on return.
 */
function randomNonce(): string {
  const cryptoObj = (globalThis as { crypto?: Crypto }).crypto;
  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Fallback for runtimes without WebCrypto — still unpredictable enough to
  // bind a single login attempt, and native/web both provide crypto in practice.
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
}

export function parseStateNonce(state: string): string | null {
  const separator = state.indexOf(".");
  return separator > 0 ? state.slice(0, separator) : null;
}

/**
 * Get the redirect URI for OAuth callback.
 * - Web: uses API server callback endpoint
 * - Native: uses deep link scheme
 */
export const getRedirectUri = () => {
  if (ReactNative.Platform.OS === "web") {
    return `${getApiBaseUrl()}/api/oauth/callback`;
  } else {
    return Linking.createURL("/oauth/callback", {
      scheme: env.deepLinkScheme,
    });
  }
};

export const getLoginUrl = () => {
  const redirectUri = getRedirectUri();
  const nonce = randomNonce();
  const state = `${nonce}.${encodeState(redirectUri)}`;

  const url = new URL(`${OAUTH_PORTAL_URL}/app-auth`);
  url.searchParams.set("appId", APP_ID);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};

/**
 * Start OAuth login flow.
 *
 * On native platforms (iOS/Android), open the system browser directly so
 * the OAuth callback returns via deep link to the app.
 *
 * On web, this simply redirects to the login URL.
 *
 * @returns Always null, the callback is handled via deep link.
 */
export async function startOAuthLogin(): Promise<string | null> {
  const loginUrl = getLoginUrl();

  // Persist the nonce so app/oauth/callback.tsx can verify `state` on return.
  const issuedState = new URL(loginUrl).searchParams.get("state");
  const nonce = issuedState ? parseStateNonce(issuedState) : null;
  if (nonce) {
    await storeOAuthStateNonce(nonce);
  }

  if (ReactNative.Platform.OS === "web") {
    // On web, just redirect
    if (typeof window !== "undefined") {
      window.location.href = loginUrl;
    }
    return null;
  }

  const supported = await Linking.canOpenURL(loginUrl);
  if (!supported) {
    console.warn("[OAuth] Cannot open login URL: URL scheme not supported");
    // Consider surfacing this to the caller so it can show a retry.
    return null;
  }

  try {
    await Linking.openURL(loginUrl);
  } catch (error) {
    console.error("[OAuth] Failed to open login URL:", error);
    // Consider rethrowing so the caller can show a retry.
  }

  // The OAuth callback will reopen the app via deep link.
  return null;
}


// ---------------------------------------------------------------------------
// OAuth state nonce persistence (SP-022)
// ---------------------------------------------------------------------------

type SimpleStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function webStorage(): SimpleStorage | null {
  return (
    (globalThis as typeof globalThis & { sessionStorage?: SimpleStorage })
      .sessionStorage ?? null
  );
}

export async function storeOAuthStateNonce(nonce: string): Promise<void> {
  if (ReactNative.Platform.OS === "web") {
    webStorage()?.setItem(OAUTH_STATE_KEY, nonce);
    return;
  }
  const SecureStore = await import("expo-secure-store");
  await SecureStore.setItemAsync(OAUTH_STATE_KEY, nonce);
}

export async function takeOAuthStateNonce(): Promise<string | null> {
  if (ReactNative.Platform.OS === "web") {
    const storage = webStorage();
    const value = storage?.getItem(OAUTH_STATE_KEY) ?? null;
    storage?.removeItem(OAUTH_STATE_KEY);
    return value;
  }
  const SecureStore = await import("expo-secure-store");
  const value = await SecureStore.getItemAsync(OAUTH_STATE_KEY);
  await SecureStore.deleteItemAsync(OAUTH_STATE_KEY);
  return value;
}

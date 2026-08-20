import { getApiBaseUrl } from "@/constants/api";
import * as Auth from "./auth";
import type { Id } from "@/drizzle/schema";

/**
 * Thrown for any non-2xx response, carrying the status so callers can tell
 * "the server rejected this session" (401/403) apart from "the request never
 * arrived" (network failure) — SP-D07 depended on that distinction.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  // Attach the stored session token as Bearer auth on every platform. The token
  // lives in localStorage on web and SecureStore on native, both surfaced via
  // Auth.getSessionToken(). `credentials: "include"` below still carries any
  // cookie the backend sets, so cookie- and bearer-based backends both work.
  const sessionToken = await Auth.getSessionToken();
  console.log("[API] apiCall:", {
    endpoint,
    hasToken: !!sessionToken,
    method: options.method || "GET",
  });
  if (sessionToken) {
    headers["Authorization"] = `Bearer ${sessionToken}`;
    console.log("[API] Authorization header added");
  }

  const baseUrl = getApiBaseUrl();
  // Ensure no double slashes between baseUrl and endpoint
  const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = baseUrl ? `${cleanBaseUrl}${cleanEndpoint}` : endpoint;
  console.log("[API] Full URL:", url);

  try {
    console.log("[API] Making request...");
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
    });

    console.log("[API] Response status:", response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[API] Error response:", errorText);
      let errorMessage = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorJson.message || errorText;
      } catch {
        // Not JSON, use text as is
      }
      throw new ApiError(
        errorMessage || `API call failed: ${response.statusText}`,
        response.status,
      );
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await response.json();
      console.log("[API] JSON response received");
      return data as T;
    }

    const text = await response.text();
    console.log("[API] Text response received");
    return (text ? JSON.parse(text) : {}) as T;
  } catch (error) {
    console.error("[API] Request failed:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Unknown error occurred");
  }
}

export type AuthUser = {
  id: Id;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  lastSignedIn: string;
};

type AuthResult = { token: string; user: AuthUser };

/**
 * Create an account. The server issues the session in the same response — a
 * cookie for web and the raw token for native — so a successful signup never
 * needs a second round trip to log in.
 */
export async function signup(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<AuthResult> {
  return apiCall<AuthResult>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  return apiCall<AuthResult>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// Logout
export async function logout(): Promise<void> {
  await apiCall<void>("/api/auth/logout", {
    method: "POST",
  });
}

// Get current authenticated user. `apiCall` will attach the stored token on web
// or native when one is available, so this stays transport-agnostic here.
export async function getMe(): Promise<{
  id: Id;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  lastSignedIn: string;
} | null> {
  try {
    const result = await apiCall<{ user: any }>("/api/auth/me");
    return result.user || null;
  } catch (error) {
    // `null` means "the server says this session is not valid" — the caller
    // signs the user out on it. A network failure is not that, so it rethrows
    // instead: swallowing it here used to turn an unreachable API into a
    // sign-out that also wiped the cached user (SP-D07).
    if (
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403)
    ) {
      return null;
    }
    console.error("[API] getMe failed:", error);
    throw error;
  }
}

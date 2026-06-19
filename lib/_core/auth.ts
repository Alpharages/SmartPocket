import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { SESSION_TOKEN_KEY, USER_INFO_KEY } from "@/constants/oauth";

export type User = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  lastSignedIn: Date;
};

type WebStorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

// Web stores the session token in localStorage so the dev-login flow (and any
// web OAuth flow) can send it as a Bearer token. Trade-off: localStorage is
// readable by any JS on the page, so a stored JWT is exposed to XSS — acceptable
// for the dev build, but production web should prefer an httpOnly cookie for the
// session token. Mirrors the existing getUserInfo/setUserInfo web behaviour.
function getWebStorage(): WebStorageLike | null {
  const storage = (
    globalThis as typeof globalThis & { localStorage?: WebStorageLike }
  ).localStorage;
  return storage ?? null;
}

export async function getSessionToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      const storage = getWebStorage();
      return storage?.getItem(SESSION_TOKEN_KEY) ?? null;
    }

    return await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
  } catch (error) {
    console.error("[Auth] Failed to get session token:", error);
    return null;
  }
}

export async function setSessionToken(token: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      const storage = getWebStorage();
      if (!storage) {
        console.warn(
          "[Auth] localStorage unavailable, skipping session token storage",
        );
        return;
      }

      storage.setItem(SESSION_TOKEN_KEY, token);
      return;
    }

    await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
  } catch (error) {
    console.error("[Auth] Failed to set session token:", error);
    throw error;
  }
}

export async function removeSessionToken(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      const storage = getWebStorage();
      if (!storage) {
        console.warn(
          "[Auth] localStorage unavailable, skipping session token removal",
        );
        return;
      }

      storage.removeItem(SESSION_TOKEN_KEY);
      return;
    }

    await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
  } catch (error) {
    console.error("[Auth] Failed to remove session token:", error);
  }
}

export async function getUserInfo(): Promise<User | null> {
  try {
    let info: string | null = null;
    if (Platform.OS === "web") {
      info = window.localStorage.getItem(USER_INFO_KEY);
    } else {
      info = await SecureStore.getItemAsync(USER_INFO_KEY);
    }

    if (!info) {
      return null;
    }
    return JSON.parse(info);
  } catch (error) {
    console.error("[Auth] Failed to get user info:", error);
    return null;
  }
}

export async function setUserInfo(user: User): Promise<void> {
  try {
    if (Platform.OS === "web") {
      window.localStorage.setItem(USER_INFO_KEY, JSON.stringify(user));
      return;
    }

    await SecureStore.setItemAsync(USER_INFO_KEY, JSON.stringify(user));
  } catch (error) {
    console.error("[Auth] Failed to set user info:", error);
  }
}

export async function clearUserInfo(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      window.localStorage.removeItem(USER_INFO_KEY);
      return;
    }

    await SecureStore.deleteItemAsync(USER_INFO_KEY);
  } catch (error) {
    console.error("[Auth] Failed to clear user info:", error);
  }
}

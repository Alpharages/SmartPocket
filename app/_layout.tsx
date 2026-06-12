import "@/global.css";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Platform } from "react-native";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
import { CurrencyProvider } from "@/lib/currency-provider";
import { FirstDayOfWeekProvider } from "@/lib/first-day-of-week-provider";
import { SettingsProvider } from "@/lib/settings-provider";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";

import { trpc, createTRPCClient } from "@/lib/trpc";
import {
  initManusRuntime,
  subscribeSafeAreaInsets,
} from "@/lib/_core/manus-runtime";
import { ExpenseProvider } from "@/lib/expense-context";
import { ToastProvider } from "@/components/ui/ToastProvider";
import * as Auth from "@/lib/_core/auth";
import { getApiBaseUrl, SESSION_TOKEN_KEY } from "@/constants/oauth";

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

type WebStorageLike = {
  getItem(key: string): string | null;
};

function hasWebSessionToken(): boolean {
  const storage = (
    globalThis as typeof globalThis & { localStorage?: WebStorageLike }
  ).localStorage;

  try {
    return storage?.getItem(SESSION_TOKEN_KEY) != null;
  } catch {
    return false;
  }
}

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;
  const isDevWeb = __DEV__ && Platform.OS === "web";

  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);
  // Gate the first render on dev-web cold starts only, where the tRPC client
  // would otherwise mount and fire its first authenticated batch before dev
  // auto-login stores the session token (transient 401). The synchronous
  // localStorage read is safe: this gate is dev-only (`isDevWeb` requires
  // `__DEV__`), and the web static-export path runs with `__DEV__ === false`,
  // so the gate never engages there and cannot cause a hydration mismatch.
  const [isAppShellReady, setIsAppShellReady] = useState(
    () => !isDevWeb || hasWebSessionToken(),
  );

  // Initialize Manus runtime for cookie injection from parent container
  useEffect(() => {
    initManusRuntime();
  }, []);

  // In development, automatically obtain a dev session if none exists. This
  // runs on every dev platform (native + web) — native relies on it for its
  // dev auto-login. The `isAppShellReady` gate above is what defers web's
  // first render until the token is stored; native renders immediately.
  useEffect(() => {
    if (!__DEV__) return;
    let cancelled = false;

    (async () => {
      try {
        const existing = await Auth.getSessionToken();
        if (!existing) {
          const res = await fetch(`${getApiBaseUrl()}/api/dev/login`, {
            method: "POST",
          });
          const data = await res.json();
          if (data.token) {
            await Auth.setSessionToken(data.token);
            console.log("[Dev] Auto-login successful");
          }
        }
      } catch (err) {
        console.warn("[Dev] Auto-login skipped (server not reachable):", err);
      } finally {
        if (!cancelled) {
          setIsAppShellReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSafeAreaUpdate = useCallback((metrics: Metrics) => {
    setInsets(metrics.insets);
    setFrame(metrics.frame);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const unsubscribe = subscribeSafeAreaInsets(handleSafeAreaUpdate);
    return () => unsubscribe();
  }, [handleSafeAreaUpdate]);

  // Create clients once and reuse them
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Disable automatic refetching on window focus for mobile
            refetchOnWindowFocus: false,
            // Retry failed requests once
            retry: 1,
          },
        },
      }),
  );
  const [trpcClient] = useState(() => createTRPCClient());

  // Ensure minimum 8px padding for top and bottom on mobile
  const providerInitialMetrics = useMemo(() => {
    const metrics = initialWindowMetrics ?? {
      insets: initialInsets,
      frame: initialFrame,
    };
    return {
      ...metrics,
      insets: {
        ...metrics.insets,
        top: Math.max(metrics.insets.top, 16),
        bottom: Math.max(metrics.insets.bottom, 12),
      },
    };
  }, [initialInsets, initialFrame]);

  if (!isAppShellReady) {
    return null;
  }

  const content = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          {/* Default to hiding native headers so raw route segments don't appear (e.g. "(tabs)", "products/[id]"). */}
          {/* If a screen needs the native header, explicitly enable it and set a human title via Stack.Screen options. */}
          {/* in order for ios apps tab switching to work properly, use presentation: "fullScreenModal" for login page, whenever you decide to use presentation: "modal*/}
          <ToastProvider>
            <CurrencyProvider>
              <FirstDayOfWeekProvider>
              <SettingsProvider>
              <ExpenseProvider>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen
                  name="add-transaction"
                  options={{
                    presentation: "transparentModal",
                    animation: "none",
                  }}
                />
                <Stack.Screen name="oauth/callback" />
                <Stack.Screen name="settings" />
              </Stack>
              <StatusBar style="auto" />
              </ExpenseProvider>
              </SettingsProvider>
              </FirstDayOfWeekProvider>
            </CurrencyProvider>
          </ToastProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </GestureHandlerRootView>
  );

  const shouldOverrideSafeArea = Platform.OS === "web";

  if (shouldOverrideSafeArea) {
    return (
      <ThemeProvider>
        <SafeAreaProvider initialMetrics={providerInitialMetrics}>
          <SafeAreaFrameContext.Provider value={frame}>
            <SafeAreaInsetsContext.Provider value={insets}>
              {content}
            </SafeAreaInsetsContext.Provider>
          </SafeAreaFrameContext.Provider>
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider initialMetrics={providerInitialMetrics}>
        {content}
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

import "@/global.css";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { handleLoanNotificationResponse } from "@/lib/notification-routing";
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
import { AuthGate } from "@/components/auth-gate";
import { AppLockGate } from "@/components/app-lock-gate";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { ConfirmProvider } from "@/components/ui/ConfirmProvider";
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
  const router = useRouter();
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;

  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);
  // Gate the first render on dev cold starts so the tRPC client does not fire
  // authenticated requests before dev auto-login stores the session token.
  const [isAppShellReady, setIsAppShellReady] = useState(() => {
    if (!__DEV__) return true;
    if (Platform.OS === "web") return hasWebSessionToken();
    return false;
  });

  // Initialize Manus runtime for cookie injection from parent container
  useEffect(() => {
    initManusRuntime();
  }, []);

  useEffect(() => {
    if (Platform.OS !== "ios" && Platform.OS !== "android") {
      return;
    }

    const navigateFromNotification = (
      response: Notifications.NotificationResponse,
    ) => {
      handleLoanNotificationResponse(response, (path) =>
        router.push(path as Href),
      );
    };

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        navigateFromNotification(response);
      }
    });

    const subscription = Notifications.addNotificationResponseReceivedListener(
      navigateFromNotification,
    );

    return () => subscription.remove();
  }, [router]);

  // In development, automatically obtain a dev session if none exists.
  useEffect(() => {
    if (!__DEV__) return;
    let cancelled = false;

    (async () => {
      const apiUrl = getApiBaseUrl();
      const loginUrl = `${apiUrl}/api/dev/login`;

      try {
        const existing = await Auth.getSessionToken();
        if (existing) {
          return;
        }

        const maxAttempts = 3;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          if (cancelled) return;
          try {
            const res = await fetch(loginUrl, { method: "POST" });
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}`);
            }
            const data = await res.json();
            if (data.token) {
              await Auth.setSessionToken(data.token);
              if (__DEV__) {
                console.log("[Dev] Auto-login successful");
              }
              return;
            }
            throw new Error("No token in response");
          } catch (err) {
            if (attempt < maxAttempts) {
              await new Promise((r) => setTimeout(r, 1000 * attempt));
              continue;
            }
            console.warn(
              `[Dev] Auto-login failed after ${maxAttempts} attempts.\n` +
                `  API: ${loginUrl}\n` +
                `  Start the backend with: pnpm dev (or pnpm dev:server)\n` +
                `  On a physical device, set EXPO_PUBLIC_API_BASE_URL to your machine's LAN IP.`,
              err,
            );
          }
        }
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
            <ConfirmProvider>
              <CurrencyProvider>
                <FirstDayOfWeekProvider>
                  <SettingsProvider>
                    <ExpenseProvider>
                      <AuthGate />
                      <AppLockGate>
                        <Stack screenOptions={{ headerShown: false }}>
                          <Stack.Screen name="(tabs)" />
                          <Stack.Screen
                            name="add-transaction"
                            options={{
                              presentation: "transparentModal",
                              animation: "none",
                            }}
                          />
                          <Stack.Screen name="budgets" />
                          <Stack.Screen name="accounts" />
                          <Stack.Screen
                            name="budget-form"
                            options={{
                              presentation: "transparentModal",
                              animation: "none",
                            }}
                          />
                          <Stack.Screen name="recurring" />
                          <Stack.Screen name="oauth/callback" />
                          <Stack.Screen name="card/[id]" />
                          <Stack.Screen name="loan/[id]" />
                          <Stack.Screen name="import-csv" />
                          <Stack.Screen
                            name="loan/record-repayment"
                            options={{
                              presentation: "transparentModal",
                              animation: "none",
                            }}
                          />
                          <Stack.Screen name="settings" />
                          <Stack.Screen name="security" />
                          <Stack.Screen
                            name="login"
                            options={{ presentation: "fullScreenModal" }}
                          />
                        </Stack>
                      </AppLockGate>
                      <StatusBar style="auto" />
                    </ExpenseProvider>
                  </SettingsProvider>
                </FirstDayOfWeekProvider>
              </CurrencyProvider>
            </ConfirmProvider>
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

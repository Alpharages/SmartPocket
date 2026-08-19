import "@/global.css";
// Before anything that could reach for randomness: Hermes has no Web Crypto,
// and @noble needs `crypto.getRandomValues` for card IVs, the device card key
// and the App Lock PIN salt. See lib/_core/crypto-polyfill.ts.
import "@/lib/_core/crypto-polyfill";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, usePathname, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import * as Notifications from "expo-notifications";
import { handleLoanNotificationResponse } from "@/lib/notification-routing";
import { getPageTitle } from "@/lib/_core/page-title";
import { getAppMetadata } from "@/lib/app-metadata";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider, useThemeTokens } from "@/lib/theme-provider";
import { Button } from "@/components/ui/Button";
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
import { SyncGate } from "@/components/sync-gate";
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

/**
 * What the app shows while the shell is still gated, and when gating failed.
 * Split out so it can read theme tokens — it renders inside ThemeProvider,
 * above the rest of the provider stack.
 */
function ShellFallback({
  error,
  onRetry,
  onDismiss,
}: {
  error: string | null;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  const { colors } = useThemeTokens();

  return (
    <View
      testID="app-shell-fallback"
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        gap: 16,
        backgroundColor: colors.background,
      }}
    >
      {error ? (
        <>
          <Text
            style={{
              fontSize: 17,
              fontWeight: "600",
              color: colors.foreground,
            }}
          >
            Can&apos;t reach the server
          </Text>
          <Text
            style={{ fontSize: 13, color: colors.muted, textAlign: "center" }}
          >
            {error}
          </Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Button label="Retry" onPress={onRetry} />
            <Button
              variant="secondary"
              label="Continue offline"
              onPress={onDismiss}
            />
          </View>
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ fontSize: 13, color: colors.muted }}>Connecting…</Text>
        </>
      )}
    </View>
  );
}

/**
 * SP-079: every route rendered an empty `<title>`. Expo Router's per-screen
 * `title` options never reached `document.title` here, so set it explicitly
 * from the pathname. Renders nothing; web-only.
 */
function DocumentTitle() {
  const pathname = usePathname();

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    document.title = getPageTitle(pathname, getAppMetadata().name);
  }, [pathname]);

  return null;
}

export default function RootLayout() {
  const router = useRouter();
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;

  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);
  // Gate the first render on dev cold starts so the tRPC client does not fire
  // authenticated requests before dev auto-login stores the session token.
  //
  // local-first-sync-plan.md phase 3: native no longer needs a session token
  // at all — the in-process tRPC link (lib/trpc.native.ts) always resolves to
  // the device's local user, with no server to log into. Only web (still
  // server-backed over dataApi.ts) waits here.
  const [isAppShellReady, setIsAppShellReady] = useState(() => {
    if (!__DEV__) return true;
    if (Platform.OS === "web") return hasWebSessionToken();
    return true;
  });
  // SP-D10/SP-D11: when dev auto-login can't reach the API the shell used to
  // stay blank with nothing to read. Keep the reason so the gate can show it.
  const [shellError, setShellError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

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
  //
  // local-first-sync-plan.md phase 3: native is fully offline through the
  // in-process tRPC link and never talks to server/_core/index.ts, so there
  // is no dev-login endpoint to reach and no session token to store — running
  // this on a real device would just fail every attempt and surface a
  // permanent "could not reach the API" error for a state that isn't one.
  useEffect(() => {
    if (!__DEV__) return;
    if (Platform.OS !== "web") return;
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
            // SP-D10: an unreachable host makes `fetch` hang for a minute or
            // more, so without a deadline the shell sits blank long enough to
            // read as a freeze. Fail fast and let the error state explain.
            //
            // Hand-rolled rather than `AbortSignal.timeout()` — Hermes does not
            // implement it, and calling it threw before `fetch` ever ran, which
            // broke dev auto-login outright.
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            let res: Response;
            try {
              res = await fetch(loginUrl, {
                method: "POST",
                signal: controller.signal,
              });
            } finally {
              clearTimeout(timeout);
            }
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}`);
            }
            const data = await res.json();
            if (data.token) {
              await Auth.setSessionToken(data.token);
              if (__DEV__) {
                console.log("[Dev] Auto-login successful");
              }
              if (!cancelled) setShellError(null);
              return;
            }
            throw new Error("No token in response");
          } catch (err) {
            if (attempt < maxAttempts) {
              await new Promise((r) => setTimeout(r, 1000 * attempt));
              continue;
            }
            const detail = err instanceof Error ? err.message : String(err);
            console.warn(
              `[Dev] Auto-login failed after ${maxAttempts} attempts.\n` +
                `  API: ${loginUrl}\n` +
                `  Start the backend with: pnpm dev (or pnpm dev:server)\n` +
                `  On a physical device, run \`adb reverse tcp:${process.env.EXPO_PUBLIC_API_PORT ?? "3000"} tcp:${process.env.EXPO_PUBLIC_API_PORT ?? "3000"}\`\n` +
                `  or set EXPO_PUBLIC_API_BASE_URL to your machine's LAN IP.`,
              err,
            );
            if (!cancelled) {
              setShellError(`Could not reach the API at ${apiUrl} (${detail})`);
            }
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
  }, [retryToken]);

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

  // SP-D11: this gate used to `return null`, so any failure to reach the API
  // during dev auto-login painted an indefinitely blank white screen with no
  // spinner, message or way out. Always render *something* explaining the wait,
  // and offer a retry when the reason is known.
  if (!isAppShellReady || shellError) {
    return (
      <ThemeProvider>
        <SafeAreaProvider initialMetrics={providerInitialMetrics}>
          <ShellFallback
            error={shellError}
            onRetry={() => {
              setShellError(null);
              setIsAppShellReady(false);
              setRetryToken((n) => n + 1);
            }}
            onDismiss={() => setShellError(null)}
          />
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  const content = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          {/* Default to hiding native headers so raw route segments don't appear (e.g. "(tabs)", "products/[id]"). */}
          {/* If a screen needs the native header, explicitly enable it and set a human title via Stack.Screen options. */}
          {/* in order for ios apps tab switching to work properly, use presentation: "fullScreenModal" for login page, whenever you decide to use presentation: "modal*/}
          <DocumentTitle />
          <ToastProvider>
            <ConfirmProvider>
              <CurrencyProvider>
                <FirstDayOfWeekProvider>
                  <SettingsProvider>
                    <ExpenseProvider>
                      <AuthGate />
                      <SyncGate />
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

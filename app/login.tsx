import React, { useCallback, useState } from "react";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Redirect } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { useAuth } from "@/hooks/use-auth";
import { useThemeTokens } from "@/lib/theme-provider";
import { getAppMetadata } from "@/lib/app-metadata";
import { OAUTH_PORTAL_URL, startOAuthLogin } from "@/constants/oauth";
import { Spacing } from "@/lib/_core/theme";

/**
 * Sign-in screen.
 *
 * QA report SP-006: the app had no login UI at all. `startOAuthLogin()` and
 * `getLoginUrl()` existed but had zero call sites, and `useAuth()` was imported
 * by no screen — so outside `__DEV__` (where an auto-login effect runs) a
 * release build booted straight to an authenticated screen whose every request
 * 401'd, with no way to sign in and no way to recover.
 */
export default function LoginScreen() {
  const { colors } = useThemeTokens();
  const { isAuthenticated, loading } = useAuth();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const { name: appName } = getAppMetadata();

  const handleSignIn = useCallback(async () => {
    if (submitting) return;
    if (!OAUTH_PORTAL_URL) {
      toast.show({
        type: "error",
        message: "Sign-in is not configured. Set EXPO_PUBLIC_OAUTH_PORTAL_URL.",
      });
      return;
    }
    setSubmitting(true);
    try {
      await startOAuthLogin();
    } catch {
      toast.show({ type: "error", message: "Could not start sign-in" });
    } finally {
      // On web this navigates away; on native the browser opens and the app
      // resumes via deep link, so always release the guard.
      setSubmitting(false);
    }
  }, [submitting, toast]);

  if (loading) {
    return (
      <ScreenContainer
        className="flex-1 bg-background"
        edges={["top", "bottom", "left", "right"]}
      >
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/dashboard" />;
  }

  return (
    <ScreenContainer
      className="flex-1 bg-background"
      edges={["top", "bottom", "left", "right"]}
      testID="login-screen"
    >
      <View
        className="flex-1 items-center justify-center"
        style={{ paddingHorizontal: Spacing["2xl"] }}
      >
        <View
          className="items-center justify-center rounded-full"
          style={{
            width: 88,
            height: 88,
            backgroundColor: colors.primary + "18",
            marginBottom: Spacing["2xl"],
          }}
        >
          <Ionicons name="wallet-outline" size={40} color={colors.primary} />
        </View>

        <Text
          className="text-h1 font-bold text-foreground text-center"
          accessibilityRole="header"
        >
          {appName}
        </Text>
        <Text
          className="text-body text-muted text-center"
          style={{ marginTop: Spacing.sm, marginBottom: Spacing["2xl"] }}
        >
          Track spending, budgets and loans in one place. Sign in to continue.
        </Text>

        <View style={{ width: "100%", maxWidth: 360 }}>
          <Button
            variant="primary"
            size="lg"
            label="Sign in"
            onPress={handleSignIn}
            loading={submitting}
            disabled={submitting}
            testID="login-signin-button"
            accessibilityLabel="Sign in"
          />
        </View>

        {__DEV__ && Platform.OS === "web" ? (
          <Text
            className="text-caption text-muted text-center"
            style={{ marginTop: Spacing.lg }}
          >
            Development build: a local session is created automatically on
            start.
          </Text>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

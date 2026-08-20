import React, { useCallback } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";

import { AuthForm } from "@/components/auth-form";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { useThemeTokens } from "@/lib/theme-provider";

/**
 * Account creation. Signing up issues the session in the same response, so a
 * new user lands straight in the app rather than being bounced to sign in with
 * credentials they typed thirty seconds ago.
 */
export default function SignupScreen() {
  const { colors } = useThemeTokens();
  const { isAuthenticated, loading, refresh } = useAuth();

  const handleAuthenticated = useCallback(() => {
    refresh();
  }, [refresh]);

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

  return <AuthForm mode="signup" onAuthenticated={handleAuthenticated} />;
}

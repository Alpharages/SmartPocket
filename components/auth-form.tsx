import React, { useCallback, useMemo, useRef, useState } from "react";
import { Platform, ScrollView, Text, TextInput, View } from "react-native";
import Animated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { ScreenContainer } from "@/components/screen-container";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { useThemeTokens } from "@/lib/theme-provider";
import { getAppMetadata } from "@/lib/app-metadata";
import { Spacing, Typography } from "@/lib/_core/theme";
import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";

/**
 * The sign-in and sign-up screens are the same form with a different verb, so
 * they share one component rather than two near-identical copies that drift.
 *
 * Both call an endpoint that returns the session in its response — the server
 * sets a cookie for web and hands back the raw token for native — so neither
 * screen needs a second round trip after a successful submit.
 */

export type AuthMode = "login" | "signup";

const COPY = {
  login: {
    title: "Welcome back",
    subtitle: "Sign in to reach your transactions, budgets and loans.",
    submit: "Sign in",
    switchPrompt: "New here?",
    switchAction: "Create an account",
    switchHref: "/signup" as const,
    passwordAutoComplete: "current-password" as const,
  },
  signup: {
    title: "Create your account",
    subtitle: "Track spending, budgets and loans in one place.",
    submit: "Create account",
    switchPrompt: "Already have an account?",
    switchAction: "Sign in",
    switchHref: "/login" as const,
    passwordAutoComplete: "new-password" as const,
  },
};

/** Mirrors PASSWORD_MIN_LENGTH in server/_core/password.ts. */
const PASSWORD_MIN_LENGTH = 10;

export function AuthForm({
  mode,
  onAuthenticated,
}: {
  mode: AuthMode;
  onAuthenticated: () => void;
}) {
  const { colors } = useThemeTokens();
  const toast = useToast();
  // SP-101 again, on a plain screen this time: the app is edge-to-edge, so
  // Android does not resize the window for the IME and a centred flex:1 View
  // simply stays put — the keyboard covered the password field and the submit
  // button with no way to reach them. Same fix the Sheet uses: consume the IME
  // inset ourselves. No JS `Keyboard` fallback needed here — unlike Sheet,
  // this is the activity window, which is exactly what the hook reads.
  const keyboard = useAnimatedKeyboard();
  const queryClient = useQueryClient();
  const { name: appName } = getAppMetadata();
  const copy = COPY[mode];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const localProblem = useMemo(() => {
    if (!email.trim()) return "Enter your email address";
    if (!password) return "Enter your password";
    if (mode === "signup" && password.length < PASSWORD_MIN_LENGTH) {
      return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
    }
    return null;
  }, [email, password, mode]);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    if (localProblem) {
      toast.show({ type: "error", message: localProblem });
      return;
    }

    setSubmitting(true);
    try {
      const result =
        mode === "signup"
          ? await Api.signup({
              email: email.trim(),
              password,
              name: name.trim() || undefined,
            })
          : await Api.login({ email: email.trim(), password });

      // Native has no cookie jar, so the token is what keeps the session; on
      // web the cookie the server just set is the real one and this is only a
      // cache. Storing it on both is harmless and keeps the paths identical.
      if (result.token) {
        await Auth.setSessionToken(result.token);
      }
      if (result.user) {
        await Auth.setUserInfo({
          id: result.user.id,
          openId: result.user.openId,
          name: result.user.name,
          email: result.user.email,
          loginMethod: result.user.loginMethod,
          lastSignedIn: new Date(result.user.lastSignedIn),
        });
      }
      // Anything already cached was fetched while signed out (or as a
      // different account) and is either an error or somebody else's data.
      // The old OAuth flow reloaded the whole page and never had to think
      // about this; signing in place does. Without it the dashboard sits on
      // skeletons until the user manually reloads.
      queryClient.clear();
      onAuthenticated();
    } catch (error) {
      // `ApiError.message` is the server's own `error` field — "Incorrect email
      // or password", "That email is already registered", the throttle notice —
      // so it is already the right thing to show. Only a genuine network
      // failure needs a message invented here.
      const message =
        error instanceof Api.ApiError
          ? error.message
          : "Could not reach the server. Check your connection and try again.";
      toast.show({ type: "error", message });
    } finally {
      setSubmitting(false);
    }
  }, [
    submitting,
    localProblem,
    mode,
    email,
    password,
    name,
    toast,
    onAuthenticated,
    queryClient,
  ]);

  // Grows with the keyboard so the centred content is centred in what is left
  // above it, and the ScrollView can reach anything that still overflows.
  const keyboardSpacer = useAnimatedStyle(() => ({
    height: keyboard.height.value,
  }));

  const fieldStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === "ios" ? Spacing.md : Spacing.sm,
    marginTop: Spacing.sm,
    color: colors.foreground,
    fontSize: Typography.body.fontSize,
    // SP-097: a flex text field refuses to shrink below its intrinsic width on
    // web without this, overflowing the row and clipping the first character.
    minWidth: 0,
  };

  return (
    <ScreenContainer
      className="flex-1 bg-background"
      edges={["top", "bottom", "left", "right"]}
      testID={`${mode}-screen`}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: Spacing["2xl"],
        }}
      >
        <View
          className="items-center justify-center rounded-full"
          style={{
            width: 88,
            height: 88,
            backgroundColor: colors.primary + "18",
            marginBottom: Spacing.xl,
          }}
        >
          <Ionicons name="wallet-outline" size={40} color={colors.primary} />
        </View>

        <Text
          className="text-h1 font-bold text-foreground text-center"
          accessibilityRole="header"
        >
          {mode === "signup" ? copy.title : appName}
        </Text>
        <Text
          className="text-body text-muted text-center"
          style={{ marginTop: Spacing.sm, marginBottom: Spacing.xl }}
        >
          {copy.subtitle}
        </Text>

        <View style={{ width: "100%", maxWidth: 360 }}>
          {mode === "signup" ? (
            <>
              <Text className="text-caption text-muted">Name (optional)</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoComplete="name"
                returnKeyType="next"
                style={fieldStyle}
                placeholderTextColor={colors.muted}
                placeholder="Your name"
                accessibilityLabel="Name"
                testID={`${mode}-name`}
              />
              <View style={{ height: Spacing.md }} />
            </>
          ) : null}

          <Text className="text-caption text-muted">Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            style={fieldStyle}
            placeholderTextColor={colors.muted}
            placeholder="you@example.com"
            accessibilityLabel="Email"
            testID={`${mode}-email`}
          />

          <View style={{ height: Spacing.md }} />

          <Text className="text-caption text-muted">Password</Text>
          <TextInput
            ref={passwordRef}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete={copy.passwordAutoComplete}
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
            style={fieldStyle}
            placeholderTextColor={colors.muted}
            placeholder={
              mode === "signup"
                ? `At least ${PASSWORD_MIN_LENGTH} characters`
                : "Your password"
            }
            accessibilityLabel="Password"
            testID={`${mode}-password`}
          />

          <View style={{ height: Spacing.xl }} />

          <Button
            variant="primary"
            size="lg"
            label={copy.submit}
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting}
            testID={`${mode}-submit`}
            accessibilityLabel={copy.submit}
          />

          <View
            className="flex-row items-center justify-center"
            style={{ marginTop: Spacing.lg }}
          >
            <Text className="text-caption text-muted">
              {copy.switchPrompt}{" "}
            </Text>
            <Link href={copy.switchHref} testID={`${mode}-switch`}>
              <Text
                className="text-caption font-semibold"
                style={{ color: colors.primary }}
              >
                {copy.switchAction}
              </Text>
            </Link>
          </View>
        </View>

        <Animated.View style={keyboardSpacer} />
      </ScrollView>
    </ScreenContainer>
  );
}

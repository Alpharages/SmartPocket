import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Text,
  View,
  type AppStateStatus,
} from "react-native";
import { useRouter } from "expo-router";

import { Button } from "@/components/ui/Button";
import { PinPad } from "@/components/ui/PinPad";
import { useAuth } from "@/hooks/use-auth";
import { confirmDestructive } from "@/lib/confirm-dialog";
import { useThemeTokens } from "@/lib/theme-provider";
import {
  authenticateWithBiometrics,
  isAppLockSupported,
  isBiometricEnabled,
  isPinSet,
  verifyPin,
} from "@/lib/app-lock";

// Rendered as a wrapper around <Stack> (not a null-rendering sibling like
// AuthGate) — it needs to paint an opaque layer over the whole navigator, not
// just redirect. Children are always mounted so navigation state survives a
// lock/unlock cycle; the overlay is what gates visibility.
//
// The overlay alone can't cover a `transparentModal`/`fullScreenModal` route
// (add-transaction, budget-form, loan/record-repayment, login) — those are
// presented by react-native-screens as native view controllers *above* the RN
// root view, the same constraint components/ui/ConfirmProvider.tsx documents
// for a root-hosted Modal (ticket 86eyepuyq). Unlike that case, this can't be
// sidestepped by dropping to an OS-native API (there's no `Alert.alert`
// equivalent for a full PIN pad) — so every lock transition also dismisses
// any presented route back to the tab root via `router.dismissAll()`
// (standard popToTop; a normal navigation action on the same still-mounted
// navigator, not a remount) before the overlay takes over. This can only ever
// matter for the background-triggered relock: a route can't already be
// presented at the moment the app cold-starts.
type GateState = "checking" | "unlocked" | "locked";

const ERROR_FLASH_MS = 600;

export function AppLockGate({ children }: { children: React.ReactNode }) {
  const { colors } = useThemeTokens();
  const supported = isAppLockSupported();
  // "checking" starts the overlay covering on mount, before we know whether a
  // PIN is even set, so cold start never has a frame of visible data. On web
  // (unsupported) skip straight to unlocked — there's no storage to check and
  // no gap to cover.
  const [state, setState] = useState<GateState>(
    supported ? "checking" : "unlocked",
  );
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [forgettingPin, setForgettingPin] = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const { logout } = useAuth({ autoFetch: false });

  // Guards against re-firing the automatic biometric prompt on every render
  // while still locked (e.g. a state update from an unrelated effect) —
  // it resets whenever the gate leaves the "locked" state so the next lock
  // cycle prompts again.
  const biometricPromptedRef = useRef(false);

  // Bumped by every lock-state-deciding transition (mount check, background
  // re-check) so a slower-resolving async result can never overwrite a
  // decision made after it started — e.g. a correct-PIN verify that resolves
  // just as the app backgrounds again must not unlock the newer lock.
  const epochRef = useRef(0);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);
  const router = useRouter();
  const routerRef = useRef(router);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  const dismissPresentedRoutes = useCallback(() => {
    if (routerRef.current.canDismiss()) {
      routerRef.current.dismissAll();
    }
  }, []);

  const clearErrorTimer = useCallback(() => {
    if (errorTimerRef.current !== null) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
  }, []);

  const flashError = useCallback(
    (message: string) => {
      clearErrorTimer();
      setErrorMessage(message);
      setError(true);
      errorTimerRef.current = setTimeout(() => {
        errorTimerRef.current = null;
        setError(false);
      }, ERROR_FLASH_MS);
    },
    [clearErrorTimer],
  );

  useEffect(() => {
    if (!supported) return;
    epochRef.current += 1;
    const epoch = epochRef.current;
    Promise.all([isPinSet(), isBiometricEnabled()])
      .then(([pinIsSet, biometricIsEnabled]) => {
        if (epochRef.current !== epoch) return;
        setBiometricEnabledState(biometricIsEnabled === true);
        // `null` means the storage read failed, not that no PIN exists — fail
        // closed rather than risk leaving financial data unlocked because a
        // Keystore/Keychain read errored.
        if (pinIsSet === false) {
          setState("unlocked");
        } else {
          dismissPresentedRoutes();
          setState("locked");
        }
      })
      .catch(() => {
        if (epochRef.current !== epoch) return;
        dismissPresentedRoutes();
        setState("locked");
      });
  }, [supported, dismissPresentedRoutes]);

  useEffect(() => {
    if (!supported) return;
    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        // Deliberately only "background", not "inactive" — iOS fires
        // "inactive" for the share sheet, document picker (CSV import/export),
        // and permission prompts, and re-locking mid-flow would be a bug, not
        // a feature.
        if (nextState !== "background") return;
        // Lock synchronously — the JS thread can suspend shortly after
        // backgrounding on iOS, so waiting for the isPinSet() round-trip to
        // resolve before covering risks painting the unlocked tree first on
        // return. Re-read live (not cached) so a PIN or biometric preference
        // set/cleared from Settings takes effect on this same transition,
        // without an app restart. Dismiss any presented route
        // (add-transaction, budget-form, ...) back to the tab root — the
        // overlay alone can't cover a natively-presented modal screen.
        epochRef.current += 1;
        const epoch = epochRef.current;
        dismissPresentedRoutes();
        setState("locked");
        Promise.all([isPinSet(), isBiometricEnabled()])
          .then(([pinIsSet, biometricIsEnabled]) => {
            if (epochRef.current !== epoch) return;
            setBiometricEnabledState(biometricIsEnabled === true);
            if (pinIsSet === false) setState("unlocked");
          })
          .catch(() => {
            // Already fail-closed (locked) from the synchronous set above.
          });
      },
    );
    return () => subscription.remove();
  }, [supported, dismissPresentedRoutes]);

  useEffect(() => {
    if (!supported) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => stateRef.current !== "unlocked",
    );
    return () => subscription.remove();
  }, [supported]);

  useEffect(() => clearErrorTimer, [clearErrorTimer]);

  // Fires the OS biometric prompt automatically the moment the lock screen
  // appears (AC3), once per lock cycle. A failed/cancelled scan leaves the
  // gate locked with the PIN pad as the always-available fallback. Epoch-
  // guarded like every other unlock decision: a scan that succeeds after the
  // app has backgrounded again must not unlock the newer lock.
  useEffect(() => {
    if (state !== "locked") {
      biometricPromptedRef.current = false;
      return;
    }
    if (!biometricEnabled || biometricPromptedRef.current) return;
    biometricPromptedRef.current = true;
    const epoch = epochRef.current;
    void authenticateWithBiometrics().then((success) => {
      if (success && epochRef.current === epoch) setState("unlocked");
    });
  }, [state, biometricEnabled]);

  const handleKeyPress = useCallback(() => {
    clearErrorTimer();
    setError(false);
  }, [clearErrorTimer]);

  const handleSubmit = useCallback(
    (pin: string) => {
      const epoch = epochRef.current;
      setSubmitting(true);
      verifyPin(pin)
        .then((verified) => {
          if (epochRef.current !== epoch) return;
          if (verified) {
            clearErrorTimer();
            setError(false);
            setState("unlocked");
          } else if (verified === null) {
            flashError("Couldn't verify your PIN. Try again.");
          } else {
            flashError("Incorrect PIN. Try again.");
          }
        })
        .catch(() => {
          if (epochRef.current === epoch) {
            flashError("Couldn't verify your PIN. Try again.");
          }
        })
        .finally(() => {
          if (epochRef.current === epoch) setSubmitting(false);
        });
    },
    [clearErrorTimer, flashError],
  );

  // logout() clears the PIN and biometric preference itself (hooks/use-auth.ts)
  // so this only has to sign out and leave — there's no lock state left to
  // re-check. Bump the epoch first so a verify/isPinSet already in flight
  // can't re-lock or unlock behind this decision.
  const handleForgotPin = useCallback(async () => {
    const confirmed = await confirmDestructive({
      title: "Forgot PIN?",
      message:
        "This signs you out. You'll get back in with your account sign-in, and can set a new PIN from Settings.",
      confirmLabel: "Sign Out",
      cancelLabel: "Cancel",
    });
    if (!confirmed) return;

    epochRef.current += 1;
    setForgettingPin(true);
    try {
      await logout();
      clearErrorTimer();
      setError(false);
      setState("unlocked");
      routerRef.current.replace("/login");
    } finally {
      setForgettingPin(false);
    }
  }, [logout, clearErrorTimer]);

  const handleBiometricRetry = useCallback(() => {
    const epoch = epochRef.current;
    void authenticateWithBiometrics().then((success) => {
      if (success && epochRef.current === epoch) setState("unlocked");
    });
  }, []);

  return (
    <>
      <View
        style={{ flex: 1 }}
        importantForAccessibility={
          state !== "unlocked" ? "no-hide-descendants" : "auto"
        }
      >
        {children}
      </View>
      {state !== "unlocked" ? (
        <View
          testID="app-lock-overlay"
          accessibilityViewIsModal
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.background,
            zIndex: 10000,
            elevation: 10000,
          }}
        >
          {state === "locked" ? (
            <>
              <Text
                style={{
                  marginBottom: 16,
                  fontSize: 20,
                  fontWeight: "600",
                  color: colors.foreground,
                }}
              >
                Enter your PIN
              </Text>
              <Text
                style={{
                  marginBottom: 16,
                  minHeight: 18,
                  fontSize: 13,
                  color: colors.error,
                }}
              >
                {errorMessage}
              </Text>
              <PinPad
                onSubmit={handleSubmit}
                onKeyPress={handleKeyPress}
                error={error}
                disabled={submitting || forgettingPin}
                onBiometricPress={
                  biometricEnabled ? handleBiometricRetry : undefined
                }
              />
              <Button
                variant="ghost"
                label="Forgot PIN?"
                onPress={handleForgotPin}
                disabled={submitting || forgettingPin}
                loading={forgettingPin}
                style={{ marginTop: 24 }}
              />
            </>
          ) : (
            <ActivityIndicator color={colors.primary} />
          )}
        </View>
      ) : null}
    </>
  );
}

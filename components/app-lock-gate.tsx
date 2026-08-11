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

import { PinPad } from "@/components/ui/PinPad";
import { useThemeTokens } from "@/lib/theme-provider";
import { isAppLockSupported, isPinSet, verifyPin } from "@/lib/app-lock";

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
    isPinSet()
      .then((pinIsSet) => {
        if (epochRef.current !== epoch) return;
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
        // return. Re-read live (not cached) so a PIN cleared from Settings
        // still un-gates on this same transition. Dismiss any presented
        // route (add-transaction, budget-form, ...) back to the tab root —
        // the overlay alone can't cover a natively-presented modal screen.
        epochRef.current += 1;
        const epoch = epochRef.current;
        dismissPresentedRoutes();
        setState("locked");
        isPinSet()
          .then((pinIsSet) => {
            if (epochRef.current !== epoch) return;
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
                disabled={submitting}
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

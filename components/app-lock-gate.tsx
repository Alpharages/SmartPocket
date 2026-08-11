import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Text, View, type AppStateStatus } from "react-native";

import { PinPad } from "@/components/ui/PinPad";
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
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  // Guards against re-firing the automatic biometric prompt on every render
  // while still locked (e.g. a state update from an unrelated effect) —
  // it resets whenever the gate leaves the "locked" state so the next lock
  // cycle prompts again.
  const biometricPromptedRef = useRef(false);

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    Promise.all([isPinSet(), isBiometricEnabled()])
      .then(([pinIsSet, biometricIsEnabled]) => {
        if (cancelled) return;
        setBiometricEnabledState(biometricIsEnabled === true);
        // `null` means the storage read failed, not that no PIN exists — fail
        // closed rather than risk leaving financial data unlocked because a
        // Keystore/Keychain read errored.
        setState(pinIsSet === false ? "unlocked" : "locked");
      })
      .catch(() => {
        if (!cancelled) setState("locked");
      });
    return () => {
      cancelled = true;
    };
  }, [supported]);

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
        // Re-read on every background transition (not cached) so a PIN or
        // biometric preference set/cleared from Settings takes effect
        // without an app restart.
        void Promise.all([isPinSet(), isBiometricEnabled()]).then(
          ([pinIsSet, biometricIsEnabled]) => {
            if (pinIsSet !== false) {
              setBiometricEnabledState(biometricIsEnabled === true);
              setState("locked");
            }
          },
        );
      },
    );
    return () => subscription.remove();
  }, [supported]);

  // Fires the OS biometric prompt automatically the moment the lock screen
  // appears (AC3), once per lock cycle. A failed/cancelled scan leaves the
  // gate locked with the PIN pad as the always-available fallback.
  useEffect(() => {
    if (state !== "locked") {
      biometricPromptedRef.current = false;
      return;
    }
    if (!biometricEnabled || biometricPromptedRef.current) return;
    biometricPromptedRef.current = true;
    void authenticateWithBiometrics().then((success) => {
      if (success) setState("unlocked");
    });
  }, [state, biometricEnabled]);

  const handleSubmit = useCallback((pin: string) => {
    verifyPin(pin)
      .then((verified) => {
        if (verified) {
          setError(false);
          setState("unlocked");
        } else {
          setError(true);
          setTimeout(() => setError(false), ERROR_FLASH_MS);
        }
      })
      .catch(() => {
        setError(true);
        setTimeout(() => setError(false), ERROR_FLASH_MS);
      });
  }, []);

  const handleBiometricRetry = useCallback(() => {
    void authenticateWithBiometrics().then((success) => {
      if (success) setState("unlocked");
    });
  }, []);

  return (
    <>
      {children}
      {state !== "unlocked" ? (
        <View
          testID="app-lock-overlay"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.background,
          }}
        >
          {state === "locked" ? (
            <>
              <Text
                style={{
                  marginBottom: 32,
                  fontSize: 20,
                  fontWeight: "600",
                  color: colors.foreground,
                }}
              >
                Enter your PIN
              </Text>
              <PinPad
                onSubmit={handleSubmit}
                error={error}
                onBiometricPress={
                  biometricEnabled ? handleBiometricRetry : undefined
                }
              />
            </>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

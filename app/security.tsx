import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { Button } from "@/components/ui/Button";
import { PinPad } from "@/components/ui/PinPad";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Sheet } from "@/components/ui/Sheet";
import { SettingsRow } from "@/components/ui/SettingsRow";
import { useToast } from "@/components/ui/ToastProvider";
import { useColors } from "@/hooks/use-colors";
import {
  clearAppLock,
  getBiometricLabel,
  getPin,
  isAppLockSupported,
  isBiometricEnabled,
  isPinSet,
  setBiometricEnabled,
  setPin,
  verifyPin,
} from "@/lib/app-lock";
import { trpc } from "@/lib/trpc";

// PinPad's `error` prop must round-trip false -> true -> false for its own
// clear-on-error effect to fire on the *next* mismatch too; this is how long
// the red/error state is shown before the pad resets to normal for re-entry.
const ERROR_FLASH_MS = 600;

type Step =
  | "closed"
  | "verify-disable"
  | "verify-change"
  | "enter-new"
  | "confirm-new";

function stepTitle(step: Step): string {
  switch (step) {
    case "verify-disable":
      return "Enter current PIN to turn off App Lock";
    case "verify-change":
      return "Enter current PIN";
    case "enter-new":
      return "Enter new PIN";
    case "confirm-new":
      return "Confirm new PIN";
    case "closed":
      return "";
  }
}

export default function SecurityScreen() {
  const router = useRouter();
  const colors = useColors();
  // Destructured so effect/callback deps track the stable `show` reference,
  // not the `useToast()` context object — `ToastProvider` used to hand back
  // a fresh object on every render, which turned a `toast` dependency into
  // an infinite read/toast loop on a failing status read (round-2 review, B4).
  const { show: showToast } = useToast();
  const supported = isAppLockSupported();
  const setServerPinMutation = trpc.security.setPin.useMutation();
  const clearServerPinMutation = trpc.security.clearPin.useMutation();
  const pinStatusQuery = trpc.security.getPinStatus.useQuery(undefined, {
    enabled: supported,
  });

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [pinSet, setPinSetState] = useState(false);
  const [step, setStep] = useState<Step>("closed");
  const [pendingPin, setPendingPin] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [biometricLabel, setBiometricLabelState] = useState<string | null>(
    null,
  );
  const [biometricOn, setBiometricOnState] = useState(false);
  // Captured when verify-change locally confirms the old PIN, so the
  // eventual setPin sync can prove ownership of the PIN it's overwriting
  // (N4) — null on the fresh-enable path, where there's nothing to prove yet.
  const [verifiedCurrentPin, setVerifiedCurrentPin] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!supported) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    isPinSet()
      .then((current) => {
        if (cancelled) return;
        // `isPinSet` degrades a storage read failure to `null` (see
        // lib/app-lock.ts) rather than rejecting, so `null` here means the
        // read genuinely failed — not "unsupported" (that path returns early
        // above) — and the screen must not report the lock as off.
        if (current === null) {
          setLoadError(true);
          showToast({
            type: "error",
            message: "Couldn't read App Lock status. Tap Retry to try again.",
          });
        } else {
          setPinSetState(current);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("[Security] Failed to read App Lock status:", err);
        setLoadError(true);
        showToast({
          type: "error",
          message: "Couldn't read App Lock status. Tap Retry to try again.",
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supported, reloadToken, showToast]);

  // Capability (hardware + enrollment) and preference are read independently
  // of `pinSet` — the toggle's visibility (pinSet && biometricLabel) is a
  // render-time decision, not a fetch-time one.
  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    Promise.all([getBiometricLabel(), isBiometricEnabled()]).then(
      ([label, enabled]) => {
        if (cancelled) return;
        setBiometricLabelState(label);
        setBiometricOnState(enabled === true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [supported, reloadToken]);

  const closeStep = useCallback(() => {
    setStep("closed");
    setPendingPin(null);
    setVerifiedCurrentPin(null);
    setError(false);
    setErrorMessage("");
  }, []);

  const flashError = useCallback((message: string) => {
    setErrorMessage(message);
    setError(true);
    setTimeout(() => setError(false), ERROR_FLASH_MS);
  }, []);

  // Best-effort account sync (Story 13.6): the local keychain write above is
  // always the source of truth for this device's unlock — a sync failure
  // here surfaces a toast but never reopens the sheet or rolls back the
  // already-successful local change.
  const syncPinToServer = useCallback(
    async (pin: string, currentPin?: string) => {
      try {
        await setServerPinMutation.mutateAsync({ pin, currentPin });
      } catch (err) {
        console.error("[Security] Failed to sync PIN to account:", err);
        // R4: a fresh-enable (no currentPin — nothing to prove yet) hitting
        // BAD_REQUEST means the account already has a PIN from another
        // device (assertCurrentPinProof on the server). Say so plainly
        // instead of the generic message — restoring the existing account
        // PIN onto this device remains out of scope (see N9), but the user
        // should know their device's PIN diverged from the account's, not
        // just that "something" failed to sync.
        const code = (err as { data?: { code?: string } } | undefined)?.data
          ?.code;
        if (code === "BAD_REQUEST" && !currentPin) {
          showToast({
            type: "error",
            message:
              "This device's PIN wasn't synced — your account already has a PIN from another device.",
          });
          return;
        }
        showToast({
          type: "error",
          message:
            "PIN saved on this device, but couldn't sync to your account.",
        });
      }
    },
    [setServerPinMutation, showToast],
  );

  const clearServerPin = useCallback(async () => {
    try {
      await clearServerPinMutation.mutateAsync();
    } catch (err) {
      console.error("[Security] Failed to clear account PIN:", err);
      showToast({
        type: "error",
        message: "App Lock turned off, but couldn't sync to your account.",
      });
    }
  }, [clearServerPinMutation, showToast]);

  // Reconcile, not just backfill: this closes three gaps at once — (1) a PIN
  // set under 13.1–13.5 before this story existed never had a chance to sync
  // (B3's literal "Given a device-local PIN exists"), (2) a previous
  // syncPinToServer call that failed offline gets retried the next time this
  // screen mounts, and (3) setPin/clearPin landing out of order over a slow
  // link self-heals the same way. Deliberately one-directional — local PIN
  // set + server unset is unambiguous (push it) — but local unset + server
  // set is NOT reconciled here: that state is indistinguishable from a
  // legitimate second device that simply hasn't set a local PIN yet, and
  // force-clearing the account PIN from that signal would destroy another
  // device's setup. See the N9 note in the PR description.
  useEffect(() => {
    if (!supported || loading) return;
    if (!pinSet) return;
    if (!pinStatusQuery.data || pinStatusQuery.data.pinSet) return;

    let cancelled = false;
    getPin().then((localPin) => {
      if (cancelled || !localPin) return;
      void syncPinToServer(localPin);
    });
    return () => {
      cancelled = true;
    };
  }, [supported, loading, pinSet, pinStatusQuery.data, syncPinToServer]);

  const handleToggleAppLock = useCallback((enabled: boolean) => {
    setErrorMessage("");
    setStep(enabled ? "enter-new" : "verify-disable");
  }, []);

  const handleChangePin = useCallback(() => {
    setErrorMessage("");
    setStep("verify-change");
  }, []);

  const handleToggleBiometric = useCallback(
    async (enabled: boolean) => {
      try {
        await setBiometricEnabled(enabled);
        setBiometricOnState(enabled);
      } catch (err) {
        console.error("[Security] Failed to update biometric preference:", err);
        showToast({
          type: "error",
          message: "Something went wrong. Please try again.",
        });
        const current = await isBiometricEnabled();
        if (current !== null) setBiometricOnState(current);
      }
    },
    [showToast],
  );

  // Re-reads storage after a write/verify failure so the rendered toggle and
  // rows always match what's actually on disk — never trust optimistic state
  // once a `setPin`/`clearAppLock` call has rejected (see B3 review finding).
  const resyncPinState = useCallback(async () => {
    const current = await isPinSet();
    if (current !== null) setPinSetState(current);
  }, []);

  const handleSubmitPin = useCallback(
    async (pin: string) => {
      try {
        if (step === "verify-disable") {
          const verified = await verifyPin(pin);
          if (verified === null) {
            flashError("Couldn't verify your PIN. Try again.");
            return;
          }
          if (verified) {
            await clearAppLock();
            setPinSetState(false);
            // AC: biometric unlock never exists without the PIN fallback —
            // clearAppLock already wiped the biometric key on disk, this
            // just keeps the toggle's rendered state in sync.
            setBiometricOnState(false);
            closeStep();
            await clearServerPin();
          } else {
            flashError("Incorrect PIN. Try again.");
          }
          return;
        }

        if (step === "verify-change") {
          const verified = await verifyPin(pin);
          if (verified === null) {
            flashError("Couldn't verify your PIN. Try again.");
            return;
          }
          if (verified) {
            setErrorMessage("");
            // Remember the just-verified old PIN so the eventual server sync
            // can prove ownership of the PIN it's about to overwrite (N4).
            setVerifiedCurrentPin(pin);
            setStep("enter-new");
          } else {
            flashError("Incorrect PIN. Try again.");
          }
          return;
        }

        if (step === "enter-new") {
          setPendingPin(pin);
          setErrorMessage("");
          setStep("confirm-new");
          return;
        }

        if (step === "confirm-new") {
          if (pendingPin !== null && pin === pendingPin) {
            const proofOfOldPin = verifiedCurrentPin ?? undefined;
            await setPin(pin);
            setPinSetState(true);
            closeStep();
            await syncPinToServer(pin, proofOfOldPin);
          } else {
            // AC: a mismatch restarts the confirm step (re-enter the
            // confirmation), not the whole new-PIN entry — pendingPin stays.
            flashError("PINs didn't match. Try again.");
          }
        }
      } catch (err) {
        console.error("[Security] Failed to update App Lock:", err);
        showToast({
          type: "error",
          message: "Something went wrong. Please try again.",
        });
        await resyncPinState();
        // Reconcile the step machine alongside the data: without this the
        // sheet stays open on "Enter current PIN to turn off App Lock" even
        // after a failed clearAppLock() has already deleted the PIN key —
        // re-entering it then reports "Incorrect PIN" for a lock that reads
        // as off (round-2 review, N7).
        closeStep();
      }
    },
    [
      step,
      pendingPin,
      verifiedCurrentPin,
      closeStep,
      flashError,
      showToast,
      resyncPinState,
      syncPinToServer,
      clearServerPin,
    ],
  );

  if (!supported) {
    return (
      <ScreenContainer className="flex-1 bg-background">
        <ScreenHeader
          title="Security"
          accessibilityLabel="Security screen"
          leading={
            <Button
              variant="icon-only"
              accessibilityLabel="Go back"
              onPress={() => router.back()}
              leftIcon={
                <Ionicons
                  name="chevron-back"
                  size={22}
                  color={colors.foreground}
                />
              }
            />
          }
        />
        <View className="flex-1 items-center justify-center px-lg">
          <Text className="text-body text-muted text-center">
            App Lock is only available on iOS and Android.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1 bg-background">
      <ScreenHeader
        title="Security"
        accessibilityLabel="Security screen"
        leading={
          <Button
            variant="icon-only"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            leftIcon={
              <Ionicons
                name="chevron-back"
                size={22}
                color={colors.foreground}
              />
            }
          />
        }
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : loadError ? (
        <View className="flex-1 items-center justify-center px-lg">
          <Text className="text-body text-muted text-center">
            Couldn&apos;t read App Lock status.
          </Text>
          <Button
            className="mt-md"
            variant="secondary"
            label="Retry"
            accessibilityLabel="Retry loading App Lock status"
            onPress={() => setReloadToken((n) => n + 1)}
          />
        </View>
      ) : (
        <View
          className="mt-xl mx-lg rounded-2xl overflow-hidden"
          style={{
            backgroundColor: colors.surface,
            borderWidth: 0.5,
            borderColor: colors.border,
          }}
        >
          <View
            className="flex-row items-center px-lg"
            style={{ minHeight: 44 }}
          >
            <View className="flex-1 pr-md">
              <Text className="text-body font-medium text-foreground">
                App Lock
              </Text>
              <Text className="mt-xs text-caption text-muted">
                Require a PIN to open SmartPocket.
              </Text>
            </View>
            <Switch
              value={pinSet}
              onValueChange={handleToggleAppLock}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
              accessibilityRole="switch"
              accessibilityLabel="App Lock"
              accessibilityState={{ checked: pinSet }}
            />
          </View>

          {pinSet && biometricLabel ? (
            <>
              <View
                className="mx-lg"
                style={{ height: 0.5, backgroundColor: colors.border }}
              />
              <View
                className="flex-row items-center px-lg"
                style={{ minHeight: 44 }}
              >
                <View className="flex-1 pr-md">
                  <Text className="text-body font-medium text-foreground">
                    {biometricLabel}
                  </Text>
                  <Text className="mt-xs text-caption text-muted">
                    Unlock with {biometricLabel} instead of your PIN.
                  </Text>
                </View>
                <Switch
                  value={biometricOn}
                  onValueChange={handleToggleBiometric}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.surface}
                  accessibilityRole="switch"
                  accessibilityLabel={biometricLabel}
                  accessibilityState={{ checked: biometricOn }}
                />
              </View>
            </>
          ) : null}

          {pinSet ? (
            <>
              <View
                className="mx-lg"
                style={{ height: 0.5, backgroundColor: colors.border }}
              />
              <SettingsRow
                icon="key-outline"
                label="Change PIN"
                onPress={handleChangePin}
                accessibilityLabel="Change PIN"
              />
            </>
          ) : null}
        </View>
      )}

      <Sheet
        visible={step !== "closed"}
        onClose={closeStep}
        title={stepTitle(step)}
        testID="security-pin-sheet"
      >
        <View className="items-center px-lg pb-lg">
          {errorMessage ? (
            <Text
              className="mb-md text-caption text-center"
              style={{ color: colors.error }}
            >
              {errorMessage}
            </Text>
          ) : null}
          <PinPad onSubmit={handleSubmitPin} error={error} />
        </View>
      </Sheet>
    </ScreenContainer>
  );
}

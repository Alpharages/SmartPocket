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
import { useColors } from "@/hooks/use-colors";
import {
  clearAppLock,
  isAppLockSupported,
  isPinSet,
  setPin,
  verifyPin,
} from "@/lib/app-lock";

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
  const supported = isAppLockSupported();

  const [loading, setLoading] = useState(true);
  const [pinSet, setPinSetState] = useState(false);
  const [step, setStep] = useState<Step>("closed");
  const [pendingPin, setPendingPin] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!supported) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void isPinSet().then((current) => {
      if (cancelled) return;
      setPinSetState(current === true);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [supported]);

  const closeStep = useCallback(() => {
    setStep("closed");
    setPendingPin(null);
    setError(false);
    setErrorMessage("");
  }, []);

  const flashError = useCallback((message: string) => {
    setErrorMessage(message);
    setError(true);
    setTimeout(() => setError(false), ERROR_FLASH_MS);
  }, []);

  const handleToggleAppLock = useCallback((enabled: boolean) => {
    setErrorMessage("");
    setStep(enabled ? "enter-new" : "verify-disable");
  }, []);

  const handleChangePin = useCallback(() => {
    setErrorMessage("");
    setStep("verify-change");
  }, []);

  const handleSubmitPin = useCallback(
    async (pin: string) => {
      if (step === "verify-disable") {
        if (await verifyPin(pin)) {
          await clearAppLock();
          setPinSetState(false);
          closeStep();
        } else {
          flashError("Incorrect PIN. Try again.");
        }
        return;
      }

      if (step === "verify-change") {
        if (await verifyPin(pin)) {
          setErrorMessage("");
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
          await setPin(pin);
          setPinSetState(true);
          closeStep();
        } else {
          // AC: a mismatch restarts the confirm step (re-enter the
          // confirmation), not the whole new-PIN entry — pendingPin stays.
          flashError("PINs didn't match. Try again.");
        }
      }
    },
    [step, pendingPin, closeStep, flashError],
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

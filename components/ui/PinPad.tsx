import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Platform,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useThemeTokens } from "@/lib/theme-provider";
import { usePressFeedback } from "@/hooks/use-press-feedback";
import { AnimatedPressable } from "@/lib/_core/nativewind-pressable";

export type PinPadProps = {
  /** Fired with the 4-digit PIN once the 4th digit is entered. */
  onSubmit: (pin: string) => void;
  /**
   * Fired on every digit or backspace key press, before the press is
   * otherwise handled — lets the caller drop a stale `error` state as soon
   * as the user starts a new attempt.
   */
  onKeyPress?: () => void;
  /**
   * Renders a biometric retry key in the pad's bottom-left slot (replacing
   * the spacer). Omit to render a plain 4x3 pad with no biometric affordance.
   */
  onBiometricPress?: () => void;
  /** Accessibility label for the biometric retry key. */
  biometricLabel?: string;
  /** Renders the dots in the error color and clears entered digits. */
  error?: boolean;
  disabled?: boolean;
  className?: string;
  style?: StyleProp<ViewStyle>;
};

const PIN_LENGTH = 4;
// NFR-5 / WCAG 2.1 AA: every key must present at least a 44pt touch target.
const MIN_TOUCH_TARGET = 44;
const DEFAULT_BIOMETRIC_LABEL = "Use biometric unlock";

type PadKey = {
  label: string;
  kind: "digit" | "backspace" | "spacer" | "biometric";
};

const DIGIT_ROWS: PadKey[][] = [
  [
    { label: "1", kind: "digit" },
    { label: "2", kind: "digit" },
    { label: "3", kind: "digit" },
  ],
  [
    { label: "4", kind: "digit" },
    { label: "5", kind: "digit" },
    { label: "6", kind: "digit" },
  ],
  [
    { label: "7", kind: "digit" },
    { label: "8", kind: "digit" },
    { label: "9", kind: "digit" },
  ],
];

function PinPadKey({
  padKey,
  disabled,
  onPress,
}: {
  padKey: PadKey;
  disabled: boolean;
  onPress: (padKey: PadKey) => void;
}) {
  const { colors } = useThemeTokens();
  const { animatedStyle, onPressIn, onPressOut } = usePressFeedback();

  const handlePressIn = useCallback(() => {
    if (disabled) return;
    onPressIn();
  }, [disabled, onPressIn]);

  const handlePress = useCallback(() => {
    if (!disabled) onPress(padKey);
  }, [disabled, onPress, padKey]);

  if (padKey.kind === "spacer") {
    return <View style={{ width: 72, height: 72 }} />;
  }

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={padKey.label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={onPressOut}
      onPress={handlePress}
      style={[
        {
          width: 72,
          height: 72,
          minWidth: MIN_TOUCH_TARGET,
          minHeight: MIN_TOUCH_TARGET,
          borderRadius: 36,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          opacity: disabled ? 0.5 : 1,
        },
        animatedStyle,
      ]}
    >
      <PadKeyContent padKey={padKey} color={colors.foreground} />
    </AnimatedPressable>
  );
}

function PadKeyContent({ padKey, color }: { padKey: PadKey; color: string }) {
  if (padKey.kind === "biometric") {
    return <Ionicons name="finger-print" size={28} color={color} />;
  }
  return (
    <Text style={{ fontSize: 24, fontWeight: "600", color }}>
      {padKey.kind === "backspace" ? "⌫" : padKey.label}
    </Text>
  );
}

export function PinPad({
  onSubmit,
  onKeyPress,
  onBiometricPress,
  biometricLabel = DEFAULT_BIOMETRIC_LABEL,
  error = false,
  disabled = false,
  className,
  style,
}: PinPadProps) {
  const { colors } = useThemeTokens();
  const [digits, setDigits] = useState<string>("");
  // Mirrors `digits` but is updated synchronously (not through React state),
  // so two presses that land before the first has re-rendered — two fingers
  // on the pad — each read the other's write instead of both computing `next`
  // from the same stale value and silently dropping a digit.
  const digitsRef = useRef<string>("");
  // Marks that the in-flight keypress already applied its own digit update in
  // this commit — set synchronously in `handleKeyPress`, read by the `[error]`
  // effect below, then unconditionally cleared after every commit so a stale
  // `true` never suppresses a later, unrelated `error` transition.
  const keyPressCommitRef = useRef(false);

  // Clear stale digits when `error` toggles from an external source — e.g.
  // the caller flips `error` true after a rejected verify, or flips it back
  // to false on its own. A keypress that itself triggers the false→true
  // transition via `onKeyPress` (below) already applied its own digit
  // synchronously in the same React commit; wiping `digits` here would
  // destroy that keystroke, so this effect backs off when
  // `keyPressCommitRef` shows the transition was keypress-driven.
  useEffect(() => {
    if (keyPressCommitRef.current) return;
    digitsRef.current = "";
    setDigits("");
  }, [error]);

  // Announce rejected PINs to screen readers — the dots alone convey this by
  // color only, which fails SC 1.4.1 for low-vision/screen-reader users.
  useEffect(() => {
    if (error && Platform.OS === "ios") {
      AccessibilityInfo.announceForAccessibility(
        "Incorrect PIN. Please try again.",
      );
    }
  }, [error]);

  // Declared last so it runs after the `[error]` effect above has had its
  // chance to read the flag for this commit.
  useEffect(() => {
    keyPressCommitRef.current = false;
  });

  const handleKeyPress = useCallback(
    (padKey: PadKey) => {
      // Biometric retry is a side-channel action, not a PIN keystroke — it
      // must not touch onKeyPress/digits/onSubmit.
      if (padKey.kind === "biometric") {
        onBiometricPress?.();
        return;
      }

      keyPressCommitRef.current = true;
      onKeyPress?.();
      if (padKey.kind === "backspace") {
        digitsRef.current = digitsRef.current.slice(0, -1);
        setDigits(digitsRef.current);
        return;
      }

      if (digitsRef.current.length >= PIN_LENGTH) return;
      // `onSubmit` fires from the handler body, not from inside a `setDigits`
      // updater — updaters must stay pure, and React may invoke them more
      // than once (e.g. StrictMode), which would double-fire submit.
      const next = digitsRef.current + padKey.label;
      digitsRef.current = next.length === PIN_LENGTH ? "" : next;
      setDigits(digitsRef.current);
      if (next.length === PIN_LENGTH) onSubmit(next);
    },
    [onKeyPress, onSubmit, onBiometricPress],
  );

  const a11yLabel = error
    ? "PIN entry: incorrect PIN, please try again"
    : `PIN entry: ${digits.length} of ${PIN_LENGTH} digits entered`;

  const bottomRow: PadKey[] = [
    onBiometricPress
      ? { label: biometricLabel, kind: "biometric" }
      : { label: "", kind: "spacer" },
    { label: "0", kind: "digit" },
    { label: "Backspace", kind: "backspace" },
  ];
  const keyRows: PadKey[][] = [...DIGIT_ROWS, bottomRow];

  return (
    <View className={className} style={style}>
      <View
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={a11yLabel}
        style={{ flexDirection: "row", justifyContent: "center", gap: 16 }}
      >
        {Array.from({ length: PIN_LENGTH }).map((_, index) => {
          const filled = index < digits.length;
          return (
            <View
              key={index}
              testID="pin-pad-dot"
              style={{
                width: 16,
                height: 16,
                borderRadius: 8,
                borderWidth: 2,
                borderColor: error
                  ? colors.error
                  : filled
                    ? colors.primary
                    : colors.muted,
                backgroundColor: filled
                  ? error
                    ? colors.error
                    : colors.primary
                  : undefined,
              }}
            />
          );
        })}
      </View>
      <View style={{ marginTop: 32, gap: 12 }}>
        {keyRows.map((row, rowIndex) => (
          <View
            key={rowIndex}
            style={{ flexDirection: "row", justifyContent: "center", gap: 12 }}
          >
            {row.map((padKey, keyIndex) => (
              <PinPadKey
                key={
                  padKey.kind === "spacer" ? `spacer-${keyIndex}` : padKey.label
                }
                padKey={padKey}
                disabled={disabled}
                onPress={handleKeyPress}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";

import { useColors } from "@/hooks/use-colors";
import { usePressFeedback } from "@/hooks/use-press-feedback";
import { AnimatedPressable } from "@/lib/_core/nativewind-pressable";

export type PinPadProps = {
  /** Fired with the 4-digit PIN once the 4th digit is entered. */
  onSubmit: (pin: string) => void;
  /** Renders the dots in the error color and clears entered digits. */
  error?: boolean;
  disabled?: boolean;
  className?: string;
  style?: StyleProp<ViewStyle>;
};

const PIN_LENGTH = 4;
// NFR-5 / WCAG 2.1 AA: every key must present at least a 44pt touch target.
const MIN_TOUCH_TARGET = 44;

type PadKey = { label: string; kind: "digit" | "backspace" | "spacer" };

const KEY_ROWS: PadKey[][] = [
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
  [
    { label: "", kind: "spacer" },
    { label: "0", kind: "digit" },
    { label: "Backspace", kind: "backspace" },
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
  const colors = useColors();
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
  return (
    <Text style={{ fontSize: 24, fontWeight: "600", color }}>
      {padKey.kind === "backspace" ? "⌫" : padKey.label}
    </Text>
  );
}

export function PinPad({
  onSubmit,
  error = false,
  disabled = false,
  className,
  style,
}: PinPadProps) {
  const colors = useColors();
  const [digits, setDigits] = useState<string>("");
  // Mirrors `digits` but is updated synchronously (not through React state),
  // so two presses that land before the first has re-rendered — two fingers
  // on the pad — each read the other's write instead of both computing `next`
  // from the same stale value and silently dropping a digit.
  const digitsRef = useRef<string>("");

  // An error (e.g. a wrong PIN reported by the caller) invalidates whatever
  // was entered — clear so the user re-enters from a blank pad.
  useEffect(() => {
    if (error) {
      digitsRef.current = "";
      setDigits("");
    }
  }, [error]);

  const handleKeyPress = useCallback(
    (padKey: PadKey) => {
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
    [onSubmit],
  );

  return (
    <View className={className} style={style}>
      <View
        style={{ flexDirection: "row", justifyContent: "center", gap: 16 }}
        accessibilityLabel={`PIN entry: ${digits.length} of ${PIN_LENGTH} digits entered`}
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
                borderColor: error ? colors.error : colors.border,
                backgroundColor: error
                  ? colors.error
                  : filled
                    ? colors.primary
                    : undefined,
              }}
            />
          );
        })}
      </View>
      <View style={{ marginTop: 32, gap: 12 }}>
        {KEY_ROWS.map((row, rowIndex) => (
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

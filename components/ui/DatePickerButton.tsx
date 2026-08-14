import React, { useState } from "react";
import { Platform, Pressable } from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";

import { useThemeTokens } from "@/lib/theme-provider";
import {
  formatDateInput,
  parseDateInput,
} from "@/lib/recurring-form-validation";

/**
 * SP-D14: every date field in the app was a free-text `YYYY-MM-DD` box, which
 * has a high error rate on a phone keyboard. This adds the platform picker
 * beside the existing input rather than replacing it — the text entry stays as
 * the fallback the ticket asks for, and each call site keeps its own layout,
 * validation and testIDs.
 */
export function DatePickerButton({
  value,
  onChange,
  accessibilityLabel,
  testID,
  minimumDate,
  maximumDate,
}: {
  /** Current field text, `YYYY-MM-DD`. Unparseable text falls back to today. */
  value: string;
  /** Receives the picked date already formatted as `YYYY-MM-DD`. */
  onChange: (formatted: string) => void;
  accessibilityLabel: string;
  testID?: string;
  minimumDate?: Date;
  maximumDate?: Date;
}) {
  const { colors } = useThemeTokens();
  const [open, setOpen] = useState(false);

  const handleChange = (event: DateTimePickerEvent, picked?: Date) => {
    // Android's dialog is one-shot: it closes itself, and "dismissed" must not
    // be written back as a value. iOS keeps the inline spinner mounted, so it
    // stays open until the field is blurred by the user tapping elsewhere.
    if (Platform.OS === "android") setOpen(false);
    if (event.type === "dismissed" || !picked) return;
    onChange(formatDateInput(picked));
    if (Platform.OS === "ios") setOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        hitSlop={8}
        // 44pt minimum, same floor the design system enforces on Button.
        style={{
          minWidth: 44,
          minHeight: 44,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="calendar-outline" size={20} color={colors.muted} />
      </Pressable>
      {open ? (
        <DateTimePicker
          value={parseDateInput(value) ?? new Date()}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={handleChange}
        />
      ) : null}
    </>
  );
}

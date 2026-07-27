import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui";
import { useColors } from "@/hooks/use-colors";
import { useCurrency } from "@/lib/currency-provider";
import { formatCurrency, getCurrencySymbol } from "@/lib/currency";
import { useExpense, useLoanDetail } from "@/lib/expense-context";
import {
  formatLoanCounterparty,
  parseLoanRouteId,
  parseMoneyAmount,
} from "@/lib/loan-detail";
import {
  formatDateInput,
  parseDateInput,
} from "@/lib/recurring-form-validation";
import {
  canSubmitRepayment,
  repaymentAmountError,
} from "@/lib/repayment-form-validation";
import {
  ContentMaxWidth,
  Radius,
  Spacing,
  Typography,
} from "@/lib/_core/theme";

const OPEN_DURATION = 250;
const CLOSE_DURATION = 220;
const SLIDE_DISTANCE = 700;
const SCRIM_COLOR = "rgba(0, 0, 0, 0.6)";

export default function RecordRepaymentScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const loanId = parseLoanRouteId(id);
  const { recordRepayment } = useExpense();
  const { loanDetail, loadingLoanDetail, refreshLoanDetail } =
    useLoanDetail(loanId);
  const { currency } = useCurrency();

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  // SP-036: this was fixed to today while being rendered under a "Date" label,
  // so a payment made last week could not be recorded accurately.
  const [dateInput, setDateInput] = useState(() => formatDateInput(new Date()));
  const parsedDate = parseDateInput(dateInput);
  const [saving, setSaving] = useState(false);
  const closingRef = useRef(false);

  const progress = useSharedValue(0);
  const reducedMotion = useReducedMotion();

  const goBack = useCallback(() => router.back(), [router]);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    Keyboard.dismiss();
    progress.value = reducedMotion
      ? 0
      : withTiming(0, { duration: CLOSE_DURATION }, (finished) => {
          if (finished) runOnJS(goBack)();
        });
  }, [progress, goBack, reducedMotion]);

  useEffect(() => {
    progress.value = reducedMotion
      ? 1
      : withTiming(1, { duration: OPEN_DURATION });
  }, [progress, reducedMotion]);

  const remainingBalance = loanDetail?.remainingBalance ?? "0.00";
  const amountError = repaymentAmountError(amount, remainingBalance);
  const isFormValid =
    canSubmitRepayment(amount, remainingBalance) && parsedDate != null;

  const handleSave = async () => {
    if (!loanDetail || !isFormValid || !parsedDate || saving) {
      return;
    }

    setSaving(true);
    try {
      await recordRepayment({
        loanId: loanDetail.id,
        amount: amount.trim(),
        date: parsedDate!,
        note: note.trim() || null,
      });
      await refreshLoanDetail();
      close();
    } catch {
      // toast handled in context
    } finally {
      setSaving(false);
    }
  };

  const panelMaxWidth = ContentMaxWidth.modal;
  const panelAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [SLIDE_DISTANCE, 0]) },
    ],
  }));

  const title = useMemo(
    () =>
      loanDetail
        ? `Record repayment — ${formatLoanCounterparty(loanDetail.counterparty)}`
        : "Record repayment",
    [loanDetail],
  );

  return (
    <View
      style={StyleSheet.absoluteFillObject}
      testID="record-repayment-screen"
    >
      <Pressable
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: SCRIM_COLOR },
        ]}
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        testID="record-repayment-backdrop"
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.panelWrapper}
      >
        <Animated.View style={panelAnimStyle} testID="record-repayment-panel">
          <View
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: Radius.lg,
              borderTopRightRadius: Radius.lg,
              paddingTop: Spacing.sm,
              paddingHorizontal: Spacing.lg,
              paddingBottom: Math.max(insets.bottom, Spacing.lg),
              maxHeight: screenHeight * 0.9,
              width: "100%",
              maxWidth:
                Platform.OS === "web"
                  ? Math.min(panelMaxWidth, screenWidth - 24)
                  : undefined,
              alignSelf: Platform.OS === "web" ? "center" : undefined,
            }}
          >
            <View style={styles.dragHandle} accessibilityElementsHidden>
              <View
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: colors.border,
                }}
              />
            </View>

            <View style={styles.header}>
              <Text
                className="text-foreground font-semibold flex-1 pr-2"
                style={{
                  fontSize: Typography.h3.fontSize,
                  lineHeight: Typography.h3.lineHeight,
                  fontWeight: Typography.h3.fontWeight,
                }}
                accessibilityRole="header"
              >
                Record repayment
              </Text>
              <Pressable
                onPress={close}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={8}
                style={styles.closeButton}
                testID="record-repayment-close"
              >
                <Ionicons name="close" size={24} color={colors.foreground} />
              </Pressable>
            </View>

            {loadingLoanDetail || !loanDetail ? (
              <View className="py-10 items-center">
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{
                  gap: Spacing.lg,
                  paddingBottom: Spacing.sm,
                }}
              >
                <Text className="text-sm text-muted" accessibilityLabel={title}>
                  Remaining balance:{" "}
                  <Text className="font-semibold text-foreground">
                    {formatCurrency(
                      parseMoneyAmount(remainingBalance),
                      currency,
                    )}
                  </Text>
                </Text>

                <View>
                  <Text
                    className="text-muted font-semibold mb-xs"
                    style={{ fontSize: Typography.label.fontSize }}
                  >
                    Amount
                  </Text>
                  <View
                    className="flex-row items-center rounded-xl px-4"
                    style={{
                      backgroundColor: colors.background,
                      borderWidth: 1,
                      borderColor: amountError ? colors.error : colors.border,
                      minHeight: 52,
                    }}
                  >
                    <Text className="text-lg text-muted mr-2">
                      {getCurrencySymbol(currency)}
                    </Text>
                    <TextInput
                      value={amount}
                      onChangeText={setAmount}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={colors.muted}
                      className="flex-1 text-lg text-foreground"
                      accessibilityLabel="Repayment amount"
                      testID="record-repayment-amount"
                    />
                  </View>
                  {amountError ? (
                    <Text
                      className="text-sm mt-1"
                      style={{ color: colors.error }}
                      testID="record-repayment-amount-error"
                    >
                      {amountError}
                    </Text>
                  ) : null}
                </View>

                <View>
                  <Text
                    className="text-muted font-semibold mb-xs"
                    style={{ fontSize: Typography.label.fontSize }}
                  >
                    Date
                  </Text>
                  <TextInput
                    value={dateInput}
                    onChangeText={setDateInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="none"
                    className="rounded-xl px-4 py-3 text-base text-foreground"
                    style={{
                      backgroundColor: colors.background,
                      borderWidth: 1,
                      borderColor: parsedDate ? colors.border : colors.error,
                      minHeight: 52,
                    }}
                    accessibilityLabel="Repayment date"
                    testID="record-repayment-date"
                  />
                  {!parsedDate ? (
                    <Text
                      className="text-sm mt-1"
                      style={{ color: colors.error }}
                    >
                      Use YYYY-MM-DD
                    </Text>
                  ) : null}
                </View>

                <View>
                  <Text
                    className="text-muted font-semibold mb-xs"
                    style={{ fontSize: Typography.label.fontSize }}
                  >
                    Note (optional)
                  </Text>
                  <TextInput
                    value={note}
                    onChangeText={setNote}
                    placeholder="e.g., June installment"
                    placeholderTextColor={colors.muted}
                    className="rounded-xl px-4 py-3 text-base text-foreground"
                    style={{
                      backgroundColor: colors.background,
                      borderWidth: 1,
                      borderColor: colors.border,
                      minHeight: 52,
                    }}
                    accessibilityLabel="Repayment note"
                    testID="record-repayment-note"
                  />
                </View>

                <View className="flex-row gap-3 pt-2">
                  <Button
                    variant="secondary"
                    label="Cancel"
                    onPress={close}
                    className="flex-1"
                    size="lg"
                  />
                  <Button
                    variant="primary"
                    label={saving ? "Saving…" : "Save"}
                    onPress={handleSave}
                    disabled={!isFormValid || saving}
                    className="flex-1"
                    size="lg"
                    testID="record-repayment-save"
                  />
                </View>
              </ScrollView>
            )}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  panelWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  dragHandle: {
    alignItems: "center",
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  closeButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});

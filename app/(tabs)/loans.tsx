import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  RefreshControl,
  ScrollView,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  FlatList,
  TextInput,
  Platform,
  type ViewStyle,
} from "react-native";
import { ResponsiveContent } from "@/components/responsive-content";
import { ScreenContainer } from "@/components/screen-container";
import { useExpense, type Loan } from "@/lib/expense-context";
import { useColors } from "@/hooks/use-colors";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useNavigation } from "expo-router";
import { Animated, FadeInUp } from "@/lib/motion";
import {
  Button,
  DatePickerButton,
  EmptyState,
  ScreenHeader,
  Sheet,
} from "@/components/ui";
import { useToast } from "@/components/ui/ToastProvider";
import { ContentMaxWidth } from "@/lib/_core/theme";
import { TAB_BAR_CLEARANCE } from "@/lib/_core/theme";
import { useCurrency } from "@/lib/currency-provider";
import { formatCurrency, getCurrencySymbol } from "@/lib/currency";
import {
  createDefaultLoanForm,
  getLoanFormErrors,
  isLoanFormValid,
  type LoanFormValues,
  type LoanPeriodicity,
  type LoanScheduleMode,
} from "@/lib/loan-form-validation";
import { parseDateInput } from "@/lib/recurring-form-validation";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";

const LOAN_DIRECTIONS = ["lend", "borrow"] as const;
const LOAN_PERIODICITIES: LoanPeriodicity[] = [
  "weekly",
  "monthly",
  "yearly",
  "none",
];
const SCHEDULE_MODES: LoanScheduleMode[] = ["count", "endDate"];

function normalizeMoneyInput(value: string): string {
  const trimmed = value.trim();
  if (trimmed.endsWith(".")) {
    return trimmed.slice(0, -1);
  }
  return trimmed;
}

function LoanFormFields({
  values,
  onChange,
}: {
  values: LoanFormValues;
  onChange: (patch: Partial<LoanFormValues>) => void;
}) {
  const colors = useColors();
  const { currency } = useCurrency();

  return (
    <>
      <View>
        <Text className="text-sm font-semibold text-foreground mb-2">
          Direction
        </Text>
        <View className="flex-row gap-3">
          {LOAN_DIRECTIONS.map((direction) => (
            <Pressable
              key={direction}
              onPress={() => onChange({ direction })}
              className="flex-1 py-3 rounded-xl items-center capitalize"
              style={{
                // SP-096: className padding is inert on Pressable — size in style.
                paddingVertical: 12,
                minHeight: 44,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor:
                  values.direction === direction
                    ? colors.primary
                    : colors.background,
                borderWidth: values.direction === direction ? 0 : 0.5,
                borderColor: colors.border,
              }}
              accessibilityRole="button"
              accessibilityLabel={`${direction} direction`}
              accessibilityState={{ selected: values.direction === direction }}
            >
              <Text
                className="font-semibold capitalize"
                style={{
                  color:
                    values.direction === direction
                      ? "white"
                      : colors.foreground,
                }}
              >
                {direction}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View>
        <Text className="text-sm font-semibold text-foreground mb-2">
          Counterparty (optional)
        </Text>
        <View
          className="px-4 py-3.5 rounded-xl"
          style={{
            backgroundColor: colors.background,
            borderWidth: 0.5,
            borderColor: colors.border,
          }}
        >
          <TextInput
            placeholder="Who is this with?"
            placeholderTextColor={colors.muted}
            value={values.counterparty}
            onChangeText={(counterparty) => onChange({ counterparty })}
            className="text-foreground"
            style={{ fontSize: 15 }}
            accessibilityLabel="Counterparty"
          />
        </View>
      </View>

      <View>
        <Text className="text-sm font-semibold text-foreground mb-2">
          Principal
        </Text>
        <View
          className="px-4 py-3.5 rounded-xl flex-row items-center"
          style={{
            backgroundColor: colors.background,
            borderWidth: 0.5,
            borderColor: colors.border,
          }}
        >
          {/* SP-029: was a hard-coded "$" while the list formatted with the
           * user's currency. */}
          <Text className="text-foreground mr-2 font-semibold">
            {getCurrencySymbol(currency)}
          </Text>
          <TextInput
            placeholder="250.00"
            placeholderTextColor={colors.muted}
            value={values.principal}
            onChangeText={(principal) => onChange({ principal })}
            onBlur={() =>
              onChange({ principal: normalizeMoneyInput(values.principal) })
            }
            className="flex-1 text-foreground"
            keyboardType="decimal-pad"
            style={{ fontSize: 15 }}
            accessibilityLabel="Principal amount"
          />
        </View>
      </View>

      <View>
        <Text className="text-sm font-semibold text-foreground mb-2">
          Rate % (optional)
        </Text>
        <View
          className="px-4 py-3.5 rounded-xl flex-row items-center"
          style={{
            backgroundColor: colors.background,
            borderWidth: 0.5,
            borderColor: colors.border,
          }}
        >
          <TextInput
            placeholder="0"
            placeholderTextColor={colors.muted}
            value={values.rate}
            onChangeText={(rate) => onChange({ rate })}
            onBlur={() => onChange({ rate: normalizeMoneyInput(values.rate) })}
            className="flex-1 text-foreground"
            keyboardType="decimal-pad"
            style={{
              // SP-097: without `minWidth: 0` a flex <input> refuses to shrink below
              // its intrinsic width, overflowing the row and horizontally scrolling
              // the sheet — which clipped the first character off every label.
              minWidth: 0,
              fontSize: 15,
            }}
            accessibilityLabel="Interest rate"
          />
        </View>
      </View>

      <View>
        <Text className="text-sm font-semibold text-foreground mb-2">
          Schedule
        </Text>
        <View className="flex-row flex-wrap gap-2 mb-3">
          {LOAN_PERIODICITIES.map((periodicity) => (
            <Pressable
              key={periodicity}
              onPress={() => onChange({ periodicity })}
              className="px-4 py-2.5 rounded-xl capitalize"
              style={{
                // SP-096: className padding is inert on Pressable — size in style.
                paddingHorizontal: 16,
                paddingVertical: 10,
                minHeight: 44,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor:
                  values.periodicity === periodicity
                    ? colors.primary
                    : colors.background,
                borderWidth: values.periodicity === periodicity ? 0 : 0.5,
                borderColor: colors.border,
              }}
              accessibilityRole="button"
              accessibilityLabel={`${periodicity} periodicity`}
              accessibilityState={{
                selected: values.periodicity === periodicity,
              }}
            >
              <Text
                className="font-semibold capitalize"
                style={{
                  color:
                    values.periodicity === periodicity
                      ? "white"
                      : colors.foreground,
                }}
              >
                {periodicity}
              </Text>
            </Pressable>
          ))}
        </View>

        {values.periodicity && values.periodicity !== "none" ? (
          <>
            <View className="flex-row gap-3 mb-3">
              {SCHEDULE_MODES.map((mode) => (
                <Pressable
                  key={mode}
                  onPress={() => onChange({ scheduleMode: mode })}
                  className="flex-1 py-2.5 rounded-xl items-center"
                  style={{
                    // SP-096: className padding is inert on Pressable — size in style.
                    paddingVertical: 10,
                    minHeight: 44,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor:
                      values.scheduleMode === mode
                        ? colors.primary
                        : colors.background,
                    borderWidth: values.scheduleMode === mode ? 0 : 0.5,
                    borderColor: colors.border,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={
                    mode === "count" ? "Installment count" : "End date"
                  }
                  accessibilityState={{
                    selected: values.scheduleMode === mode,
                  }}
                >
                  <Text
                    className="font-semibold text-sm"
                    style={{
                      color:
                        values.scheduleMode === mode
                          ? "white"
                          : colors.foreground,
                    }}
                  >
                    {mode === "count" ? "# installments" : "End date"}
                  </Text>
                </Pressable>
              ))}
            </View>

            {values.scheduleMode === "count" ? (
              <View
                className="px-4 py-3.5 rounded-xl"
                style={{
                  backgroundColor: colors.background,
                  borderWidth: 0.5,
                  borderColor: colors.border,
                }}
              >
                <TextInput
                  placeholder="12"
                  placeholderTextColor={colors.muted}
                  value={values.installmentCount}
                  onChangeText={(installmentCount) =>
                    onChange({ installmentCount })
                  }
                  className="text-foreground"
                  keyboardType="number-pad"
                  style={{ fontSize: 15 }}
                  accessibilityLabel="Installment count"
                />
              </View>
            ) : (
              <View
                className="px-4 py-3.5 rounded-xl flex-row items-center"
                style={{
                  backgroundColor: colors.background,
                  borderWidth: 0.5,
                  borderColor: colors.border,
                }}
              >
                <TextInput
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.muted}
                  value={values.endDate}
                  onChangeText={(endDate) => onChange({ endDate })}
                  className="text-foreground flex-1"
                  style={{ fontSize: 15 }}
                  accessibilityLabel="Schedule end date"
                />
                <DatePickerButton
                  value={values.endDate}
                  onChange={(endDate) => onChange({ endDate })}
                  accessibilityLabel="Pick schedule end date"
                />
              </View>
            )}
          </>
        ) : null}
      </View>

      <View>
        <Text className="text-sm font-semibold text-foreground mb-2">
          Next due date
        </Text>
        <View
          className="px-4 py-3.5 rounded-xl flex-row items-center"
          style={{
            backgroundColor: colors.background,
            borderWidth: 0.5,
            borderColor: colors.border,
          }}
        >
          <TextInput
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.muted}
            value={values.nextDueDate}
            onChangeText={(nextDueDate) => onChange({ nextDueDate })}
            className="text-foreground flex-1"
            style={{ fontSize: 15 }}
            accessibilityLabel="Next due date"
          />
          <DatePickerButton
            value={values.nextDueDate}
            onChange={(nextDueDate) => onChange({ nextDueDate })}
            accessibilityLabel="Pick next due date"
          />
        </View>
      </View>
    </>
  );
}

function LoanListItem({ loan, index }: { loan: Loan; index: number }) {
  const router = useRouter();
  const colors = useColors();
  const { currency } = useCurrency();
  // SP-054: "No counterparty" was used as a display name, so several such
  // loans produced a list of identical rows.
  const label =
    loan.counterparty?.trim() ||
    `${loan.direction === "lend" ? "Lent" : "Borrowed"} · ${new Date(
      loan.createdAt,
    ).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
  // SP-053: this showed the original principal, so a loan 90% repaid still
  // displayed its full amount and the list could not be scanned for what is
  // actually outstanding.
  const amount = formatCurrency(Number(loan.principal), currency);

  return (
    <Pressable
      testID={`loan-item-${index}`}
      onPress={() => router.push(`/loan/${loan.id}`)}
      className="rounded-2xl p-4 mb-3"
      style={{
        backgroundColor: colors.surface,
        borderWidth: 0.5,
        borderColor: colors.border,
      }}
      accessibilityRole="button"
      accessibilityLabel={`${loan.direction} loan to ${label}, principal ${amount}`}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View
            className="px-2.5 py-1 rounded-full capitalize"
            style={{
              backgroundColor:
                loan.direction === "lend" ? colors.success : colors.warning,
            }}
          >
            <Text className="text-xs font-bold text-white capitalize">
              {loan.direction}
            </Text>
          </View>
          <Text
            className="text-base font-semibold text-foreground"
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
        <Text className="text-base font-bold text-foreground">{amount}</Text>
      </View>
    </Pressable>
  );
}

export default function LoansScreen() {
  const colors = useColors();
  const navigation = useNavigation();
  const { loans, loadingLoans, addLoan, refreshLoans } = useExpense();
  const toast = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [formValues, setFormValues] = useState<LoanFormValues>(() =>
    createDefaultLoanForm(),
  );
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      tabBarStyle: sheetOpen ? { display: "none" } : undefined,
    });
  }, [navigation, sheetOpen]);

  const onRefresh = useCallback(async () => {
    await refreshLoans();
  }, [refreshLoans]);
  const refreshProps = usePullToRefresh(onRefresh);

  const desktopActionStyle: ViewStyle | undefined =
    Platform.OS === "web" ? { alignSelf: "flex-start" } : undefined;

  const formValid = useMemo(
    () => isLoanFormValid(formValues, "create"),
    [formValues],
  );

  const formErrors = useMemo(
    () => getLoanFormErrors(formValues, "create"),
    [formValues],
  );

  const openSheet = useCallback(() => {
    setFormValues(createDefaultLoanForm());
    setSheetOpen(true);
  }, []);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    setFormValues(createDefaultLoanForm());
  }, []);

  const handleSave = async () => {
    if (savingRef.current) return;
    if (!isLoanFormValid(formValues, "create")) {
      toast.show({
        type: "error",
        message: "Please fill in all required fields correctly",
      });
      return;
    }

    const nextDueDate = parseDateInput(formValues.nextDueDate);
    if (!nextDueDate) return;

    const installmentCount =
      formValues.periodicity !== "none" &&
      formValues.scheduleMode === "count" &&
      formValues.installmentCount.trim()
        ? parseInt(formValues.installmentCount.trim(), 10)
        : null;

    const endDate =
      formValues.periodicity !== "none" &&
      formValues.scheduleMode === "endDate" &&
      formValues.endDate.trim()
        ? parseDateInput(formValues.endDate)
        : null;

    savingRef.current = true;
    setSaving(true);
    try {
      await addLoan({
        direction: formValues.direction as "lend" | "borrow",
        counterparty: formValues.counterparty.trim() || null,
        principal: formValues.principal.trim(),
        rate: formValues.rate.trim() || null,
        periodicity: formValues.periodicity as LoanPeriodicity,
        installmentCount,
        endDate,
        nextDueDate,
      });
      closeSheet();
    } catch {
      // addLoan rolled back + showed error toast; keep sheet open
      return;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <ScreenContainer className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
        refreshControl={<RefreshControl {...refreshProps} />}
      >
        <ResponsiveContent maxWidth={ContentMaxWidth.screen}>
          <ScreenHeader
            title="Loans"
            subtitle={`${loans.length} loan${loans.length !== 1 ? "s" : ""}`}
            accessibilityLabel="Loans screen"
          />

          <Animated.View
            entering={FadeInUp.delay(100).duration(500)}
            className="px-6 mt-5"
          >
            <Button
              variant="primary"
              label="New loan"
              leftIcon={<Ionicons name="add" size={18} color="white" />}
              onPress={openSheet}
              style={desktopActionStyle}
              size="lg"
              testID="new-loan-button"
            />
          </Animated.View>

          <View className="px-6 mt-6">
            {loadingLoans ? (
              <View className="items-center justify-center py-20">
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : loans.length > 0 ? (
              <Animated.View entering={FadeInUp.delay(150).duration(500)}>
                <FlatList
                  data={loans}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={({ item, index }) => (
                    <LoanListItem loan={item} index={index} />
                  )}
                  scrollEnabled={false}
                />
              </Animated.View>
            ) : (
              <Animated.View
                entering={FadeInUp.delay(150).duration(500)}
                className="rounded-3xl overflow-hidden"
                style={{ backgroundColor: colors.surface }}
              >
                <EmptyState
                  variant="no-data"
                  icon={
                    <Ionicons
                      name="cash-outline"
                      size={28}
                      color={colors.muted}
                    />
                  }
                  title="No loans yet"
                  description="Record a loan you gave or took to start tracking repayments"
                  action={{ label: "New loan", onPress: openSheet }}
                />
              </Animated.View>
            )}
          </View>
        </ResponsiveContent>
      </ScrollView>

      <Sheet
        visible={sheetOpen}
        onClose={closeSheet}
        title="New loan"
        testID="new-loan-sheet"
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ flexShrink: 1 }}
          contentContainerStyle={{ gap: 16, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <LoanFormFields
            values={formValues}
            onChange={(patch) =>
              setFormValues((prev) => ({ ...prev, ...patch }))
            }
          />

          {!formValid && formErrors.length > 0 ? (
            <View
              className="rounded-xl px-4 py-3"
              style={{
                backgroundColor: colors.error + "14",
                borderWidth: 0.5,
                borderColor: colors.error + "40",
              }}
              accessibilityRole="text"
              accessibilityLabel={formErrors.map((e) => e.message).join(". ")}
              testID="loan-form-errors"
            >
              {formErrors.map((error) => (
                <Text
                  key={error.field}
                  className="text-sm"
                  style={{ color: colors.error }}
                >
                  {error.message}
                </Text>
              ))}
            </View>
          ) : null}

          <View className="flex-row gap-3 mt-2">
            <Button
              variant="secondary"
              label="Cancel"
              onPress={closeSheet}
              className="flex-1"
              size="lg"
            />
            <Button
              variant="primary"
              label="Save"
              onPress={handleSave}
              disabled={!formValid}
              loading={saving}
              className="flex-1"
              size="lg"
              testID="save-loan-button"
            />
          </View>
        </ScrollView>
      </Sheet>
    </ScreenContainer>
  );
}

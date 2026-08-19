import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  Keyboard,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useReducedMotion } from "react-native-reanimated";

import { useExpense } from "@/lib/expense-context";
import { useThemeTokens } from "@/lib/theme-provider";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  Button,
  CategoryPickerGrid,
  DatePickerButton,
  EmptyState,
  Pill,
  Sheet,
} from "@/components/ui";
import { useToast } from "@/components/ui/ToastProvider";
import { useCurrency } from "@/lib/currency-provider";
import { getCurrencySymbol } from "@/lib/currency";
import { Motion, Radius, Spacing, Typography } from "@/lib/_core/theme";
import { MAX_FONT_SCALE } from "@/lib/_core/a11y";
import { resolveCategoryColor } from "@/constants/theme";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import {
  formatDateInput,
  parseDateInput,
} from "@/lib/recurring-form-validation";
import {
  MAX_MONEY_MESSAGE,
  MONEY_PATTERN,
  isWithinMoneyRange,
  sanitizeAmountInput,
} from "@shared/money";
import type { Id } from "@/drizzle/schema";

const MIN_TOUCH_TARGET = 44;

export default function AddTransactionScreen() {
  const router = useRouter();
  // Same active-theme token source the redesigned Sheet/surfaces read —
  // never the theme-agnostic useColors() (frozen to the default theme; AC3).
  const { colors, themeId } = useThemeTokens();
  const { type: queryType } = useLocalSearchParams();
  const scheme = (useColorScheme() ?? "light") as "light" | "dark";
  const {
    categories,
    accounts,
    creditCards,
    transactions,
    addTransaction,
    refreshCategories,
    refreshCreditCards,
    refreshAccounts,
  } = useExpense();
  const toast = useToast();
  const { currency } = useCurrency();
  const reducedMotion = useReducedMotion();

  const [type, setType] = useState<"income" | "expense">(
    (queryType as "income" | "expense") || "expense",
  );
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Id | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Id | null>(null);
  // SP-010: cards could be created but never attached to a transaction, so the
  // whole Cards module produced no data.
  const [selectedCard, setSelectedCard] = useState<Id | null>(null);
  // SP-008: this was `useState(new Date())` with no setter and no field, so
  // every entry was stamped at the moment of saving — yesterday's coffee could
  // not be recorded, and a mis-entered date could not be corrected.
  const [dateInput, setDateInput] = useState(() => formatDateInput(new Date()));
  const parsedDate = parseDateInput(dateInput);
  // Sheet owns its own open/close animation as long as it stays mounted in
  // the tree — this route's own `visible` just tells Sheet when to start
  // its close animation, mirroring how ConfirmSheet/RecurringTransactionSheet
  // drive it from local state.
  const [visible, setVisible] = useState(true);
  const closingRef = useRef(false);
  // A `saving` useState guard alone can't stop a rapid double-press: two
  // onPress calls in the same event tick both read the pre-render `saving`
  // value before React applies the update. `savingRef` is set synchronously
  // so the second call sees it immediately; `saving` state still drives the
  // Button's disabled/loading UI.
  const savingRef = useRef(false);

  const goBack = useCallback(() => router.back(), [router]);

  const onRefresh = useCallback(async () => {
    await Promise.all([
      refreshCategories(),
      refreshCreditCards(),
      refreshAccounts(),
    ]);
  }, [refreshCategories, refreshCreditCards, refreshAccounts]);
  const refreshProps = usePullToRefresh(onRefresh);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    Keyboard.dismiss();
    setVisible(false);
  }, []);

  // Pop the route once the Sheet's own close animation has had time to
  // play — Sheet's onClose fires the moment a close is requested, not after
  // its slide-out finishes, so this route (not Sheet) owns the "wait, then
  // navigate back" timing. Driven by the same Motion.sheet duration Sheet
  // itself animates with, so the route never pops mid-slide.
  useEffect(() => {
    if (visible || !closingRef.current) return;
    if (reducedMotion) {
      goBack();
      return;
    }
    const timer = setTimeout(goBack, Motion.sheet.durationMs);
    return () => clearTimeout(timer);
  }, [visible, reducedMotion, goBack]);

  const handleSave = async () => {
    if (savingRef.current) return;
    setCategoryError(selectedCategory == null ? "Select a category" : null);
    if (!isFormValid || !selectedCategory || !parsedDate) {
      toast.show({
        type: "error",
        message:
          amountError ?? dateError ?? "Please fill in all required fields",
      });
      return;
    }
    // SP-046: the success toast fired before the mutation resolved and a
    // failure rejected unhandled out of onPress. Every other save handler in
    // the app already wraps this.
    savingRef.current = true;
    setSaving(true);
    try {
      await addTransaction({
        categoryId: selectedCategory,
        type,
        amount: amount.trim(),
        description: description || undefined,
        date: parsedDate,
        accountId: selectedAccount ?? undefined,
        creditCardId: selectedCard ?? undefined,
      });
    } catch {
      // expense-context rolled back and showed the error toast; keep the sheet
      // open so the entry is not lost.
      return;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
    // No success toast here: expense-context's addTransaction already shows
    // one ("Transaction added") on the same path it shows the error toast
    // this screen defers to above. Both firing stacked two confirmations for
    // one save.
    close();
  };

  // AC4: a screen-reader user pressing Save with no category must hear why —
  // accessibilityLiveRegion covers Android; iOS needs an explicit announcement
  // (same pattern as Toast.tsx).
  useEffect(() => {
    if (categoryError && Platform.OS === "ios") {
      AccessibilityInfo.announceForAccessibility(categoryError);
    }
  }, [categoryError]);

  const filteredCategories = categories.filter((c) => c.type === type);
  const activeCards = useMemo(
    () => creditCards.filter((card) => card.isActive),
    [creditCards],
  );

  // SP-041: `!!amount` accepted "0" and "0.00".
  // SP-D18: the regex had no upper bound, so a 15-digit amount passed on its
  // way to a `decimal(12,2)` column. Bound shared with the server schema.
  const amountError =
    amount.trim().length === 0
      ? null
      : !MONEY_PATTERN.test(amount.trim())
        ? "Enter an amount like 12.50"
        : Number(amount) <= 0
          ? "Amount must be greater than zero"
          : !isWithinMoneyRange(amount.trim())
            ? MAX_MONEY_MESSAGE
            : null;
  const dateError = dateInput.trim() && !parsedDate ? "Use YYYY-MM-DD" : null;
  const isFormValid =
    !!amount.trim() && !amountError && !!selectedCategory && !!parsedDate;

  // Map filtered categories to CategoryPickerGrid items with resolved colors.
  const pickerCategories = useMemo(
    () =>
      filteredCategories.map((cat) => ({
        ...cat,
        color: resolveCategoryColor(cat.color, scheme, themeId),
      })),
    [filteredCategories, scheme, themeId],
  );

  return (
    // noModal: this route is already mounted via a transparentModal Stack
    // screen (app/_layout.tsx), which is guaranteed to cover the tabs layer
    // on Android — a nested RN <Modal> here would double up and is unreliable
    // over elevated views (elevation:8 cards) on that layer.
    <Sheet
      visible={visible}
      onClose={close}
      title="Add Transaction"
      noModal
      testID="add-transaction"
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl {...refreshProps} />}
        contentContainerStyle={{
          gap: Spacing.lg,
          paddingBottom: Spacing.sm,
        }}
      >
        {/* Transaction Type */}
        <View>
          <Text
            className="text-muted font-semibold mb-xs"
            style={{ fontSize: Typography.label.fontSize }}
          >
            Transaction Type
          </Text>
          <View className="flex-row gap-md">
            <Pill
              label="Expense"
              selected={type === "expense"}
              onPress={() => {
                setType("expense");
                setSelectedCategory(null);
                setCategoryError(null);
              }}
              leftIcon={
                <Ionicons
                  name="arrow-up"
                  size={16}
                  color={type === "expense" ? colors.surface : colors.muted}
                />
              }
              style={{ flex: 1 }}
            />
            <Pill
              label="Income"
              selected={type === "income"}
              onPress={() => {
                setType("income");
                setSelectedCategory(null);
                setCategoryError(null);
              }}
              leftIcon={
                <Ionicons
                  name="arrow-down"
                  size={16}
                  color={type === "income" ? colors.surface : colors.muted}
                />
              }
              style={{ flex: 1 }}
            />
          </View>
        </View>

        {/* Amount */}
        <View>
          <Text
            className="text-muted font-semibold mb-xs"
            style={{ fontSize: Typography.label.fontSize }}
          >
            Amount
          </Text>
          <View
            className="flex-row items-center rounded-md px-lg py-md"
            style={{
              backgroundColor: colors.surface,
              borderWidth: 0.5,
              borderColor: colors.border,
            }}
          >
            <Text
              className="text-foreground font-bold mr-sm"
              style={{ fontSize: Typography.h2.fontSize }}
            >
              {getCurrencySymbol(currency)}
            </Text>
            <TextInput
              autoFocus
              accessibilityLabel="Amount"
              testID="add-transaction-amount"
              placeholder="0.00"
              placeholderTextColor={colors.muted}
              value={amount}
              // SP-076: `keyboardType`/`inputMode` is only a keyboard *hint* —
              // on web (and with a hardware keyboard) letters and symbols typed
              // straight in, and nothing said so until Save. Drop anything that
              // is not part of a money amount as it is entered.
              onChangeText={(next) => setAmount(sanitizeAmountInput(next))}
              keyboardType="decimal-pad"
              className="flex-1 text-foreground"
              style={{
                // SP-097: without `minWidth: 0` a flex <input> refuses to shrink below
                // its intrinsic width, overflowing the row and horizontally scrolling
                // the sheet — which clipped the first character off every label.
                minWidth: 0,
                fontSize: Typography.h2.fontSize,
                fontWeight: "700",
              }}
              maxFontSizeMultiplier={MAX_FONT_SCALE}
            />
          </View>
          {amountError ? (
            <Text
              className="mt-xs"
              style={{
                color: colors.error,
                fontSize: Typography.caption.fontSize,
              }}
              testID="add-transaction-amount-error"
            >
              {amountError}
            </Text>
          ) : null}
        </View>

        {/* Category */}
        <View>
          <Text
            className="text-muted font-semibold mb-xs"
            style={{ fontSize: Typography.label.fontSize }}
          >
            Category (Required)
          </Text>
          {pickerCategories.length > 0 ? (
            <CategoryPickerGrid
              categories={pickerCategories}
              selectedId={selectedCategory}
              onSelect={(id) => {
                setSelectedCategory(id);
                setCategoryError(null);
              }}
              transactions={transactions}
              recentLimit={5}
            />
          ) : (
            <EmptyState
              icon={
                <Ionicons name="grid-outline" size={24} color={colors.muted} />
              }
              title={`No ${type} categories`}
              description="Add categories in the Categories tab."
            />
          )}
          {categoryError ? (
            <Text
              accessible
              accessibilityLiveRegion="polite"
              className="mt-xs"
              style={{
                color: colors.error,
                fontSize: Typography.caption.fontSize,
              }}
              testID="add-transaction-category-error"
            >
              {categoryError}
            </Text>
          ) : null}
        </View>

        {/* Account — only shown when the user has accounts to choose from. */}
        {accounts.length > 0 ? (
          <View>
            <Text
              className="text-muted font-semibold mb-xs"
              style={{ fontSize: Typography.label.fontSize }}
            >
              Account (Optional)
            </Text>
            <View style={styles.accountOptions}>
              <Pressable
                onPress={() => setSelectedAccount(null)}
                accessibilityRole="radio"
                accessibilityLabel="Account No account"
                accessibilityState={{
                  selected: selectedAccount === null,
                }}
                style={[
                  styles.accountOption,
                  {
                    borderColor:
                      selectedAccount === null ? colors.primary : colors.border,
                    backgroundColor:
                      selectedAccount === null
                        ? colors.primary + "12"
                        : colors.surface,
                  },
                ]}
              >
                <Text className="text-foreground font-medium">No account</Text>
                {selectedAccount === null ? (
                  <Ionicons name="checkmark" size={18} color={colors.primary} />
                ) : null}
              </Pressable>
              {accounts.map((account) => {
                const selected = selectedAccount === account.id;
                return (
                  <Pressable
                    key={account.id}
                    onPress={() => setSelectedAccount(account.id)}
                    accessibilityRole="radio"
                    accessibilityLabel={`Account ${account.name}, ${account.currency}`}
                    accessibilityState={{ selected }}
                    style={[
                      styles.accountOption,
                      {
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected
                          ? colors.primary + "12"
                          : colors.surface,
                      },
                    ]}
                  >
                    <View>
                      <Text className="text-foreground font-medium">
                        {account.name}
                      </Text>
                      <Text className="text-muted text-sm">
                        {account.currency}
                      </Text>
                    </View>
                    {selected ? (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={colors.primary}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Date */}
        <View>
          <Text
            className="text-muted font-semibold mb-xs"
            style={{ fontSize: Typography.label.fontSize }}
          >
            Date
          </Text>
          <View
            className="rounded-md px-lg py-md flex-row items-center"
            style={{
              backgroundColor: colors.surface,
              borderWidth: 0.5,
              borderColor: dateError ? colors.error : colors.border,
            }}
          >
            <TextInput
              value={dateInput}
              onChangeText={setDateInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              className="text-foreground flex-1"
              style={{ fontSize: Typography.body.fontSize }}
              accessibilityLabel="Transaction date"
              testID="add-transaction-date"
            />
            <DatePickerButton
              value={dateInput}
              onChange={setDateInput}
              accessibilityLabel="Pick transaction date"
              testID="add-transaction-date-picker"
            />
          </View>
          {dateError ? (
            <Text
              className="mt-xs"
              style={{
                color: colors.error,
                fontSize: Typography.caption.fontSize,
              }}
            >
              {dateError}
            </Text>
          ) : null}
        </View>

        {/* Card — expenses only; income is not charged to a card. */}
        {type === "expense" && activeCards.length > 0 ? (
          <View>
            <Text
              className="text-muted font-semibold mb-xs"
              style={{ fontSize: Typography.label.fontSize }}
            >
              Card (Optional)
            </Text>
            <View className="flex-row flex-wrap gap-sm">
              <Pill
                label="None"
                selected={selectedCard == null}
                onPress={() => setSelectedCard(null)}
              />
              {activeCards.map((card) => (
                <Pill
                  key={card.id}
                  label={card.name}
                  selected={selectedCard === card.id}
                  onPress={() => setSelectedCard(card.id)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {/* Note */}
        <View>
          <Text
            className="text-muted font-semibold mb-xs"
            style={{ fontSize: Typography.label.fontSize }}
          >
            Note (Optional)
          </Text>
          <View
            className="rounded-md px-lg py-md"
            style={{
              backgroundColor: colors.surface,
              borderWidth: 0.5,
              borderColor: colors.border,
              minHeight: 72,
            }}
          >
            <TextInput
              placeholder="Add a note…"
              placeholderTextColor={colors.muted}
              value={description}
              onChangeText={setDescription}
              className="text-foreground"
              style={{ fontSize: Typography.body.fontSize }}
              multiline
              textAlignVertical="top"
              accessibilityLabel="Note"
              testID="add-transaction-note"
            />
          </View>
        </View>
      </ScrollView>

      {/* ── Action buttons ───────────────────────────────────────────── */}
      <View className="flex-row gap-md mt-lg">
        <Button
          variant="secondary"
          label="Cancel"
          onPress={close}
          className="flex-1"
          size="lg"
        />
        <Button
          variant="primary"
          label="Save"
          onPress={handleSave}
          disabled={saving}
          loading={saving}
          className="flex-1"
          size="lg"
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  accountOptions: {
    gap: Spacing.sm,
  },
  accountOption: {
    minHeight: MIN_TOUCH_TARGET,
    borderWidth: 0.5,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});

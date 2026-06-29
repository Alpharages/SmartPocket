import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
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

import { useExpense } from "@/lib/expense-context";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Button, CategoryPickerGrid, EmptyState, Pill } from "@/components/ui";
import { useToast } from "@/components/ui/ToastProvider";
import { useCurrency } from "@/lib/currency-provider";
import { getCurrencySymbol } from "@/lib/currency";
import {
  ContentMaxWidth,
  Radius,
  Spacing,
  Typography,
} from "@/lib/_core/theme";
import { resolveCategoryColor } from "@/constants/theme";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";

const OPEN_DURATION = 250;
const CLOSE_DURATION = 220;
// How far the panel slides in from below — larger than any screen height.
const SLIDE_DISTANCE = 700;

const MIN_TOUCH_TARGET = 44;

// Static scrim. Matches the theme `overlay` token (#000000) at 60% — a fixed
// color so the dim never depends on a Reanimated worklet running.
const SCRIM_COLOR = "rgba(0, 0, 0, 0.6)";

export default function AddTransactionScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const { type: queryType } = useLocalSearchParams();
  const scheme = (useColorScheme() ?? "light") as "light" | "dark";
  const {
    categories,
    accounts,
    transactions,
    addTransaction,
    refreshCategories,
    refreshCreditCards,
    refreshAccounts,
  } = useExpense();
  const toast = useToast();
  const { currency } = useCurrency();

  const [type, setType] = useState<"income" | "expense">(
    (queryType as "income" | "expense") || "expense",
  );
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<number | null>(null);
  const [date] = useState(new Date());
  const closingRef = useRef(false);

  // Single 0→1 progress drives both backdrop opacity and panel translateY.
  const progress = useSharedValue(0);
  const reducedMotion = useReducedMotion();

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
    progress.value = reducedMotion
      ? 0
      : withTiming(0, { duration: CLOSE_DURATION }, (finished) => {
          if (finished) runOnJS(goBack)();
        });
  }, [progress, goBack, reducedMotion]);

  // Animate open on mount.
  useEffect(() => {
    progress.value = reducedMotion
      ? 1
      : withTiming(1, { duration: OPEN_DURATION });
  }, [progress, reducedMotion]);

  const handleSave = async () => {
    if (!amount || !selectedCategory) {
      toast.show({
        type: "error",
        message: "Please fill in all required fields",
      });
      return;
    }
    await addTransaction({
      categoryId: selectedCategory,
      type,
      amount,
      description: description || undefined,
      date,
      accountId: selectedAccount ?? undefined,
    });
    close();
  };

  const filteredCategories = categories.filter((c) => c.type === type);
  const isFormValid = !!amount && !!selectedCategory;
  const panelMaxWidth = ContentMaxWidth.modal;

  // Map filtered categories to CategoryPickerGrid items with resolved colors.
  const pickerCategories = useMemo(
    () =>
      filteredCategories.map((cat) => ({
        ...cat,
        color: resolveCategoryColor(cat.color, scheme),
      })),
    [filteredCategories, scheme],
  );

  const panelAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [SLIDE_DISTANCE, 0]) },
    ],
  }));

  return (
    // absoluteFillObject fills the entire transparentModal route layer,
    // which is rendered above the tabs Activity on Android — guaranteed to
    // cover elevated views (elevation:8 StatCard, etc.) without a nested Modal.
    <View style={StyleSheet.absoluteFillObject} testID="add-transaction-screen">
      {/* ── Backdrop ──────────────────────────────────────────────────────── */}
      {/* The scrim dim is a STATIC color (not a Reanimated animated opacity):
          animated opacity on this view was unreliable on Android inside the
          transparentModal route, leaving the dashboard bleeding through. A
          solid theme-overlay scrim guarantees the dashboard is always covered. */}
      <Pressable
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: SCRIM_COLOR },
        ]}
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        testID="add-transaction-backdrop"
      />

      {/* ── Sheet panel ───────────────────────────────────────────────────── */}
      {/* KeyboardAvoidingView wraps only the panel so the keyboard lifts it
          on iOS. On Android the transparent overlay activity adjusts natively. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.panelWrapper}
      >
        {/* Animated.View carries ONLY the slide transform. The solid surface
            background lives on the inner plain View below — on this Android
            build the Reanimated view dropped its own static backgroundColor,
            leaving the panel transparent, so the background must sit on a
            regular View (which renders reliably, like the form inputs do). */}
        <Animated.View style={panelAnimStyle} testID="add-transaction-panel">
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
            testID="add-transaction-panel-surface"
          >
            {/* ── Header ──────────────────────────────────────────────────── */}
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
                Add Transaction
              </Text>
              <Pressable
                onPress={close}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={8}
                style={styles.closeButton}
                testID="add-transaction-close"
              >
                <Ionicons name="close" size={24} color={colors.foreground} />
              </Pressable>
            </View>

            {/* ── Scrollable form content ──────────────────────────────────── */}
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
                    }}
                    leftIcon={
                      <Ionicons
                        name="arrow-up"
                        size={16}
                        color={
                          type === "expense" ? colors.surface : colors.muted
                        }
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
                    }}
                    leftIcon={
                      <Ionicons
                        name="arrow-down"
                        size={16}
                        color={
                          type === "income" ? colors.surface : colors.muted
                        }
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
                    placeholder="0.00"
                    placeholderTextColor={colors.muted}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                    className="flex-1 text-foreground"
                    style={{
                      fontSize: Typography.h2.fontSize,
                      fontWeight: "700",
                    }}
                  />
                </View>
              </View>

              {/* Category */}
              <View>
                <Text
                  className="text-muted font-semibold mb-xs"
                  style={{ fontSize: Typography.label.fontSize }}
                >
                  Category
                </Text>
                {pickerCategories.length > 0 ? (
                  <CategoryPickerGrid
                    categories={pickerCategories}
                    selectedId={selectedCategory}
                    onSelect={(id) => setSelectedCategory(id)}
                    transactions={transactions}
                    recentLimit={5}
                  />
                ) : (
                  <EmptyState
                    icon={
                      <Ionicons
                        name="grid-outline"
                        size={24}
                        color={colors.muted}
                      />
                    }
                    title={`No ${type} categories`}
                    description="Add categories in the Categories tab."
                  />
                )}
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
                            selectedAccount === null
                              ? colors.primary
                              : colors.border,
                          backgroundColor:
                            selectedAccount === null
                              ? colors.primary + "12"
                              : colors.surface,
                        },
                      ]}
                    >
                      <Text className="text-foreground font-medium">
                        No account
                      </Text>
                      {selectedAccount === null ? (
                        <Ionicons
                          name="checkmark"
                          size={18}
                          color={colors.primary}
                        />
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
                              borderColor: selected
                                ? colors.primary
                                : colors.border,
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
                disabled={!isFormValid}
                className="flex-1"
                size="lg"
              />
            </View>
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
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: "center",
    justifyContent: "center",
  },
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

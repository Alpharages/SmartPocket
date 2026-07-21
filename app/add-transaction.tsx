import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Keyboard,
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
  EmptyState,
  Pill,
  Sheet,
} from "@/components/ui";
import { useToast } from "@/components/ui/ToastProvider";
import { useCurrency } from "@/lib/currency-provider";
import { getCurrencySymbol } from "@/lib/currency";
import { Motion, Radius, Spacing, Typography } from "@/lib/_core/theme";
import { resolveCategoryColor } from "@/constants/theme";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";

const MIN_TOUCH_TARGET = 44;

export default function AddTransactionScreen() {
  const router = useRouter();
  // Same active-theme token source the redesigned Sheet/surfaces read —
  // never the theme-agnostic useColors() (frozen to the default theme; AC3).
  const { colors } = useThemeTokens();
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
  const reducedMotion = useReducedMotion();

  const [type, setType] = useState<"income" | "expense">(
    (queryType as "income" | "expense") || "expense",
  );
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<number | null>(null);
  const [date] = useState(new Date());
  // Sheet owns its own open/close animation as long as it stays mounted in
  // the tree — this route's own `visible` just tells Sheet when to start
  // its close animation, mirroring how ConfirmSheet/RecurringTransactionSheet
  // drive it from local state.
  const [visible, setVisible] = useState(true);
  const closingRef = useRef(false);

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
    toast.show({ type: "success", message: "Transaction saved" });
    close();
  };

  const filteredCategories = categories.filter((c) => c.type === type);
  const isFormValid = !!amount && !!selectedCategory;

  // Map filtered categories to CategoryPickerGrid items with resolved colors.
  const pickerCategories = useMemo(
    () =>
      filteredCategories.map((cat) => ({
        ...cat,
        color: resolveCategoryColor(cat.color, scheme),
      })),
    [filteredCategories, scheme],
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
                <Ionicons name="grid-outline" size={24} color={colors.muted} />
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

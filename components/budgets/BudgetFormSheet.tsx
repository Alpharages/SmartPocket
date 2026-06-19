import React, { useCallback, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/components/ui/Button";
import { CategoryPickerGrid } from "@/components/ui/CategoryPickerGrid";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/Pill";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useColors } from "@/hooks/use-colors";
import { useExpense, type Budget } from "@/lib/expense-context";
import { useCurrency } from "@/lib/currency-provider";
import { getCurrencySymbol } from "@/lib/currency";
import { Spacing, Typography } from "@/lib/_core/theme";
import { resolveCategoryColor } from "@/constants/theme";
import { isPositiveBudgetAmount } from "@/lib/budget-validation";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";

export { isPositiveBudgetAmount };

export interface BudgetFormSheetProps {
  /** When set, the form edits an existing budget. */
  budget?: Budget;
  onClose: () => void;
  onSaved: () => void;
  /** Optional wrapper style for embedding in a Sheet or modal panel. */
  contentStyle?: ViewStyle;
  testID?: string;
}

export function BudgetFormSheet({
  budget,
  onClose,
  onSaved,
  contentStyle,
  testID = "budget-form-sheet",
}: BudgetFormSheetProps) {
  const colors = useColors();
  const scheme = (useColorScheme() ?? "light") as "light" | "dark";
  const { currency } = useCurrency();
  const { categories, transactions, addBudget, updateBudget, refreshCategories } =
    useExpense();

  const onRefresh = useCallback(async () => {
    await refreshCategories();
  }, [refreshCategories]);
  const refreshProps = usePullToRefresh(onRefresh);

  const isEditing = budget != null;
  const [period, setPeriod] = useState<"monthly" | "weekly">(
    budget?.period ?? "monthly",
  );
  const [amount, setAmount] = useState(budget?.amount ?? "");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(
    budget?.categoryId ?? null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === "expense"),
    [categories],
  );

  const pickerCategories = useMemo(
    () =>
      expenseCategories.map((cat) => ({
        ...cat,
        color: resolveCategoryColor(cat.color, scheme),
      })),
    [expenseCategories, scheme],
  );

  const isAmountValid = isPositiveBudgetAmount(amount);
  const isFormValid = isAmountValid && selectedCategory != null;

  const handleSave = async () => {
    if (!isFormValid || selectedCategory == null) {
      setErrorMessage("Please select a category and enter a valid amount.");
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    const payload = {
      categoryId: selectedCategory,
      period,
      amount,
    };

    try {
      if (isEditing && budget) {
        await updateBudget(budget.id, payload);
      } else {
        await addBudget(payload);
      }
      onSaved();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to save budget.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={contentStyle} testID={testID}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl {...refreshProps} />}
        contentContainerStyle={{ gap: Spacing.lg, paddingBottom: Spacing.sm }}
      >
        <View>
          <Text
            className="text-muted font-semibold mb-xs"
            style={{ fontSize: Typography.label.fontSize }}
          >
            Period
          </Text>
          <View className="flex-row gap-md">
            <Pill
              label="Monthly"
              selected={period === "monthly"}
              onPress={() => setPeriod("monthly")}
              style={{ flex: 1 }}
            />
            <Pill
              label="Weekly"
              selected={period === "weekly"}
              onPress={() => setPeriod("weekly")}
              style={{ flex: 1 }}
            />
          </View>
        </View>

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
              placeholder="0.00"
              placeholderTextColor={colors.muted}
              value={amount}
              onChangeText={(value) => {
                setAmount(value);
                setErrorMessage(null);
              }}
              keyboardType="decimal-pad"
              className="flex-1 text-foreground"
              style={{ fontSize: Typography.h2.fontSize, fontWeight: "700" }}
              accessibilityLabel="Budget amount"
              testID="budget-amount-input"
            />
          </View>
          {amount.length > 0 && !isAmountValid ? (
            <Text
              className="text-error mt-xs"
              style={{ fontSize: Typography.caption.fontSize }}
              testID="budget-amount-error"
            >
              Amount must be greater than zero.
            </Text>
          ) : null}
        </View>

        <View>
          <Text
            className="text-muted font-semibold mb-xs"
            style={{ fontSize: Typography.label.fontSize }}
          >
            Category
          </Text>
          {isEditing ? (
            <View
              className="rounded-md px-lg py-md"
              style={{
                backgroundColor: colors.surface,
                borderWidth: 0.5,
                borderColor: colors.border,
              }}
            >
              <Text
                className="text-foreground"
                style={{ fontSize: Typography.body.fontSize }}
              >
                {expenseCategories.find((c) => c.id === selectedCategory)
                  ?.name ?? "Category"}
              </Text>
            </View>
          ) : pickerCategories.length > 0 ? (
            <CategoryPickerGrid
              categories={pickerCategories}
              selectedId={selectedCategory}
              onSelect={(id) => {
                setSelectedCategory(id);
                setErrorMessage(null);
              }}
              transactions={transactions}
              recentLimit={5}
            />
          ) : (
            <EmptyState
              icon={
                <Ionicons name="grid-outline" size={24} color={colors.muted} />
              }
              title="No expense categories"
              description="Add expense categories before creating a budget."
            />
          )}
        </View>

        {errorMessage ? (
          <Text
            className="text-error"
            style={{ fontSize: Typography.caption.fontSize }}
            testID="budget-form-error"
          >
            {errorMessage}
          </Text>
        ) : null}
      </ScrollView>

      <View className="flex-row gap-md mt-lg">
        <Button
          variant="secondary"
          label="Cancel"
          onPress={onClose}
          className="flex-1"
          size="lg"
        />
        <Button
          variant="primary"
          label={isEditing ? "Save" : "Create"}
          onPress={handleSave}
          disabled={!isFormValid || saving}
          className="flex-1"
          size="lg"
          testID="budget-save-button"
        />
      </View>
    </View>
  );
}

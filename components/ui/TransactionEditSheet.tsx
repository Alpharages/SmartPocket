import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/components/ui/Button";
import { CategoryPickerGrid } from "@/components/ui/CategoryPickerGrid";
import { DatePickerButton } from "@/components/ui/DatePickerButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/Pill";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/ToastProvider";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeTokens } from "@/lib/theme-provider";
import { useCurrency } from "@/lib/currency-provider";
import { getCurrencySymbol } from "@/lib/currency";
import { useExpense, type Transaction } from "@/lib/expense-context";
import { resolveCategoryColor } from "@/constants/theme";
import { Spacing, Typography } from "@/lib/_core/theme";
import {
  formatDateInput,
  parseDateInput,
} from "@/lib/recurring-form-validation";

/**
 * Edit an existing transaction.
 *
 * QA report SP-009: the transaction detail screen exposed exactly one mutable
 * field — Account. Amount, type, category, date and description were
 * render-only, so correcting a mis-typed amount meant deleting and re-creating
 * the record (which, before SP-008, also lost the original date). The context
 * and server already supported partial updates of every field; no UI called
 * them.
 */
export function TransactionEditSheet({
  visible,
  transaction,
  onClose,
}: {
  visible: boolean;
  transaction: Transaction;
  onClose: () => void;
}) {
  const { colors, themeId } = useThemeTokens();
  const scheme = (useColorScheme() ?? "light") as "light" | "dark";
  const { currency } = useCurrency();
  const { categories, creditCards, updateTransaction } = useExpense();
  const toast = useToast();

  const [type, setType] = useState<"income" | "expense">(transaction.type);
  const [amount, setAmount] = useState(transaction.amount);
  const [categoryId, setCategoryId] = useState<number | null>(
    transaction.categoryId,
  );
  const [cardId, setCardId] = useState<number | null>(
    transaction.creditCardId ?? null,
  );
  const [description, setDescription] = useState(transaction.description ?? "");
  const [dateInput, setDateInput] = useState(() =>
    formatDateInput(new Date(transaction.date)),
  );
  const [saving, setSaving] = useState(false);

  // Re-seed whenever the sheet opens or the underlying record changes.
  useEffect(() => {
    if (!visible) return;
    setType(transaction.type);
    setAmount(transaction.amount);
    setCategoryId(transaction.categoryId);
    setCardId(transaction.creditCardId ?? null);
    setDescription(transaction.description ?? "");
    setDateInput(formatDateInput(new Date(transaction.date)));
    setSaving(false);
  }, [visible, transaction]);

  const pickerCategories = useMemo(
    () =>
      categories
        .filter((c) => c.type === type)
        .map((cat) => ({
          ...cat,
          color: resolveCategoryColor(cat.color, scheme, themeId),
        })),
    [categories, type, scheme, themeId],
  );

  const activeCards = useMemo(
    () => creditCards.filter((card) => card.isActive),
    [creditCards],
  );

  const parsedDate = parseDateInput(dateInput);
  const amountError =
    amount.trim().length === 0
      ? "Enter an amount"
      : !/^\d+(\.\d{1,2})?$/.test(amount.trim())
        ? "Enter an amount like 12.50"
        : Number(amount) <= 0
          ? "Amount must be greater than zero"
          : null;
  const dateError = parsedDate ? null : "Use YYYY-MM-DD";
  const isValid = !amountError && !dateError && categoryId != null;

  const handleSave = async () => {
    if (!isValid || categoryId == null || !parsedDate || saving) return;
    setSaving(true);
    try {
      await updateTransaction(transaction.id, {
        type,
        amount: amount.trim(),
        categoryId,
        creditCardId: type === "expense" ? (cardId ?? undefined) : undefined,
        description: description.trim() || undefined,
        date: parsedDate,
      });
      toast.show({ type: "success", message: "Transaction updated" });
      onClose();
    } catch {
      // expense-context rolled back and showed the error toast; keep the sheet
      // open so the edit is not lost.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Edit Transaction"
      testID="edit-transaction-sheet"
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={{ flexShrink: 1 }}
        contentContainerStyle={{ gap: Spacing.lg, paddingBottom: Spacing.sm }}
      >
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
                setCategoryId(null);
              }}
              style={{ flex: 1 }}
            />
            <Pill
              label="Income"
              selected={type === "income"}
              onPress={() => {
                setType("income");
                setCategoryId(null);
                setCardId(null);
              }}
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
              borderColor: amountError ? colors.error : colors.border,
            }}
          >
            <Text className="text-foreground font-bold mr-sm">
              {getCurrencySymbol(currency)}
            </Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              className="flex-1 text-foreground"
              style={{
                // SP-097: without `minWidth: 0` a flex <input> refuses to shrink below
                // its intrinsic width, overflowing the row and horizontally scrolling
                // the sheet — which clipped the first character off every label.
                minWidth: 0,
                fontSize: Typography.body.fontSize,
              }}
              accessibilityLabel="Amount"
              testID="edit-transaction-amount"
            />
          </View>
          {amountError ? (
            <Text
              className="mt-xs"
              style={{
                color: colors.error,
                fontSize: Typography.caption.fontSize,
              }}
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
            Category
          </Text>
          {pickerCategories.length > 0 ? (
            <CategoryPickerGrid
              categories={pickerCategories}
              selectedId={categoryId}
              onSelect={setCategoryId}
            />
          ) : (
            <EmptyState
              icon={
                <Ionicons name="grid-outline" size={24} color={colors.muted} />
              }
              title={`No ${type} categories`}
              description="Add categories before re-classifying this transaction."
            />
          )}
        </View>

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
              testID="edit-transaction-date"
            />
            <DatePickerButton
              value={dateInput}
              onChange={setDateInput}
              accessibilityLabel="Pick transaction date"
              testID="edit-transaction-date-picker"
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
                selected={cardId == null}
                onPress={() => setCardId(null)}
              />
              {activeCards.map((card) => (
                <Pill
                  key={card.id}
                  label={card.name}
                  selected={cardId === card.id}
                  onPress={() => setCardId(card.id)}
                />
              ))}
            </View>
          </View>
        ) : null}

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
              value={description}
              onChangeText={setDescription}
              placeholder="Add a note…"
              placeholderTextColor={colors.muted}
              className="text-foreground"
              style={{ fontSize: Typography.body.fontSize }}
              multiline
              textAlignVertical="top"
              accessibilityLabel="Note"
              maxLength={500}
            />
          </View>
        </View>
      </ScrollView>

      <View className="flex-row gap-md mt-lg">
        <Button
          variant="secondary"
          label="Cancel"
          onPress={onClose}
          className="flex-1"
          size="lg"
          disabled={saving}
        />
        <Button
          variant="primary"
          label="Save"
          onPress={handleSave}
          className="flex-1"
          size="lg"
          disabled={!isValid || saving}
          loading={saving}
          testID="edit-transaction-save"
        />
      </View>
    </Sheet>
  );
}

TransactionEditSheet.displayName = "TransactionEditSheet";

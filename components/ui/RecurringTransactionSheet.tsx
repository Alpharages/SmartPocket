import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/components/ui/Button";
import { CategoryPickerGrid } from "@/components/ui/CategoryPickerGrid";
import { FilterChipGroup } from "@/components/ui/FilterChipGroup";
import { Pill } from "@/components/ui/Pill";
import { Sheet } from "@/components/ui/Sheet";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useColors } from "@/hooks/use-colors";
import {
  useExpense,
  type CreateRecurringTransactionInput,
  type RecurringTransaction,
} from "@/lib/expense-context";
import { useCurrency } from "@/lib/currency-provider";
import { getCurrencySymbol } from "@/lib/currency";
import { Spacing, Typography } from "@/lib/_core/theme";
import { resolveCategoryColor } from "@/constants/theme";
import { DatePickerButton } from "./DatePickerButton";
import {
  formatDateInput,
  isRecurringFormValid,
  parseDateInput,
  validateRecurringForm,
  type RecurringEndCondition,
  type RecurringFormValues,
  type RecurringFrequency,
} from "@/lib/recurring-form-validation";
import type { Id } from "@/drizzle/schema";

const FREQUENCY_OPTIONS: { value: RecurringFrequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const END_CONDITION_OPTIONS: { value: RecurringEndCondition; label: string }[] =
  [
    { value: "never", label: "Never" },
    { value: "count", label: "After N times" },
    { value: "endDate", label: "End on date" },
  ];

function valuesFromRule(rule: RecurringTransaction): RecurringFormValues {
  return {
    type: rule.type,
    amount: rule.amount,
    categoryId: rule.categoryId,
    creditCardId: rule.creditCardId ?? null,
    description: rule.description ?? "",
    frequency: rule.frequency,
    interval: rule.interval,
    endCondition: rule.endCondition,
    occurrenceCount:
      rule.endCondition === "count" && rule.occurrenceCount != null
        ? String(rule.occurrenceCount)
        : "",
    startDate: new Date(rule.startDate),
    endDate:
      rule.endCondition === "endDate" && rule.endDate
        ? new Date(rule.endDate)
        : null,
  };
}

function toMutationInput(
  values: RecurringFormValues,
): CreateRecurringTransactionInput {
  return {
    type: values.type,
    amount: values.amount.trim(),
    categoryId: values.categoryId!,
    creditCardId: values.creditCardId,
    description: values.description.trim() || undefined,
    frequency: values.frequency,
    interval: values.interval,
    endCondition: values.endCondition,
    occurrenceCount:
      values.endCondition === "count"
        ? parseInt(values.occurrenceCount, 10)
        : undefined,
    endDate:
      values.endCondition === "endDate"
        ? (values.endDate ?? undefined)
        : undefined,
    startDate: values.startDate,
  };
}

export interface RecurringTransactionSheetProps {
  visible: boolean;
  onClose: () => void;
  editing?: RecurringTransaction;
  onSaved?: () => void;
  contentStyle?: ViewStyle;
  testID?: string;
}

export function RecurringTransactionSheet({
  visible,
  onClose,
  editing,
  onSaved,
  contentStyle,
  testID = "recurring-transaction-sheet",
}: RecurringTransactionSheetProps) {
  const colors = useColors();
  const scheme = (useColorScheme() ?? "light") as "light" | "dark";
  const { currency } = useCurrency();
  const {
    categories,
    creditCards,
    addRecurringTransaction,
    updateRecurringTransaction,
  } = useExpense();

  const isEditing = editing != null;
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Id | null>(null);
  const [creditCardId, setCreditCardId] = useState<Id | null>(null);
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState<RecurringFrequency>("monthly");
  const [interval, setInterval] = useState(1);
  const [endCondition, setEndCondition] =
    useState<RecurringEndCondition>("never");
  const [occurrenceCount, setOccurrenceCount] = useState("");
  const [startDateInput, setStartDateInput] = useState("");
  const [endDateInput, setEndDateInput] = useState("");
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof RecurringFormValues, string>>
  >({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (editing) {
      const values = valuesFromRule(editing);
      setType(values.type);
      setAmount(values.amount);
      setSelectedCategory(values.categoryId);
      setCreditCardId(values.creditCardId);
      setDescription(values.description);
      setFrequency(values.frequency);
      setInterval(values.interval);
      setEndCondition(values.endCondition);
      setOccurrenceCount(values.occurrenceCount);
      setStartDateInput(formatDateInput(values.startDate));
      setEndDateInput(values.endDate ? formatDateInput(values.endDate) : "");
    } else {
      const today = new Date();
      setType("expense");
      setAmount("");
      setSelectedCategory(null);
      setCreditCardId(null);
      setDescription("");
      setFrequency("monthly");
      setInterval(1);
      setEndCondition("never");
      setOccurrenceCount("");
      setStartDateInput(formatDateInput(today));
      setEndDateInput("");
    }
    setFieldErrors({});
    setSaving(false);
  }, [visible, editing]);

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type],
  );

  const pickerCategories = useMemo(
    () =>
      filteredCategories.map((cat) => ({
        ...cat,
        color: resolveCategoryColor(cat.color, scheme),
      })),
    [filteredCategories, scheme],
  );

  const activeCards = useMemo(
    () => creditCards.filter((card) => card.isActive),
    [creditCards],
  );

  const handleTypeChange = (nextType: "income" | "expense") => {
    setType(nextType);
    const selected = categories.find((c) => c.id === selectedCategory);
    if (selected && selected.type !== nextType) {
      setSelectedCategory(null);
    }
  };

  const handleEndConditionChange = (next: RecurringEndCondition) => {
    setEndCondition(next);
    if (next !== "count") setOccurrenceCount("");
    if (next !== "endDate") setEndDateInput("");
  };

  const buildFormValues = (): RecurringFormValues => {
    const startDate = parseDateInput(startDateInput) ?? new Date();
    const endDate =
      endCondition === "endDate" ? parseDateInput(endDateInput) : null;

    return {
      type,
      amount,
      categoryId: selectedCategory,
      creditCardId,
      description,
      frequency,
      interval,
      endCondition,
      occurrenceCount,
      startDate,
      endDate,
    };
  };

  const handleSave = async () => {
    const parsedStart = parseDateInput(startDateInput);
    if (!parsedStart) {
      setFieldErrors({
        startDate: "Enter a valid start date (YYYY-MM-DD)",
      });
      return;
    }

    const values = buildFormValues();
    values.startDate = parsedStart;
    if (values.endCondition === "endDate") {
      values.endDate = parseDateInput(endDateInput);
    }

    const errors = validateRecurringForm(values);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    if (!isRecurringFormValid(values)) {
      return;
    }

    setSaving(true);
    setFieldErrors({});
    const payload = toMutationInput(values);

    try {
      if (isEditing && editing) {
        await updateRecurringTransaction(editing.id, payload);
      } else {
        await addRecurringTransaction(payload);
      }
      onSaved?.();
      onClose();
    } catch {
      // Toast + rollback handled in expense-context; keep sheet open.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={isEditing ? "Edit Recurring Rule" : "New Recurring Rule"}
      testID={testID}
    >
      <View style={contentStyle} testID={`${testID}-form`}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: Spacing.lg, paddingBottom: Spacing.sm }}
        >
          <View className="flex-row gap-md">
            <Pill
              label="Expense"
              selected={type === "expense"}
              onPress={() => handleTypeChange("expense")}
              style={{ flex: 1 }}
            />
            <Pill
              label="Income"
              selected={type === "income"}
              onPress={() => handleTypeChange("income")}
              style={{ flex: 1 }}
            />
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
                borderColor: fieldErrors.amount ? colors.error : colors.border,
              }}
            >
              <Text className="text-muted mr-sm">
                {getCurrencySymbol(currency)}
              </Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.muted}
                className="flex-1 text-foreground"
                style={{
                  // SP-097: without `minWidth: 0` a flex <input> refuses to shrink below
                  // its intrinsic width, overflowing the row and horizontally scrolling
                  // the sheet — which clipped the first character off every label.
                  minWidth: 0,
                  fontSize: Typography.body.fontSize,
                }}
                accessibilityLabel="Recurring amount"
              />
            </View>
            {fieldErrors.amount ? (
              <Text
                className="text-error mt-xs"
                style={{ fontSize: Typography.caption.fontSize }}
              >
                {fieldErrors.amount}
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
            <CategoryPickerGrid
              categories={pickerCategories}
              selectedId={selectedCategory}
              onSelect={setSelectedCategory}
            />
            {fieldErrors.categoryId ? (
              <Text
                className="text-error mt-xs"
                style={{ fontSize: Typography.caption.fontSize }}
              >
                {fieldErrors.categoryId}
              </Text>
            ) : null}
          </View>

          {activeCards.length > 0 ? (
            <View>
              <Text
                className="text-muted font-semibold mb-xs"
                style={{ fontSize: Typography.label.fontSize }}
              >
                Card (optional)
              </Text>
              <View className="flex-row flex-wrap gap-sm">
                <Pill
                  label="None"
                  selected={creditCardId == null}
                  onPress={() => setCreditCardId(null)}
                />
                {activeCards.map((card) => (
                  <Pill
                    key={card.id}
                    label={card.name}
                    selected={creditCardId === card.id}
                    onPress={() => setCreditCardId(card.id)}
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
              Description (optional)
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="e.g., Rent"
              placeholderTextColor={colors.muted}
              className="rounded-md px-lg py-md text-foreground"
              style={{
                fontSize: Typography.body.fontSize,
                backgroundColor: colors.surface,
                borderWidth: 0.5,
                borderColor: colors.border,
              }}
              accessibilityLabel="Description"
            />
          </View>

          <View>
            <Text
              className="text-muted font-semibold mb-xs"
              style={{ fontSize: Typography.label.fontSize }}
            >
              Frequency
            </Text>
            <FilterChipGroup
              mode="single"
              options={FREQUENCY_OPTIONS}
              // SP-098: FilterChipGroup's scroller carries a 24px inset for
              // full-bleed screen rows. Inside an already-padded sheet that
              // double-pads, indenting these chips 24px past every other
              // control in the form.
              contentContainerStyle={{ paddingHorizontal: 0 }}
              value={frequency}
              onChange={setFrequency}
            />
          </View>

          <View>
            <Text
              className="text-muted font-semibold mb-xs"
              style={{ fontSize: Typography.label.fontSize }}
            >
              Every
            </Text>
            <View className="flex-row items-center gap-md">
              <Pressable
                onPress={() => setInterval((value) => Math.max(1, value - 1))}
                accessibilityRole="button"
                accessibilityLabel="Decrease interval"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.surface,
                  borderWidth: 0.5,
                  borderColor: colors.border,
                }}
              >
                <Ionicons name="remove" size={20} color={colors.foreground} />
              </Pressable>
              <Text
                className="text-foreground font-semibold"
                style={{
                  fontSize: Typography.h3.fontSize,
                  minWidth: 32,
                  textAlign: "center",
                }}
              >
                {interval}
              </Text>
              <Pressable
                onPress={() => setInterval((value) => value + 1)}
                accessibilityRole="button"
                accessibilityLabel="Increase interval"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.surface,
                  borderWidth: 0.5,
                  borderColor: colors.border,
                }}
              >
                <Ionicons name="add" size={20} color={colors.foreground} />
              </Pressable>
            </View>
            {fieldErrors.interval ? (
              <Text
                className="text-error mt-xs"
                style={{ fontSize: Typography.caption.fontSize }}
              >
                {fieldErrors.interval}
              </Text>
            ) : null}
          </View>

          <View>
            <Text
              className="text-muted font-semibold mb-xs"
              style={{ fontSize: Typography.label.fontSize }}
            >
              Start date
            </Text>
            <View className="flex-row items-center">
              <TextInput
                value={startDateInput}
                onChangeText={setStartDateInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                className="rounded-md px-lg py-md text-foreground flex-1"
                style={{
                  fontSize: Typography.body.fontSize,
                  backgroundColor: colors.surface,
                  borderWidth: 0.5,
                  borderColor: fieldErrors.startDate
                    ? colors.error
                    : colors.border,
                }}
                accessibilityLabel="Start date"
              />
              <DatePickerButton
                value={startDateInput}
                onChange={setStartDateInput}
                accessibilityLabel="Pick start date"
              />
            </View>
            {fieldErrors.startDate ? (
              <Text
                className="text-error mt-xs"
                style={{ fontSize: Typography.caption.fontSize }}
              >
                {fieldErrors.startDate}
              </Text>
            ) : null}
          </View>

          <View>
            <Text
              className="text-muted font-semibold mb-xs"
              style={{ fontSize: Typography.label.fontSize }}
            >
              Ends
            </Text>
            <FilterChipGroup
              mode="single"
              options={END_CONDITION_OPTIONS}
              // SP-098: FilterChipGroup's scroller carries a 24px inset for
              // full-bleed screen rows. Inside an already-padded sheet that
              // double-pads, indenting these chips 24px past every other
              // control in the form.
              contentContainerStyle={{ paddingHorizontal: 0 }}
              value={endCondition}
              onChange={handleEndConditionChange}
            />
          </View>

          {endCondition === "count" ? (
            <View>
              <Text
                className="text-muted font-semibold mb-xs"
                style={{ fontSize: Typography.label.fontSize }}
              >
                Occurrences
              </Text>
              <TextInput
                value={occurrenceCount}
                onChangeText={setOccurrenceCount}
                keyboardType="number-pad"
                placeholder="e.g., 12"
                placeholderTextColor={colors.muted}
                className="rounded-md px-lg py-md text-foreground"
                style={{
                  fontSize: Typography.body.fontSize,
                  backgroundColor: colors.surface,
                  borderWidth: 0.5,
                  borderColor: fieldErrors.occurrenceCount
                    ? colors.error
                    : colors.border,
                }}
                accessibilityLabel="Occurrence count"
              />
              {fieldErrors.occurrenceCount ? (
                <Text
                  className="text-error mt-xs"
                  style={{ fontSize: Typography.caption.fontSize }}
                >
                  {fieldErrors.occurrenceCount}
                </Text>
              ) : null}
            </View>
          ) : null}

          {endCondition === "endDate" ? (
            <View>
              <Text
                className="text-muted font-semibold mb-xs"
                style={{ fontSize: Typography.label.fontSize }}
              >
                End date
              </Text>
              <View className="flex-row items-center">
                <TextInput
                  value={endDateInput}
                  onChangeText={setEndDateInput}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  className="rounded-md px-lg py-md text-foreground flex-1"
                  style={{
                    fontSize: Typography.body.fontSize,
                    backgroundColor: colors.surface,
                    borderWidth: 0.5,
                    borderColor: fieldErrors.endDate
                      ? colors.error
                      : colors.border,
                  }}
                  accessibilityLabel="End date"
                />
                <DatePickerButton
                  value={endDateInput}
                  onChange={setEndDateInput}
                  accessibilityLabel="Pick end date"
                />
              </View>
              {fieldErrors.endDate ? (
                <Text
                  className="text-error mt-xs"
                  style={{ fontSize: Typography.caption.fontSize }}
                >
                  {fieldErrors.endDate}
                </Text>
              ) : null}
            </View>
          ) : null}

          <View className="flex-row gap-md mt-sm">
            <Button
              variant="secondary"
              label="Cancel"
              onPress={onClose}
              className="flex-1"
              disabled={saving}
            />
            <Button
              variant="primary"
              label={isEditing ? "Save" : "Create"}
              onPress={handleSave}
              className="flex-1"
              disabled={saving}
              loading={saving}
            />
          </View>
        </ScrollView>
      </View>
    </Sheet>
  );
}

RecurringTransactionSheet.displayName = "RecurringTransactionSheet";

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { ResponsiveContent } from "@/components/responsive-content";
import {
  ConfirmSheet,
  EmptyState,
  RecurringTransactionRow,
  RecurringTransactionSheet,
  ScreenHeader,
} from "@/components/ui";
import { useExpense, type RecurringTransaction } from "@/lib/expense-context";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { readableTextOn } from "@/lib/_core/contrast";
import { resolveCategoryColor } from "@/constants/theme";
import { Spacing } from "@/lib/_core/theme";

export default function RecurringScreen() {
  const router = useRouter();
  const colors = useColors();
  const scheme = (useColorScheme() ?? "light") as "light" | "dark";
  const {
    recurringTransactions,
    loadingRecurringTransactions,
    categories,
    cancelRecurringTransaction,
  } = useExpense();

  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<
    RecurringTransaction | undefined
  >();
  const [cancelTarget, setCancelTarget] = useState<RecurringTransaction | null>(
    null,
  );
  const [cancelling, setCancelling] = useState(false);

  const categoryById = useMemo(() => {
    const map = new Map<number, (typeof categories)[number]>();
    for (const category of categories) {
      map.set(category.id, category);
    }
    return map;
  }, [categories]);

  const sortedRules = useMemo(
    () =>
      [...recurringTransactions].sort((a, b) => {
        if (a.isActive !== b.isActive) {
          return a.isActive ? -1 : 1;
        }
        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      }),
    [recurringTransactions],
  );

  const openCreate = useCallback(() => {
    setEditingRule(undefined);
    setSheetVisible(true);
  }, []);

  const openEdit = useCallback((rule: RecurringTransaction) => {
    setEditingRule(rule);
    setSheetVisible(true);
  }, []);

  const closeSheet = useCallback(() => {
    setSheetVisible(false);
    setEditingRule(undefined);
  }, []);

  const handleConfirmCancel = useCallback(async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await cancelRecurringTransaction(cancelTarget.id);
      setCancelTarget(null);
    } catch {
      // Toast handled in context.
    } finally {
      setCancelling(false);
    }
  }, [cancelTarget, cancelRecurringTransaction]);

  const renderItem = useCallback(
    ({ item }: { item: RecurringTransaction }) => {
      const category = categoryById.get(item.categoryId);
      const categoryName = category?.name ?? "Unknown";
      const categoryColor = category
        ? resolveCategoryColor(category.color, scheme)
        : colors.muted;
      const categoryIcon = (category?.icon ??
        "help-outline") as React.ComponentProps<typeof Ionicons>["name"];

      return (
        <View
          style={{
            borderBottomWidth: 0.5,
            borderBottomColor: colors.border,
          }}
        >
          <RecurringTransactionRow
            rule={item}
            categoryName={categoryName}
            categoryColor={categoryColor}
            categoryIcon={categoryIcon}
            onPress={() => openEdit(item)}
          />
          {item.isActive ? (
            <Pressable
              onPress={() => setCancelTarget(item)}
              accessibilityRole="button"
              accessibilityLabel={`Stop recurring rule for ${categoryName}`}
              style={{
                alignSelf: "flex-start",
                marginLeft: Spacing.lg,
                marginBottom: Spacing.md,
                minHeight: 44,
                justifyContent: "center",
              }}
            >
              <Text style={{ color: colors.error, fontWeight: "600" }}>
                Stop recurrence
              </Text>
            </Pressable>
          ) : null}
        </View>
      );
    },
    [categoryById, colors, openEdit, scheme],
  );

  return (
    <ScreenContainer>
      <ResponsiveContent>
        <ScreenHeader
          title="Recurring"
          subtitle={`${sortedRules.length} rule${
            sortedRules.length === 1 ? "" : "s"
          }`}
          accessibilityLabel="Recurring transactions screen header"
          action={
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Pressable
                onPress={() => router.back()}
                accessibilityRole="button"
                accessibilityLabel="Go back"
                hitSlop={8}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.surface,
                  borderWidth: 0.5,
                  borderColor: colors.border,
                }}
              >
                <Ionicons
                  name="chevron-back"
                  size={20}
                  color={colors.foreground}
                />
              </Pressable>
              <Pressable
                onPress={openCreate}
                accessibilityRole="button"
                accessibilityLabel="Add recurring rule"
                hitSlop={8}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name="add"
                  size={22}
                  color={readableTextOn(colors.primary)}
                />
              </Pressable>
            </View>
          }
        />

        {loadingRecurringTransactions && sortedRules.length === 0 ? (
          <View className="items-center justify-center py-20">
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={sortedRules}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: Spacing["2xl"] }}
            ListEmptyComponent={
              <EmptyState
                variant="no-data"
                title="No recurring rules yet"
                description="Create a rule to automatically log regular income or expenses."
                action={{ label: "Add recurring rule", onPress: openCreate }}
              />
            }
          />
        )}
      </ResponsiveContent>

      <RecurringTransactionSheet
        visible={sheetVisible}
        onClose={closeSheet}
        editing={editingRule}
        onSaved={closeSheet}
      />

      <ConfirmSheet
        visible={cancelTarget != null}
        title="Stop recurring rule?"
        message={
          cancelTarget
            ? `This will stop future transactions for ${categoryById.get(cancelTarget.categoryId)?.name ?? "this rule"}. Past generated transactions are kept.`
            : undefined
        }
        confirmLabel={cancelling ? "Stopping…" : "Stop"}
        destructive
        onConfirm={handleConfirmCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </ScreenContainer>
  );
}

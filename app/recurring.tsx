import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
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
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import type { Id } from "@/drizzle/schema";

export default function RecurringScreen() {
  const router = useRouter();
  const colors = useColors();
  const scheme = (useColorScheme() ?? "light") as "light" | "dark";
  const {
    recurringTransactions,
    loadingRecurringTransactions,
    recurringTransactionsError,
    categories,
    cancelRecurringTransaction,
    refreshRecurringTransactions,
  } = useExpense();

  const onRefresh = useCallback(async () => {
    await refreshRecurringTransactions();
  }, [refreshRecurringTransactions]);
  const refreshProps = usePullToRefresh(onRefresh);

  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<
    RecurringTransaction | undefined
  >();
  const [cancelTarget, setCancelTarget] = useState<RecurringTransaction | null>(
    null,
  );
  const [cancelling, setCancelling] = useState(false);

  const categoryById = useMemo(() => {
    const map = new Map<Id, (typeof categories)[number]>();
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
          // SP-074: "0 rules" is a claim about the user's data. Don't make it
          // when the load failed and we have no idea what the real count is.
          subtitle={
            recurringTransactionsError
              ? "Couldn't load"
              : `${sortedRules.length} rule${
                  sortedRules.length === 1 ? "" : "s"
                }`
          }
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
                  width: 44,
                  height: 44,
                  borderRadius: 22,
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

        <FlatList
          data={sortedRules}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{
            paddingBottom: Spacing["2xl"],
            flexGrow: sortedRules.length === 0 ? 1 : undefined,
          }}
          refreshControl={<RefreshControl {...refreshProps} />}
          ListEmptyComponent={
            loadingRecurringTransactions ? (
              <View className="items-center justify-center py-20">
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : recurringTransactionsError ? (
              // SP-074: a failed load fell through to the empty state below,
              // telling the user they had no rules when the truth was that we
              // could not find out. Never assert "no data" on an error.
              <EmptyState
                variant="no-data"
                icon={
                  <Ionicons
                    name="cloud-offline-outline"
                    size={28}
                    color={colors.error}
                  />
                }
                title="Couldn't load your recurring rules"
                description="Something went wrong reaching the server. Your rules are safe — this screen just can't show them right now."
                action={{
                  label: "Try again",
                  onPress: () => void refreshRecurringTransactions(),
                }}
                testID="recurring-load-error"
              />
            ) : (
              <EmptyState
                variant="no-data"
                icon={<Ionicons name="repeat" size={28} color={colors.muted} />}
                title="No recurring rules yet"
                description="Create a rule to automatically log regular income or expenses."
                action={{ label: "Add recurring rule", onPress: openCreate }}
              />
            )
          }
        />
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

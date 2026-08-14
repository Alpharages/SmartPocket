import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useExpense } from "@/lib/expense-context";
import { useCurrency } from "@/lib/currency-provider";
import { formatSignedCurrency } from "@/lib/currency";
import { Animated, FadeInUp } from "@/lib/motion";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { confirmDestructive } from "@/lib/confirm-dialog";
import { TransactionEditSheet } from "@/components/ui/TransactionEditSheet";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

function formatDate(value: Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function TransactionDetailScreen() {
  const router = useRouter();
  const colors = useColors();
  const { currency } = useCurrency();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    transactions,
    categories,
    accounts,
    updateTransaction,
    deleteTransaction,
    loadingTransactions,
    refreshTransactions,
    refreshAccounts,
  } = useExpense();

  const onRefresh = useCallback(async () => {
    await Promise.all([refreshTransactions(), refreshAccounts()]);
  }, [refreshTransactions, refreshAccounts]);
  const refreshProps = usePullToRefresh(onRefresh);

  const transactionId = Number(id);
  const transaction = transactions.find((t) => t.id === transactionId);
  const currentAccountId = transaction?.accountId ?? null;
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(
    currentAccountId,
  );
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setSelectedAccountId(transaction?.accountId ?? null);
  }, [transaction?.accountId, transaction?.id]);

  // The assignment changed only if the selection differs from what's persisted.
  const isAccountDirty = selectedAccountId !== currentAccountId;
  // A previously-assigned account that no longer exists (deleted, or not yet
  // loaded) renders no visible selection — flag it so the user understands why.
  const selectedAccountMissing =
    selectedAccountId !== null &&
    !accounts.some((account) => account.id === selectedAccountId);

  const handleSaveAccount = useCallback(async () => {
    if (!transaction || selectedAccountId === (transaction.accountId ?? null)) {
      return;
    }
    await updateTransaction(transaction.id, { accountId: selectedAccountId });
  }, [transaction, selectedAccountId, updateTransaction]);

  // Loading / not-found states — the transaction list may still be fetching,
  // or the id may not resolve (e.g. deep-linked to a deleted transaction).
  if (!transaction) {
    return (
      <ScreenContainer
        className="flex-1 bg-background"
        edges={["top", "left", "right", "bottom"]}
      >
        <View className="flex-row items-center px-6 pt-6 pb-2">
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            // SP-086: missing accessibilityRole kept this out of the DOM as a
            // button, so screen-reader and keyboard users had no way back.
            // className sizing does not apply to Pressable in this app.
            accessibilityRole="button"
            accessibilityLabel="Go back"
            // SP-091: NativeWind className is disabled on Pressable in this app,
            // so `w-10 h-10` never applied and the control rendered at 40x40 —
            // under the 44x44 minimum. Size it in `style`.
            style={{
              backgroundColor: colors.surface,
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="chevron-back" size={22} color={colors.foreground} />
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons
            name={loadingTransactions ? "hourglass-outline" : "search-outline"}
            size={32}
            color={colors.muted}
          />
          <Text className="mt-3 text-muted font-medium text-sm">
            {loadingTransactions
              ? "Loading transaction…"
              : "Transaction not found"}
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  const isIncome = transaction.type === "income";
  const accent = isIncome ? colors.success : colors.error;
  const category = categories.find((c) => c.id === transaction.categoryId);

  const handleDelete = async () => {
    const confirmed = await confirmDestructive({
      title: "Delete transaction",
      message: "This cannot be undone.",
    });
    if (!confirmed) return;
    await deleteTransaction(transaction.id);
    router.back();
  };

  return (
    <ScreenContainer
      className="flex-1 bg-background"
      edges={["top", "left", "right", "bottom"]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl {...refreshProps} />}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 pt-6 pb-2">
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            // SP-086: missing accessibilityRole kept this out of the DOM as a
            // button, so screen-reader and keyboard users had no way back.
            // className sizing does not apply to Pressable in this app.
            accessibilityRole="button"
            accessibilityLabel="Go back"
            // SP-091: NativeWind className is disabled on Pressable in this app,
            // so `w-10 h-10` never applied and the control rendered at 40x40 —
            // under the 44x44 minimum. Size it in `style`.
            style={{
              backgroundColor: colors.surface,
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="chevron-back" size={22} color={colors.foreground} />
          </Pressable>
          <Text className="text-h1 text-foreground">Details</Text>
          <View className="flex-row items-center gap-2">
            {/* SP-009: the screen exposed exactly one mutable field (Account);
             * amount, type, category, date and note were render-only. */}
            <Pressable
              onPress={() => setEditing(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Edit transaction"
              testID="edit-transaction-button"
              // SP-091: NativeWind className is disabled on Pressable in this app,
              // so `w-10 h-10` never applied and the control rendered at 40x40 —
              // under the 44x44 minimum. Size it in `style`.
              style={{
                backgroundColor: colors.primary + "14",
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name="create-outline"
                size={20}
                color={colors.primary}
              />
            </Pressable>
            <Pressable
              onPress={() => void handleDelete()}
              hitSlop={8}
              accessibilityLabel="Delete transaction"
              // SP-091: NativeWind className is disabled on Pressable in this app,
              // so `w-10 h-10` never applied and the control rendered at 40x40 —
              // under the 44x44 minimum. Size it in `style`.
              style={{
                backgroundColor: colors.error + "14",
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="trash-outline" size={20} color={colors.error} />
            </Pressable>
          </View>
        </View>

        {/* Amount */}
        <Animated.View
          entering={FadeInUp.delay(100).duration(400)}
          className="items-center mt-6 px-6"
        >
          <View
            className="w-16 h-16 rounded-full items-center justify-center mb-3"
            style={{ backgroundColor: accent + "18" }}
          >
            <Ionicons
              name={isIncome ? "arrow-down" : "arrow-up"}
              size={26}
              color={accent}
            />
          </View>
          <Text className="text-4xl font-bold" style={{ color: accent }}>
            {formatSignedCurrency(
              transaction.amount,
              currency,
              transaction.type,
            )}
          </Text>
          <Text className="mt-xs text-sm text-muted font-medium capitalize">
            {transaction.type}
          </Text>
        </Animated.View>

        {/* Details card */}
        <Animated.View
          entering={FadeInUp.delay(150).duration(400)}
          className="mx-6 mt-8 rounded-2xl overflow-hidden"
          style={{
            backgroundColor: colors.surface,
            borderWidth: 0.5,
            borderColor: colors.border,
          }}
        >
          {/* Category */}
          <View className="flex-row items-center justify-between px-5 py-4">
            <Text className="text-sm font-medium text-muted">Category</Text>
            <View className="flex-row items-center gap-2">
              {category && (
                <View
                  className="w-6 h-6 rounded-full items-center justify-center"
                  style={{ backgroundColor: category.color }}
                >
                  <Ionicons
                    name={(category.icon as IoniconName) ?? "pricetag"}
                    size={13}
                    color="white"
                  />
                </View>
              )}
              <Text className="text-sm font-semibold text-foreground">
                {category?.name ?? "Uncategorized"}
              </Text>
            </View>
          </View>

          <View style={{ height: 0.5, backgroundColor: colors.border }} />

          {/* Account — hidden only when the user has no accounts and this
              transaction has none assigned (nothing to pick or clear). */}
          {accounts.length > 0 || currentAccountId !== null ? (
            <>
              <View className="px-5 py-4" testID="transaction-account-picker">
                <Text className="text-sm font-medium text-muted">Account</Text>
                {selectedAccountMissing ? (
                  <Text className="text-xs text-warning mt-1">
                    The assigned account is no longer available. Pick another or
                    choose “No account”.
                  </Text>
                ) : null}
                <View style={{ gap: 8, marginTop: 12 }}>
                  <Pressable
                    onPress={() => setSelectedAccountId(null)}
                    accessibilityRole="radio"
                    accessibilityLabel="Account No account"
                    accessibilityState={{
                      selected: selectedAccountId === null,
                    }}
                    className="flex-row items-center justify-between rounded-xl px-4 py-3"
                    style={{
                      borderWidth: 0.5,
                      borderColor:
                        selectedAccountId === null
                          ? colors.primary
                          : colors.border,
                      backgroundColor:
                        selectedAccountId === null
                          ? colors.primary + "12"
                          : colors.background,
                    }}
                  >
                    <Text className="text-sm font-semibold text-foreground">
                      No account
                    </Text>
                    {selectedAccountId === null ? (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={colors.primary}
                      />
                    ) : null}
                  </Pressable>
                  {accounts.map((account) => {
                    const selected = selectedAccountId === account.id;
                    return (
                      <Pressable
                        key={account.id}
                        onPress={() => setSelectedAccountId(account.id)}
                        accessibilityRole="radio"
                        accessibilityLabel={`Account ${account.name}, ${account.currency}`}
                        accessibilityState={{ selected }}
                        className="flex-row items-center justify-between rounded-xl px-4 py-3"
                        style={{
                          borderWidth: 0.5,
                          borderColor: selected
                            ? colors.primary
                            : colors.border,
                          backgroundColor: selected
                            ? colors.primary + "12"
                            : colors.background,
                        }}
                      >
                        <View>
                          <Text className="text-sm font-semibold text-foreground">
                            {account.name}
                          </Text>
                          <Text className="text-xs text-muted">
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
                  <Pressable
                    onPress={() => void handleSaveAccount()}
                    disabled={!isAccountDirty}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !isAccountDirty }}
                    className="items-center justify-center rounded-xl px-4 py-3"
                    style={{
                      backgroundColor: colors.primary,
                      opacity: isAccountDirty ? 1 : 0.5,
                    }}
                  >
                    <Text className="text-sm font-semibold text-white">
                      Save account
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={{ height: 0.5, backgroundColor: colors.border }} />
            </>
          ) : null}

          {/* Date */}
          <View className="flex-row items-center justify-between px-5 py-4">
            <Text className="text-sm font-medium text-muted">Date</Text>
            <Text className="text-sm font-semibold text-foreground">
              {formatDate(transaction.date)}
            </Text>
          </View>

          {transaction.description ? (
            <>
              <View style={{ height: 0.5, backgroundColor: colors.border }} />
              {/* Description */}
              <View className="px-5 py-4">
                <Text className="text-sm font-medium text-muted mb-1.5">
                  Description
                </Text>
                <Text className="text-sm text-foreground leading-5">
                  {transaction.description}
                </Text>
              </View>
            </>
          ) : null}
        </Animated.View>
      </ScrollView>

      {/* Mounted only while open: the sheet pulls in theme/currency/toast
       * hooks that a closed sheet has no use for. */}
      {editing ? (
        <TransactionEditSheet
          visible
          transaction={transaction}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </ScreenContainer>
  );
}

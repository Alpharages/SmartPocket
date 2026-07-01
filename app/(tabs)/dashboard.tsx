import React, { useMemo } from "react";
import {
  RefreshControl,
  ScrollView,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { ResponsiveContent } from "@/components/responsive-content";
import { useExpense } from "@/lib/expense-context";
import { useColors } from "@/hooks/use-colors";
import { useBreakpoints } from "@/hooks/use-breakpoint";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import {
  ScreenHeader,
  StatCard,
  Button,
  TransactionRow,
  EmptyState,
} from "@/components/ui";
import { ContentMaxWidth, Spacing } from "@/lib/_core/theme";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";

export default function DashboardScreen() {
  const router = useRouter();
  const colors = useColors();
  const { isLg } = useBreakpoints();
  const {
    transactions,
    monthlyStats,
    categories,
    loadingTransactions,
    loadingStats,
    refreshAll,
  } = useExpense();

  const refreshProps = usePullToRefresh(refreshAll);

  const recentTransactions = useMemo(
    () => transactions.slice(0, 5),
    [transactions],
  );

  // All-time net across every transaction (income − expense), for the hero card.
  // ponytail: client-side float sum, mirrors getMonthlyStats/reduceAccountBalances.
  // transactions.list is uncapped so this is the full history; move to a
  // summary.allTimeStats query if that list ever becomes paginated.
  const allTimeBalance = useMemo(
    () =>
      transactions.reduce((net, t) => {
        const amount = Number(t.amount);
        if (!Number.isFinite(amount)) return net;
        return t.type === "income" ? net + amount : net - amount;
      }, 0),
    [transactions],
  );

  const categoriesById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories],
  );

  const formattedDate = useMemo(
    () =>
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      }),
    [],
  );

  const recentActivityPane = (
    <Animated.View
      entering={FadeInUp.delay(300).duration(500)}
      style={
        isLg
          ? { flex: 1 }
          : { marginTop: Spacing["2xl"], paddingHorizontal: Spacing["2xl"] }
      }
    >
      <View className="flex-row items-center justify-between mb-lg">
        <Text className="text-h3 font-bold text-foreground">
          Recent Activity
        </Text>
        <Pressable
          onPress={() => router.push("/transactions")}
          accessibilityRole="button"
          accessibilityLabel="View all transactions"
          hitSlop={8}
          className="flex-row items-center gap-xs"
          style={{ minHeight: 44, alignItems: "center" }}
        >
          <Text className="text-primary font-semibold text-label">
            View All
          </Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </Pressable>
      </View>

      {loadingTransactions ? (
        <View className="items-center justify-center py-2xl">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : recentTransactions.length > 0 ? (
        <View
          className="rounded-3xl overflow-hidden"
          style={{
            backgroundColor: colors.surface,
            shadowColor: colors.foreground,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <FlatList
            data={recentTransactions}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item, index }) => {
              const category = categoriesById[item.categoryId];
              return (
                <Animated.View
                  entering={FadeInDown.delay(index * 40).duration(400)}
                >
                  <TransactionRow
                    title={category?.name ?? `Category ${item.categoryId}`}
                    date={item.date}
                    amount={item.amount}
                    type={item.type}
                    categoryColor={category?.color ?? colors.muted}
                    categoryIcon={
                      (category?.icon as keyof typeof Ionicons.glyphMap) ??
                      "pricetag-outline"
                    }
                  />
                </Animated.View>
              );
            }}
            scrollEnabled={false}
            ItemSeparatorComponent={() => (
              <View
                className="mx-lg"
                style={{ height: 0.5, backgroundColor: colors.border }}
              />
            )}
          />
        </View>
      ) : (
        <EmptyState
          icon={
            <Ionicons name="wallet-outline" size={28} color={colors.muted} />
          }
          title="No transactions yet"
          description="Start by adding your first transaction"
        />
      )}
    </Animated.View>
  );

  const statsPane = (
    <Animated.View
      entering={FadeInDown.delay(100).duration(600)}
      style={
        isLg
          ? { flex: 1, paddingHorizontal: Spacing["2xl"] }
          : { paddingHorizontal: Spacing["2xl"], marginTop: Spacing.sm }
      }
    >
      {/* Hero balance card — all-time net across all transactions */}
      <StatCard
        variant="hero"
        label="Total Balance"
        amount={allTimeBalance}
        sign="neutral"
        loading={loadingTransactions}
      />

      {/* This Month / Income / Expense compact trio */}
      <Animated.View
        entering={FadeInUp.delay(150).duration(500)}
        className="flex-row"
        style={{ gap: Spacing.md, marginTop: Spacing.md }}
      >
        <StatCard
          variant="compact"
          label="This Month"
          amount={monthlyStats?.netBalance ?? 0}
          sign="neutral"
          icon="wallet-outline"
          loading={loadingStats}
        />
        <StatCard
          variant="compact"
          label="Income"
          amount={monthlyStats?.totalIncome ?? 0}
          sign="positive"
          icon="arrow-down"
          loading={loadingStats}
        />
        <StatCard
          variant="compact"
          label="Expenses"
          amount={monthlyStats?.totalExpense ?? 0}
          sign="negative"
          icon="arrow-up"
          loading={loadingStats}
        />
      </Animated.View>

      {/* Quick action buttons */}
      <Animated.View
        entering={FadeInUp.delay(200).duration(500)}
        className="flex-row"
        style={{ gap: Spacing.md, marginTop: Spacing.lg }}
      >
        <Button
          variant="income"
          label="Add Income"
          onPress={() => router.push("/add-transaction?type=income")}
          className="flex-1"
          size="lg"
        />
        <Button
          variant="destructive"
          label="Add Expense"
          onPress={() => router.push("/add-transaction?type=expense")}
          className="flex-1"
          size="lg"
        />
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(250).duration(500)}>
        <Button
          variant="secondary"
          label="Budgets"
          onPress={() => router.push("/budgets")}
          className="mt-md"
          size="lg"
          leftIcon={
            <Ionicons
              name="pie-chart-outline"
              size={18}
              color={colors.foreground}
            />
          }
          testID="dashboard-budgets-button"
        />
      </Animated.View>
    </Animated.View>
  );

  return (
    <ScreenContainer className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl {...refreshProps} />}
      >
        <ResponsiveContent maxWidth={ContentMaxWidth.dashboard}>
          {/* Header */}
          <Animated.View entering={FadeInDown.duration(500)}>
            <ScreenHeader
              title="Home"
              subtitle={formattedDate}
              accessibilityLabel="Home screen"
              action={
                <Button
                  variant="icon-only"
                  accessibilityLabel="Open settings"
                  onPress={() => router.push("/settings")}
                  leftIcon={
                    <Ionicons
                      name="settings-outline"
                      size={22}
                      color={colors.foreground}
                    />
                  }
                />
              }
            />
          </Animated.View>

          {isLg ? (
            /* Two-pane layout: stats left, recent activity right */
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: Spacing["2xl"],
                paddingTop: Spacing.sm,
              }}
            >
              {statsPane}
              {recentActivityPane}
            </View>
          ) : (
            /* Single-column layout for phones */
            <>
              {statsPane}
              {recentActivityPane}
            </>
          )}
        </ResponsiveContent>
      </ScrollView>
    </ScreenContainer>
  );
}

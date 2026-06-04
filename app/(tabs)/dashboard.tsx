import React, { useMemo } from "react";
import { ScrollView, View, Text, Pressable, ActivityIndicator, FlatList } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useExpense } from "@/lib/expense-context";
import { useColors } from "@/hooks/use-colors";
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

export default function DashboardScreen() {
  const router = useRouter();
  const colors = useColors();
  const {
    transactions,
    monthlyStats,
    categories,
    loadingTransactions,
    loadingStats,
  } = useExpense();

  const recentTransactions = useMemo(() => transactions.slice(0, 5), [transactions]);

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

  return (
    <ScreenContainer className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(500)}>
          <ScreenHeader title="Home" subtitle={formattedDate} />
        </Animated.View>

        {/* Balance + Quick Actions — all in one container so no shadow bleeds between sections */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(600)}
          className="px-2xl gap-md mt-sm"
        >
          {/* Hero balance card */}
          <StatCard
            variant="hero"
            label="Total Balance"
            amount={monthlyStats?.netBalance ?? 0}
            sign="neutral"
            loading={loadingStats}
          />

          {/* Income / Expense compact pair */}
          <Animated.View
            entering={FadeInUp.delay(150).duration(500)}
            className="flex-row gap-md"
          >
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

          {/* Quick action buttons — token spacing clears the hero card shadow */}
          <Animated.View
            entering={FadeInUp.delay(200).duration(500)}
            className="flex-row gap-md mt-sm"
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
        </Animated.View>

        {/* Recent Transactions */}
        <Animated.View
          entering={FadeInUp.delay(300).duration(500)}
          className="px-2xl mt-2xl"
        >
          <View className="flex-row items-center justify-between mb-lg">
            <Text className="text-h3 font-bold text-foreground">
              Recent Activity
            </Text>
            <Pressable
              onPress={() => router.push("/transactions")}
              className="flex-row items-center gap-xs"
            >
              <Text className="text-primary font-semibold text-label">
                View All
              </Text>
              <Ionicons
                name="chevron-forward"
                size={14}
                color={colors.primary}
              />
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
      </ScrollView>
    </ScreenContainer>
  );
}

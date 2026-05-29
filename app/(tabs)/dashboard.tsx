import { ScrollView, View, Text, Pressable, ActivityIndicator, FlatList } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useExpense } from "@/lib/expense-context";
import { useColors } from "@/hooks/use-colors";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect } from "react";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

interface DashboardStats {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
}

export default function DashboardScreen() {
  const router = useRouter();
  const colors = useColors();
  const { transactions, monthlyStats, loadingTransactions, loadingStats } = useExpense();
  const [stats, setStats] = useState<DashboardStats>({
    totalIncome: 0,
    totalExpense: 0,
    netBalance: 0,
  });

  useEffect(() => {
    if (monthlyStats) {
      setStats({
        totalIncome: monthlyStats.totalIncome,
        totalExpense: monthlyStats.totalExpense,
        netBalance: monthlyStats.netBalance,
      });
    }
  }, [monthlyStats]);

  const recentTransactions = transactions.slice(0, 5);

  return (
    <ScreenContainer className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(500)} className="px-6 pt-6 pb-2">
          <Text className="text-[28px] font-bold text-foreground">Expense Tracker</Text>
          <Text className="text-sm text-muted font-medium mt-1">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </Text>
        </Animated.View>

        {/* Balance Card */}
        <View className="px-6 mt-6">
          {loadingStats ? (
            <View className="h-48 rounded-3xl items-center justify-center" style={{ backgroundColor: colors.surface }}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <Animated.View
              entering={FadeInDown.delay(100).duration(600)}
              className="rounded-3xl p-6 overflow-hidden"
              style={{
                backgroundColor: colors.primary,
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.25,
                shadowRadius: 16,
                elevation: 8,
              }}
            >
              <View>
                <Text className="text-white/70 text-sm font-medium">Total Balance</Text>
                <Text className="text-[42px] font-bold text-white mt-2 tracking-tight">
                  ${Math.abs(stats.netBalance).toFixed(2)}
                </Text>

                <View className="flex-row mt-6 gap-4">
                  <View className="flex-1 rounded-2xl p-4" style={{ backgroundColor: "rgba(255,255,255,0.12)" }}>
                    <View className="flex-row items-center gap-1.5 mb-1">
                      <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.2)" }}>
                        <Ionicons name="arrow-down" size={12} color="white" />
                      </View>
                      <Text className="text-white/70 text-xs font-medium">Income</Text>
                    </View>
                    <Text className="text-white font-bold text-base">
                      +${stats.totalIncome.toFixed(2)}
                    </Text>
                  </View>

                  <View className="flex-1 rounded-2xl p-4" style={{ backgroundColor: "rgba(255,255,255,0.12)" }}>
                    <View className="flex-row items-center gap-1.5 mb-1">
                      <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.2)" }}>
                        <Ionicons name="arrow-up" size={12} color="white" />
                      </View>
                      <Text className="text-white/70 text-xs font-medium">Expenses</Text>
                    </View>
                    <Text className="text-white font-bold text-base">
                      -${stats.totalExpense.toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>
            </Animated.View>
          )}
        </View>

        {/* Quick Actions */}
        <Animated.View entering={FadeInUp.delay(200).duration(500)} className="px-6 mt-6">
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => router.push("/add-transaction?type=income")}
              style={{ backgroundColor: colors.success + "14" }}
              className="flex-1 flex-row items-center justify-center gap-2 py-4 rounded-2xl active:opacity-80"
            >
              <View className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: colors.success + "24" }}>
                <Ionicons name="add" size={16} color={colors.success} />
              </View>
              <Text className="text-success font-semibold text-sm">Add Income</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push("/add-transaction?type=expense")}
              style={{ backgroundColor: colors.error + "14" }}
              className="flex-1 flex-row items-center justify-center gap-2 py-4 rounded-2xl active:opacity-80"
            >
              <View className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: colors.error + "24" }}>
                <Ionicons name="remove" size={16} color={colors.error} />
              </View>
              <Text className="text-error font-semibold text-sm">Add Expense</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Recent Transactions */}
        <Animated.View entering={FadeInUp.delay(300).duration(500)} className="px-6 mt-8">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-bold text-foreground">Recent Activity</Text>
            <Pressable onPress={() => router.push("/transactions")} className="flex-row items-center gap-0.5">
              <Text className="text-primary font-semibold text-sm">View All</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </Pressable>
          </View>

          {loadingTransactions ? (
            <View className="items-center justify-center py-12">
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
                  const isIncome = item.type === "income";
                  const categoryName = item.categoryId ? `Category ${item.categoryId}` : "Uncategorized";

                  return (
                    <Animated.View
                      entering={FadeInDown.delay(index * 40).duration(400)}
                      className="flex-row items-center justify-between py-3.5 px-4"
                    >
                      <View className="flex-row items-center gap-3 flex-1">
                        <View
                          className="w-10 h-10 rounded-full items-center justify-center"
                          style={{
                            backgroundColor: isIncome ? colors.success + "18" : colors.error + "18",
                          }}
                        >
                          <Ionicons
                            name={isIncome ? "arrow-down" : "arrow-up"}
                            size={16}
                            color={isIncome ? colors.success : colors.error}
                          />
                        </View>
                        <View className="flex-1">
                          <Text className="text-foreground font-semibold text-sm">{categoryName}</Text>
                          <Text className="text-xs text-muted mt-0.5">
                            {new Date(item.date).toLocaleDateString()}
                          </Text>
                        </View>
                      </View>
                      <Text
                        className="font-bold text-sm"
                        style={{ color: isIncome ? colors.success : colors.error }}
                      >
                        {isIncome ? "+" : "-"}${Math.abs(parseFloat(item.amount)).toFixed(2)}
                      </Text>
                    </Animated.View>
                  );
                }}
                scrollEnabled={false}
                ItemSeparatorComponent={() => (
                  <View className="mx-4" style={{ height: 0.5, backgroundColor: colors.border }} />
                )}
              />
            </View>
          ) : (
            <View className="items-center justify-center py-12 rounded-3xl" style={{ backgroundColor: colors.surface }}>
              <View
                className="w-14 h-14 rounded-full items-center justify-center mb-3"
                style={{ backgroundColor: colors.border }}
              >
                <Ionicons name="wallet-outline" size={28} color={colors.muted} />
              </View>
              <Text className="text-muted font-medium text-sm">No transactions yet</Text>
              <Text className="text-xs text-muted mt-1">Start by adding your first transaction</Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </ScreenContainer>
  );
}

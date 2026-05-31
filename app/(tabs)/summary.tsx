import {
  ScrollView,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  FlatList,
  StyleSheet,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useExpense } from "@/lib/expense-context";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  getCategoryColorByIndex,
  resolveCategoryColor,
} from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

export default function SummaryScreen() {
  const colors = useColors();
  const scheme = (useColorScheme() ?? "light") as "light" | "dark";
  const { monthlyStats, loadingStats, refreshMonthlyStats, categories } =
    useExpense();
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const expensesByCategoryQuery = trpc.summary.expensesByCategory.useQuery({
    year,
    month,
  });

  const handlePreviousMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentDate(newDate);
    refreshMonthlyStats(newDate.getFullYear(), newDate.getMonth() + 1);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentDate(newDate);
    refreshMonthlyStats(newDate.getFullYear(), newDate.getMonth() + 1);
  };

  const monthLabel = currentDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const totalExpenses = useMemo(() => {
    if (!expensesByCategoryQuery.data) return 0;
    return expensesByCategoryQuery.data.reduce(
      (sum, item) => sum + item.total,
      0,
    );
  }, [expensesByCategoryQuery.data]);

  const isCurrentMonth =
    currentDate.getMonth() === new Date().getMonth() &&
    currentDate.getFullYear() === new Date().getFullYear();

  return (
    <ScreenContainer className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Header */}
        <Animated.View
          entering={FadeInDown.duration(500)}
          className="px-6 pt-6 pb-2"
        >
          <Text className="text-[28px] font-bold text-foreground">
            Insights
          </Text>
          <Text className="text-sm text-muted font-medium mt-1">
            Monthly breakdown
          </Text>
        </Animated.View>

        {/* Month Navigation */}
        <Animated.View
          entering={FadeInUp.delay(100).duration(500)}
          className="px-6 mt-5"
        >
          <View className="flex-row items-center justify-between">
            <Pressable
              onPress={handlePreviousMonth}
              hitSlop={8}
              style={{
                backgroundColor: colors.surface,
                borderWidth: 0.5,
                borderColor: colors.border,
              }}
              className="w-10 h-10 rounded-full items-center justify-center active:opacity-70"
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color={colors.foreground}
              />
            </Pressable>

            <View className="items-center">
              <Text className="text-base font-bold text-foreground">
                {monthLabel}
              </Text>
              {isCurrentMonth && (
                <View
                  className="px-2 py-0.5 rounded-full mt-1"
                  style={{ backgroundColor: colors.primary + "18" }}
                >
                  <Text
                    className="text-[10px] font-semibold"
                    style={{ color: colors.primary }}
                  >
                    Current
                  </Text>
                </View>
              )}
            </View>

            <Pressable
              onPress={handleNextMonth}
              hitSlop={8}
              style={{
                backgroundColor: colors.surface,
                borderWidth: 0.5,
                borderColor: colors.border,
              }}
              className="w-10 h-10 rounded-full items-center justify-center active:opacity-70"
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.foreground}
              />
            </Pressable>
          </View>
        </Animated.View>

        {/* Stats Cards */}
        <View className="px-6 mt-6">
          {loadingStats ? (
            <View className="items-center justify-center py-12">
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <Animated.View
              entering={FadeInUp.delay(150).duration(500)}
              className="flex-row gap-3"
            >
              <View
                className="flex-1 rounded-2xl p-4 gap-2"
                style={{
                  backgroundColor: colors.surface,
                  shadowColor: colors.foreground,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.04,
                  shadowRadius: 6,
                  elevation: 2,
                }}
              >
                <View
                  className="w-8 h-8 rounded-full items-center justify-center"
                  style={{ backgroundColor: colors.primary + "14" }}
                >
                  <Ionicons
                    name="wallet-outline"
                    size={16}
                    color={colors.primary}
                  />
                </View>
                <Text className="text-xs text-muted font-medium mt-1">
                  Balance
                </Text>
                <Text
                  className="text-lg font-bold"
                  style={{ color: colors.primary }}
                >
                  ${Math.abs(monthlyStats?.netBalance || 0).toFixed(2)}
                </Text>
              </View>

              <View
                className="flex-1 rounded-2xl p-4 gap-2"
                style={{
                  backgroundColor: colors.surface,
                  shadowColor: colors.foreground,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.04,
                  shadowRadius: 6,
                  elevation: 2,
                }}
              >
                <View
                  className="w-8 h-8 rounded-full items-center justify-center"
                  style={{ backgroundColor: colors.success + "14" }}
                >
                  <Ionicons
                    name="arrow-down"
                    size={16}
                    color={colors.success}
                  />
                </View>
                <Text className="text-xs text-muted font-medium mt-1">
                  Income
                </Text>
                <Text
                  className="text-lg font-bold"
                  style={{ color: colors.success }}
                >
                  +${(monthlyStats?.totalIncome || 0).toFixed(2)}
                </Text>
              </View>

              <View
                className="flex-1 rounded-2xl p-4 gap-2"
                style={{
                  backgroundColor: colors.surface,
                  shadowColor: colors.foreground,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.04,
                  shadowRadius: 6,
                  elevation: 2,
                }}
              >
                <View
                  className="w-8 h-8 rounded-full items-center justify-center"
                  style={{ backgroundColor: colors.error + "14" }}
                >
                  <Ionicons name="arrow-up" size={16} color={colors.error} />
                </View>
                <Text className="text-xs text-muted font-medium mt-1">
                  Expenses
                </Text>
                <Text
                  className="text-lg font-bold"
                  style={{ color: colors.error }}
                >
                  -${(monthlyStats?.totalExpense || 0).toFixed(2)}
                </Text>
              </View>
            </Animated.View>
          )}
        </View>

        {/* Category Breakdown */}
        <Animated.View
          entering={FadeInUp.delay(200).duration(500)}
          className="px-6 mt-8"
        >
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-bold text-foreground">
              Spending by Category
            </Text>
            {expensesByCategoryQuery.isLoading && (
              <ActivityIndicator size="small" color={colors.primary} />
            )}
          </View>

          {expensesByCategoryQuery.isLoading ? (
            <View
              className="items-center justify-center py-12 rounded-3xl"
              style={{ backgroundColor: colors.surface }}
            >
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : expensesByCategoryQuery.data &&
            expensesByCategoryQuery.data.length > 0 ? (
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
                data={expensesByCategoryQuery.data}
                keyExtractor={(item) => item.categoryId.toString()}
                renderItem={({ item, index }) => {
                  const percentage =
                    totalExpenses > 0 ? (item.total / totalExpenses) * 100 : 0;
                  const category = categories.find(
                    (c) => c.id === item.categoryId,
                  );
                  const categoryName =
                    category?.name || `Category ${item.categoryId}`;
                  const categoryColor = category?.color
                    ? resolveCategoryColor(category.color, scheme)
                    : getCategoryColorByIndex(item.categoryId, scheme);

                  return (
                    <Animated.View
                      entering={FadeInDown.delay(index * 30).duration(400)}
                    >
                      <View className="py-4 px-4">
                        <View className="flex-row items-center justify-between mb-2">
                          <View className="flex-row items-center gap-3 flex-1">
                            <View
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: categoryColor }}
                            />
                            <Text className="text-foreground font-semibold text-sm flex-1">
                              {categoryName}
                            </Text>
                          </View>
                          <View className="items-end">
                            <Text className="text-foreground font-bold text-sm">
                              ${item.total.toFixed(2)}
                            </Text>
                            <Text className="text-xs text-muted">
                              {percentage.toFixed(1)}%
                            </Text>
                          </View>
                        </View>
                        <View
                          className="h-1.5 rounded-full overflow-hidden"
                          style={{ backgroundColor: colors.border }}
                        >
                          <View
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.max(percentage, 2)}%`,
                              backgroundColor: categoryColor,
                            }}
                          />
                        </View>
                      </View>
                    </Animated.View>
                  );
                }}
                scrollEnabled={false}
                ItemSeparatorComponent={() => (
                  <View
                    className="mx-4"
                    style={{ height: 0.5, backgroundColor: colors.border }}
                  />
                )}
              />
            </View>
          ) : (
            <View
              className="rounded-3xl p-8 items-center"
              style={{ backgroundColor: colors.surface }}
            >
              <Ionicons
                name="pie-chart-outline"
                size={36}
                color={colors.muted}
              />
              <Text className="text-muted font-medium mt-3 text-sm">
                No spending data
              </Text>
              <Text className="text-xs text-muted mt-1">
                Add transactions to see breakdown
              </Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </ScreenContainer>
  );
}

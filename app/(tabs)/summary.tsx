import { ScrollView, View, Text, Pressable, FlatList } from "react-native";
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
import { CategoryToken, ScreenHeader, Skeleton, StatCard } from "@/components/ui";
import { useBreakpoints } from "@/hooks/use-breakpoint";
import { Spacing } from "@/lib/_core/theme";

export default function SummaryScreen() {
  const colors = useColors();
  const scheme = (useColorScheme() ?? "light") as "light" | "dark";
  const { monthlyStats, loadingStats, refreshMonthlyStats, categories } =
    useExpense();
  const { isLg } = useBreakpoints();
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

  const monthNav = (
        <Animated.View
          entering={FadeInUp.delay(100).duration(500)}
          className="px-2xl mt-lg"
        >
          <View className="flex-row items-center justify-between">
            <Pressable
              onPress={handlePreviousMonth}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              style={{
                backgroundColor: colors.surface,
                borderWidth: 0.5,
                borderColor: colors.border,
                minWidth: 44,
                minHeight: 44,
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
                  className="px-2 py-0.5 rounded-full mt-xs"
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
              accessibilityRole="button"
              accessibilityLabel="Next month"
              style={{
                backgroundColor: colors.surface,
                borderWidth: 0.5,
                borderColor: colors.border,
                minWidth: 44,
                minHeight: 44,
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

  );

  const statsPane = (
        <View className="px-2xl mt-2xl">
          <Animated.View
            entering={FadeInUp.delay(150).duration(500)}
            className="flex-row gap-md"
          >
            <StatCard
              variant="compact"
              label="Balance"
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
        </View>
  );

  const categoryPane = (
        <Animated.View
          entering={FadeInUp.delay(200).duration(500)}
          className="px-2xl mt-2xl"
        >
          <View className="flex-row items-center justify-between mb-lg">
            <Text className="text-h3 font-bold text-foreground">
              Spending by Category
            </Text>
          </View>

          {expensesByCategoryQuery.isLoading ? (
            <View
              className="rounded-3xl overflow-hidden px-4"
              style={{ backgroundColor: colors.surface }}
            >
              {[0, 1, 2].map((i) => (
                <View key={i}>
                  <View className="py-4 gap-2">
                    <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-md flex-1">
                        <Skeleton variant="circle" width={32} height={32} />
                        <View className="gap-1 flex-1">
                          <Skeleton variant="line" width="55%" height={14} />
                          <Skeleton variant="line" width="30%" height={11} />
                        </View>
                      </View>
                      <View className="items-end gap-1">
                        <Skeleton variant="line" width={60} height={14} />
                        <Skeleton variant="line" width={36} height={11} />
                      </View>
                    </View>
                    <Skeleton variant="line" height={6} />
                  </View>
                  {i < 2 && (
                    <View
                      style={{ height: 0.5, backgroundColor: colors.border }}
                    />
                  )}
                </View>
              ))}
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
                          <CategoryToken
                            color={categoryColor}
                            icon={category?.icon || "pricetag-outline"}
                            name={categoryName}
                            type={category?.type ?? "expense"}
                            size="sm"
                            className="flex-1"
                          />
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
                    className="mx-lg"
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
              <Text className="text-xs text-muted mt-xs">
                Add transactions to see breakdown
              </Text>
            </View>
          )}
        </Animated.View>
  );

  const header = (
    <Animated.View entering={FadeInDown.duration(500)}>
      <ScreenHeader title="Insights" subtitle="Monthly breakdown" />
    </Animated.View>
  );

  if (isLg) {
    return (
      <ScreenContainer className="flex-row bg-background">
        {/* Left pane: header + month nav + stat cards */}
        <ScrollView
          style={{
            width: 320,
            borderRightWidth: 0.5,
            borderRightColor: colors.border,
          }}
          contentContainerStyle={{ paddingBottom: Spacing["2xl"] }}
          showsVerticalScrollIndicator={false}
        >
          {header}
          {monthNav}
          {statsPane}
        </ScrollView>

        {/* Right pane: category breakdown */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: Spacing["2xl"] }}
          showsVerticalScrollIndicator={false}
        >
          {categoryPane}
        </ScrollView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {header}
        {monthNav}
        {statsPane}
        {categoryPane}
      </ScrollView>
    </ScreenContainer>
  );
}

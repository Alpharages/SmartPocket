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
import { useEffect, useState, useMemo } from "react";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import {
  CategoryToken,
  EmptyState,
  ScreenHeader,
  Skeleton,
  StatCard,
  TransactionRow,
  TwoPaneLayout,
} from "@/components/ui";
import { useBreakpoints } from "@/hooks/use-breakpoint";
import { Spacing, Typography } from "@/lib/_core/theme";
import { readableTextOn } from "@/lib/_core/contrast";

export default function SummaryScreen() {
  const colors = useColors();
  const scheme = (useColorScheme() ?? "light") as "light" | "dark";
  const {
    monthlyStats,
    loadingStats,
    loadingTransactions,
    refreshMonthlyStats,
    categories,
    transactions,
  } = useExpense();
  const { isLg } = useBreakpoints();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null,
  );

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const handlePreviousMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentDate(newDate);
    refreshMonthlyStats(newDate.getFullYear(), newDate.getMonth() + 1);
    setSelectedCategoryId(null);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentDate(newDate);
    refreshMonthlyStats(newDate.getFullYear(), newDate.getMonth() + 1);
    setSelectedCategoryId(null);
  };

  const monthLabel = currentDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const isCurrentMonth =
    currentDate.getMonth() === new Date().getMonth() &&
    currentDate.getFullYear() === new Date().getFullYear();

  // Filter transactions to current month for the category detail pane.
  const monthTransactions = useMemo(() => {
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
    return transactions.filter((t) => {
      const d = new Date(t.date);
      return d >= startOfMonth && d <= endOfMonth;
    });
  }, [transactions, year, month]);

  const selectedCategoryTransactions = useMemo(() => {
    if (selectedCategoryId == null) return [];
    return monthTransactions
      .filter((t) => t.categoryId === selectedCategoryId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [monthTransactions, selectedCategoryId]);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId),
    [categories, selectedCategoryId],
  );
  const selectedCategoryColor = selectedCategory?.color
    ? resolveCategoryColor(selectedCategory.color, scheme)
    : selectedCategory
      ? getCategoryColorByIndex(selectedCategory.id, scheme)
      : colors.muted;

  // Clear the selection if the selected category no longer exists (e.g. deleted).
  useEffect(() => {
    if (selectedCategoryId != null && !selectedCategory) {
      setSelectedCategoryId(null);
    }
  }, [selectedCategoryId, selectedCategory]);

  const categoryById = useMemo(() => {
    const map = new Map<number, (typeof categories)[number]>();
    for (const cat of categories) map.set(cat.id, cat);
    return map;
  }, [categories]);

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
          <Ionicons name="chevron-back" size={20} color={colors.foreground} />
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
                className="font-semibold"
                style={{
                  color: colors.primary,
                  fontSize: Typography.micro.fontSize,
                  lineHeight: Typography.micro.lineHeight,
                }}
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

  // Category list data derived from monthly expenses query.
  const categoryExpenses = useMemo(() => {
    const map = new Map<number, number>();
    for (const t of monthTransactions) {
      if (t.type === "expense") {
        map.set(
          t.categoryId,
          (map.get(t.categoryId) ?? 0) + parseFloat(t.amount),
        );
      }
    }
    return Array.from(map.entries())
      .map(([categoryId, total]) => {
        const category = categories.find((c) => c.id === categoryId);
        return {
          categoryId,
          total,
          categoryName: category?.name ?? `Category ${categoryId}`,
          categoryColor: category?.color
            ? resolveCategoryColor(category.color, scheme)
            : getCategoryColorByIndex(categoryId, scheme),
          categoryIcon: category?.icon ?? "pricetag-outline",
          type: category?.type ?? "expense",
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [monthTransactions, categories, scheme]);

  const totalExpenses = useMemo(
    () => categoryExpenses.reduce((sum, item) => sum + item.total, 0),
    [categoryExpenses],
  );

  const handleCategoryPress = (categoryId: number) => {
    if (isLg) {
      setSelectedCategoryId((prev) =>
        prev === categoryId ? null : categoryId,
      );
    }
  };

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

      {loadingTransactions && categoryExpenses.length === 0 ? (
        <View
          className="rounded-3xl p-4"
          style={{ backgroundColor: colors.surface }}
          accessibilityLabel="Loading spending breakdown"
        >
          {[0, 1, 2, 3].map((i) => (
            <View key={i} className="py-2">
              <View className="flex-row items-center justify-between mb-2">
                <Skeleton variant="line" width="50%" height={14} />
                <Skeleton variant="line" width={48} height={14} />
              </View>
              <Skeleton variant="line" width="100%" height={6} radius={3} />
            </View>
          ))}
        </View>
      ) : categoryExpenses.length === 0 ? (
        <View
          className="rounded-3xl p-8 items-center"
          style={{ backgroundColor: colors.surface }}
        >
          <Ionicons name="pie-chart-outline" size={36} color={colors.muted} />
          <Text className="text-muted font-medium mt-3 text-sm">
            No spending data
          </Text>
          <Text className="text-xs text-muted mt-xs">
            Add transactions to see breakdown
          </Text>
        </View>
      ) : (
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
            data={categoryExpenses}
            keyExtractor={(item) => item.categoryId.toString()}
            renderItem={({ item, index }) => {
              const percentage =
                totalExpenses > 0 ? (item.total / totalExpenses) * 100 : 0;
              const isSelected = selectedCategoryId === item.categoryId;
              const rowContent = (
                <View className="py-4 px-4">
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center gap-3 flex-1 mr-3">
                      <CategoryToken
                        color={item.categoryColor}
                        icon={item.categoryIcon}
                        name={item.categoryName}
                        size="sm"
                      />
                      <Text
                        className="text-foreground font-semibold text-sm flex-1"
                        numberOfLines={1}
                      >
                        {item.categoryName}
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
                        backgroundColor: item.categoryColor,
                      }}
                    />
                  </View>
                </View>
              );

              return (
                <Animated.View
                  entering={FadeInDown.delay(index * 30).duration(400)}
                >
                  {isLg ? (
                    <Pressable
                      onPress={() => handleCategoryPress(item.categoryId)}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.categoryName}, $${item.total.toFixed(2)}, ${percentage.toFixed(1)} percent`}
                      accessibilityState={{ selected: isSelected }}
                      style={{
                        backgroundColor: isSelected
                          ? colors.primary + "0D"
                          : undefined,
                      }}
                    >
                      {rowContent}
                    </Pressable>
                  ) : (
                    <View style={{ backgroundColor: colors.surface }}>
                      {rowContent}
                    </View>
                  )}
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
      )}
    </Animated.View>
  );

  const header = (
    <Animated.View entering={FadeInDown.duration(500)}>
      <ScreenHeader title="Insights" subtitle="Monthly breakdown" />
    </Animated.View>
  );

  // Detail pane for the selected category.
  const categoryDetailPane = (
    <View className="flex-1">
      {selectedCategory ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: Spacing["2xl"] }}
        >
          {/* Detail header */}
          <View className="px-6 pt-6 pb-2">
            <View className="flex-row items-center gap-3">
              <View
                className="w-10 h-10 rounded-full items-center justify-center"
                style={{ backgroundColor: selectedCategoryColor }}
              >
                <Ionicons
                  name={
                    (selectedCategory.icon as React.ComponentProps<
                      typeof Ionicons
                    >["name"]) ?? "pricetag"
                  }
                  size={18}
                  color={readableTextOn(selectedCategoryColor)}
                />
              </View>
              <View>
                <Text className="text-h2 font-bold text-foreground">
                  {selectedCategory.name}
                </Text>
                <Text className="text-sm text-muted">
                  {selectedCategoryTransactions.length} transaction
                  {selectedCategoryTransactions.length !== 1 ? "s" : ""}
                </Text>
              </View>
            </View>
          </View>

          {/* Transaction list */}
          {selectedCategoryTransactions.length > 0 ? (
            <View className="mt-4 px-6">
              {selectedCategoryTransactions.map((t) => {
                const cat = categoryById.get(t.categoryId);
                const categoryColor = cat?.color
                  ? resolveCategoryColor(cat.color, scheme)
                  : getCategoryColorByIndex(t.categoryId, scheme);

                return (
                  <TransactionRow
                    key={t.id}
                    title={cat?.name ?? "Uncategorized"}
                    date={t.date}
                    amount={t.amount}
                    type={t.type}
                    categoryColor={categoryColor}
                    categoryIcon={
                      (cat?.icon ??
                        "pricetag-outline") as keyof typeof Ionicons.glyphMap
                    }
                    note={t.description ?? undefined}
                    style={{ backgroundColor: colors.surface }}
                  />
                );
              })}
            </View>
          ) : (
            <View className="mt-8 px-6">
              <EmptyState
                variant="no-data"
                icon={
                  <Ionicons
                    name="receipt-outline"
                    size={28}
                    color={colors.muted}
                  />
                }
                title="No transactions"
                description={`No ${selectedCategory.name} transactions in ${monthLabel}`}
              />
            </View>
          )}
        </ScrollView>
      ) : (
        <View className="flex-1 items-center justify-center">
          <EmptyState
            variant="no-data"
            icon={
              <Ionicons
                name="pie-chart-outline"
                size={28}
                color={colors.muted}
              />
            }
            title="No category selected"
            description="Tap a category in the list to view its transactions"
          />
        </View>
      )}
    </View>
  );

  // Single render tree for both breakpoints — TwoPaneLayout hides the detail
  // pane below `lg` via CSS (`hidden lg:flex`), so crossing the 1024 boundary
  // reflows in place without remounting the list or resetting scroll position.
  return (
    <ScreenContainer className="flex-1 bg-background">
      <TwoPaneLayout
        master={
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: Spacing["2xl"] }}
          >
            {header}
            {monthNav}
            {statsPane}
            {categoryPane}
          </ScrollView>
        }
        detail={categoryDetailPane}
      />
    </ScreenContainer>
  );
}

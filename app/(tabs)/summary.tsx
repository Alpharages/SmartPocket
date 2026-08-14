import React, { useCallback, useEffect, useState, useMemo } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  Text,
  Pressable,
  FlatList,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useExpense } from "@/lib/expense-context";
import { useThemeTokens } from "@/lib/theme-provider";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  getCategoryColorByIndex,
  resolveCategoryColor,
} from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { Animated, FadeInDown, FadeInUp } from "@/lib/motion";
import {
  Button,
  CategoryAnomalyBadge,
  CategoryPieChart,
  CategoryToken,
  EmptyState,
  GlassSurface,
  MonthlyTrendChart,
  MonthEndForecastCard,
  ScreenHeader,
  Skeleton,
  StatCard,
  TransactionRow,
  TwoPaneLayout,
} from "@/components/ui";
import { hasMonthlyTrendHistory } from "@/components/ui/MonthlyTrendChart";
import { useBreakpoints } from "@/hooks/use-breakpoint";
import {
  Spacing,
  TAB_BAR_CLEARANCE,
  Typography,
  getElevationStyle,
  Radius,
} from "@/lib/_core/theme";
import { readableTextOn } from "@/lib/_core/contrast";
import { useCurrency } from "@/lib/currency-provider";
import { formatCurrency } from "@/lib/currency";
import { computeMonthEndForecastState } from "@/lib/forecast";
import { trpc } from "@/lib/trpc";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";

export default function SummaryScreen() {
  const router = useRouter();
  // Same active-theme token source the surface primitives read — never
  // the theme-agnostic useColors() (frozen to the default theme; AC3).
  const { colors, themeId } = useThemeTokens();
  const { currency, isReady } = useCurrency();
  const scheme = (useColorScheme() ?? "light") as "light" | "dark";
  const {
    monthlyStats,
    loadingStats,
    loadingTransactions,
    refreshMonthlyStats,
    categories,
    transactions,
    refreshTransactions,
  } = useExpense();
  const { isLg } = useBreakpoints();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null,
  );

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const trendQuery = trpc.summary.monthlyTrend.useQuery({
    year,
    month,
    count: 6,
  });
  const trendData = trendQuery.data ?? [];

  const anomaliesQuery = trpc.summary.categoryAnomalies.useQuery({
    year,
    month,
  });
  const anomalyCategoryIds = useMemo(() => {
    const ids = new Set<number>();
    for (const row of anomaliesQuery.data ?? []) {
      if (row.isAnomaly) {
        ids.add(row.categoryId);
      }
    }
    return ids;
  }, [anomaliesQuery.data]);

  const onRefresh = useCallback(async () => {
    await Promise.all([
      refreshMonthlyStats(year, month),
      trendQuery.refetch(),
      anomaliesQuery.refetch(),
      refreshTransactions(),
    ]);
  }, [
    year,
    month,
    refreshMonthlyStats,
    trendQuery,
    anomaliesQuery,
    refreshTransactions,
  ]);
  const refreshProps = usePullToRefresh(onRefresh);

  const handleSelectMonth = (selectedYear: number, selectedMonth: number) => {
    const newDate = new Date(selectedYear, selectedMonth - 1, 1);
    setCurrentDate(newDate);
    refreshMonthlyStats(selectedYear, selectedMonth);
    setSelectedCategoryId(null);
  };

  const handlePreviousMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentDate(newDate);
    refreshMonthlyStats(newDate.getFullYear(), newDate.getMonth() + 1);
    setSelectedCategoryId(null);
  };

  const isCurrentMonth =
    currentDate.getMonth() === new Date().getMonth() &&
    currentDate.getFullYear() === new Date().getFullYear();

  // SP-045: "next" had no ceiling, so a user could page indefinitely into
  // empty future months with no shortcut back to today.
  const canGoToNextMonth = !isCurrentMonth;

  const handleNextMonth = () => {
    if (!canGoToNextMonth) return;
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentDate(newDate);
    refreshMonthlyStats(newDate.getFullYear(), newDate.getMonth() + 1);
    setSelectedCategoryId(null);
  };

  const handleGoToCurrentMonth = () => {
    const now = new Date();
    setCurrentDate(now);
    refreshMonthlyStats(now.getFullYear(), now.getMonth() + 1);
    setSelectedCategoryId(null);
  };

  const monthLabel = currentDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const today = new Date();
  const calendarDayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  const monthEndForecastState = useMemo(
    () =>
      computeMonthEndForecastState({
        isCurrentMonth,
        totalExpense: monthlyStats?.totalExpense ?? 0,
        // Run-rate uses today's calendar day, not `currentDate` (often the 1st after nav).
        anchorDate: new Date(),
      }),
    [isCurrentMonth, monthlyStats?.totalExpense, calendarDayKey],
  );

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
    ? resolveCategoryColor(selectedCategory.color, scheme, themeId)
    : selectedCategory
      ? getCategoryColorByIndex(selectedCategory.id, scheme, themeId)
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
            // SP-096: layout classes are inert on Pressable here — set in style.
            alignItems: "center",
            justifyContent: "center",
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

        <Pressable
          onPress={handleGoToCurrentMonth}
          disabled={isCurrentMonth}
          accessibilityRole="button"
          accessibilityLabel={
            isCurrentMonth
              ? `${monthLabel}, current month`
              : `${monthLabel}, tap to return to this month`
          }
          className="items-center"
          style={{
            // SP-096: layout classes are inert on Pressable here — set in style.
            alignItems: "center",
            minHeight: 44,
            justifyContent: "center",
          }}
        >
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
        </Pressable>

        <Pressable
          onPress={handleNextMonth}
          disabled={!canGoToNextMonth}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          accessibilityState={{ disabled: !canGoToNextMonth }}
          style={{
            // SP-096: layout classes are inert on Pressable here — set in style.
            alignItems: "center",
            justifyContent: "center",
            opacity: canGoToNextMonth ? 1 : 0.4,
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

  const forecastPane =
    monthEndForecastState.visible && monthEndForecastState.forecast ? (
      <Animated.View
        entering={FadeInUp.delay(165).duration(500)}
        className="px-2xl mt-2xl"
      >
        <MonthEndForecastCard
          projected={monthEndForecastState.forecast.projected}
          loading={loadingStats}
        />
      </Animated.View>
    ) : null;

  const trendsPane = (
    <Animated.View
      entering={FadeInUp.delay(175).duration(500)}
      className="px-2xl mt-2xl"
    >
      <View className="flex-row items-center justify-between mb-lg">
        <Text className="text-h3 font-bold text-foreground">Trends</Text>
      </View>

      {trendQuery.isLoading ? (
        <View
          className="rounded-3xl overflow-hidden p-4"
          style={getElevationStyle("sm", colors.foreground)}
          accessibilityLabel="Loading spending trend"
        >
          <GlassSurface
            style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
          />
          <Skeleton variant="line" width="100%" height={180} radius={12} />
        </View>
      ) : !hasMonthlyTrendHistory(trendData) ? (
        <View
          className="rounded-3xl overflow-hidden p-8 items-center"
          style={getElevationStyle("sm", colors.foreground)}
        >
          <GlassSurface
            style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
          />
          <Ionicons name="analytics-outline" size={36} color={colors.muted} />
          <Text className="text-muted font-medium mt-3 text-sm">
            No spending history
          </Text>
          <Text className="text-xs text-muted mt-xs">
            Add transactions across months to see trends
          </Text>
        </View>
      ) : (
        <View
          className="rounded-3xl overflow-hidden"
          style={getElevationStyle("sm", colors.foreground)}
        >
          {/* Frosted glass surface, opaque AA-safe tint fallback when blur is
           * unsupported/disabled (Story 12.3, RDR-3) — borderRadius matches
           * the rounded-3xl container so the surface's 1px border stroke
           * rounds with the card instead of being clipped square. */}
          <GlassSurface
            style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
          />
          <MonthlyTrendChart
            data={trendData}
            incomeColor={colors.success}
            expenseColor={colors.error}
            netColor={colors.primary}
            labelColor={colors.muted}
            backgroundColor={colors.surface}
            formatAmount={(amount) =>
              isReady ? formatCurrency(amount, currency) : "—"
            }
            onSelectMonth={handleSelectMonth}
          />
        </View>
      )}
    </Animated.View>
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
            ? resolveCategoryColor(category.color, scheme, themeId)
            : getCategoryColorByIndex(categoryId, scheme, themeId),
          categoryIcon: category?.icon ?? "pricetag-outline",
          type: category?.type ?? "expense",
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [monthTransactions, categories, scheme, themeId]);

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
          className="rounded-3xl overflow-hidden p-4"
          style={getElevationStyle("sm", colors.foreground)}
          accessibilityLabel="Loading spending breakdown"
        >
          <GlassSurface
            style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
          />
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
          className="rounded-3xl overflow-hidden p-8 items-center"
          style={getElevationStyle("sm", colors.foreground)}
        >
          <GlassSurface
            style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
          />
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
          style={getElevationStyle("sm", colors.foreground)}
        >
          {/* Frosted glass surface, opaque AA-safe tint fallback when blur is
           * unsupported/disabled (Story 12.3, RDR-3) — borderRadius matches
           * the rounded-3xl container so the surface's 1px border stroke
           * rounds with the card instead of being clipped square. */}
          <GlassSurface
            style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
          />
          <CategoryPieChart
            slices={categoryExpenses.map((item) => ({
              name: item.categoryName,
              total: item.total,
              color: item.categoryColor,
            }))}
            totalExpenses={totalExpenses}
            legendFontColor={colors.muted}
          />
          <FlatList
            data={categoryExpenses}
            keyExtractor={(item) => item.categoryId.toString()}
            renderItem={({ item, index }) => {
              const percentage =
                totalExpenses > 0 ? (item.total / totalExpenses) * 100 : 0;
              const isSelected = selectedCategoryId === item.categoryId;
              const isAnomaly = anomalyCategoryIds.has(item.categoryId);
              const amountLabel = isReady
                ? formatCurrency(item.total, currency)
                : "loading";
              const rowAccessibilityLabel = isAnomaly
                ? `${item.categoryName}, ${amountLabel}, ${percentage.toFixed(1)} percent, above usual spending this month`
                : `${item.categoryName}, ${amountLabel}, ${percentage.toFixed(1)} percent`;
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
                      <View className="flex-row items-center gap-2 flex-1">
                        <Text
                          className="text-foreground font-semibold text-sm flex-shrink"
                          numberOfLines={1}
                        >
                          {item.categoryName}
                        </Text>
                        {isAnomaly ? (
                          <CategoryAnomalyBadge
                            categoryName={item.categoryName}
                          />
                        ) : null}
                      </View>
                    </View>
                    <View className="items-end">
                      <Text className="text-foreground font-bold text-sm">
                        {isReady ? formatCurrency(item.total, currency) : "—"}
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
                      accessibilityLabel={rowAccessibilityLabel}
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
                    <View
                      style={{ backgroundColor: colors.surface }}
                      accessibilityLabel={rowAccessibilityLabel}
                    >
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
      <ScreenHeader
        title="Insights"
        subtitle="Monthly breakdown"
        accessibilityLabel="Insights screen"
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
  );

  // Detail pane for the selected category.
  const categoryDetailPane = (
    <View className="flex-1">
      {selectedCategory ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
          refreshControl={<RefreshControl {...refreshProps} />}
        >
          {/* Detail header */}
          <View className="px-6 pt-6 pb-2">
            <View className="flex-row items-center gap-3">
              <View
                // SP-091: NativeWind className is disabled on Pressable in this app,
                // so `w-10 h-10` never applied and the control rendered at 40x40 —
                // under the 44x44 minimum. Size it in `style`.
                style={{
                  backgroundColor: selectedCategoryColor,
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: "center",
                  justifyContent: "center",
                }}
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
                  ? resolveCategoryColor(cat.color, scheme, themeId)
                  : getCategoryColorByIndex(t.categoryId, scheme, themeId);

                return (
                  <TransactionRow
                    key={t.id}
                    title={cat?.name || "Uncategorized"}
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
            contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
            refreshControl={<RefreshControl {...refreshProps} />}
          >
            {header}
            {monthNav}
            {statsPane}
            {forecastPane}
            {trendsPane}
            {categoryPane}
          </ScrollView>
        }
        detail={categoryDetailPane}
      />
    </ScreenContainer>
  );
}

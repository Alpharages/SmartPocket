import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

import { DEFAULT_CATEGORY_ICON } from "@/constants/theme";
import { ResponsiveContent } from "@/components/responsive-content";
import { ScreenContainer } from "@/components/screen-container";
import { BudgetThresholdProgress } from "@/components/budgets/BudgetThresholdProgress";
import {
  Button,
  CategoryToken,
  EmptyState,
  ScreenHeader,
} from "@/components/ui";
import {
  useExpense,
  type Budget,
  type BudgetProgress,
} from "@/lib/expense-context";
import { budgetPercent, budgetThresholdState } from "@/lib/budget-threshold";
import { useColors } from "@/hooks/use-colors";
import { useCurrency } from "@/lib/currency-provider";
import { formatCurrency } from "@/lib/currency";
import { ContentMaxWidth, Typography } from "@/lib/_core/theme";
import { usePressFeedback } from "@/hooks/use-press-feedback";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function BudgetRow({
  budget,
  progress,
  categoryName,
  categoryColor,
  categoryIcon,
  index,
  onPress,
}: {
  budget: Budget;
  progress?: BudgetProgress;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  index: number;
  onPress: () => void;
}) {
  const colors = useColors();
  const { currency } = useCurrency();
  const { animatedStyle, onPressIn, onPressOut } = usePressFeedback();

  const spent = progress?.spent ?? "0.00";
  const limit = progress?.limit ?? budget.amount;
  const limitNum = parseFloat(limit);
  const percent = budgetPercent(spent, limit);
  const state = budgetThresholdState(spent, limit);
  const percentLabel =
    !Number.isFinite(limitNum) || limitNum <= 0
      ? "—"
      : `${Math.round(percent * 100)}%`;

  return (
    <Animated.View entering={FadeInDown.delay(index * 30).duration(400)}>
      <AnimatedPressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityLabel={`${categoryName} ${budget.period} budget, spent ${formatCurrency(Number(spent), currency)} of ${formatCurrency(Number(limit), currency)}, ${percentLabel}`}
        style={[
          {
            paddingHorizontal: 16,
            minHeight: 56,
            paddingVertical: 12,
            gap: 8,
          },
          animatedStyle,
        ]}
        testID={`budget-row-${budget.id}`}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <CategoryToken
            name={categoryName}
            color={categoryColor}
            icon={categoryIcon}
            state="default"
            size="md"
          />
          <View style={{ flex: 1 }}>
            <Text
              className="text-foreground font-semibold"
              style={{ fontSize: Typography.body.fontSize }}
            >
              {categoryName}
            </Text>
            <Text
              className="text-muted capitalize"
              style={{ fontSize: Typography.caption.fontSize }}
            >
              {budget.period}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text
              className="text-foreground font-semibold"
              style={{ fontSize: Typography.body.fontSize }}
            >
              {formatCurrency(Number(spent), currency)} /{" "}
              {formatCurrency(Number(limit), currency)}
            </Text>
            <Text
              className="text-muted"
              style={{ fontSize: Typography.caption.fontSize }}
            >
              {percentLabel}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </View>
        <BudgetThresholdProgress
          categoryName={categoryName}
          percent={percent}
          state={state}
        />
      </AnimatedPressable>
    </Animated.View>
  );
}

export default function BudgetsScreen() {
  const router = useRouter();
  const colors = useColors();
  const {
    budgets,
    categories,
    loadingBudgets,
    progressByBudgetId,
    loadingBudgetProgress,
    refreshBudgets,
    refreshBudgetProgress,
  } = useExpense();

  const onRefresh = useCallback(async () => {
    await Promise.all([refreshBudgets(), refreshBudgetProgress()]);
  }, [refreshBudgets, refreshBudgetProgress]);
  const refreshProps = usePullToRefresh(onRefresh);

  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  return (
    <ScreenContainer className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl {...refreshProps} />}
      >
      <ResponsiveContent maxWidth={ContentMaxWidth.screen}>
        <ScreenHeader
          title="Budgets"
          subtitle="Set spending limits by category"
          accessibilityLabel="Budgets screen"
          action={
            <Button
              variant="icon-only"
              accessibilityLabel="Go back"
              onPress={() => router.back()}
              leftIcon={
                <Ionicons
                  name="arrow-back"
                  size={22}
                  color={colors.foreground}
                />
              }
            />
          }
        />

        <View className="px-lg mt-md">
          <Button
            variant="primary"
            label="Add budget"
            onPress={() => router.push("/budget-form")}
            size="lg"
            testID="add-budget-button"
          />
        </View>

        {loadingBudgets || loadingBudgetProgress ? (
          <View className="py-xl items-center">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : budgets.length === 0 ? (
          <EmptyState
            icon={
              <Ionicons
                name="pie-chart-outline"
                size={28}
                color={colors.muted}
              />
            }
            title="No budgets yet"
            description="Create a budget to cap spending in a category."
          />
        ) : (
          <View
            className="mx-lg mt-lg rounded-2xl overflow-hidden"
            style={{
              backgroundColor: colors.surface,
              borderWidth: 0.5,
              borderColor: colors.border,
            }}
          >
            <FlatList
              data={budgets}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
              renderItem={({ item, index }) => {
                const category = categoriesById.get(item.categoryId);
                return (
                  <BudgetRow
                    budget={item}
                    progress={progressByBudgetId.get(item.id)}
                    categoryName={
                      category?.name ?? `Category ${item.categoryId}`
                    }
                    categoryColor={category?.color ?? colors.muted}
                    categoryIcon={category?.icon ?? DEFAULT_CATEGORY_ICON}
                    index={index}
                    onPress={() => router.push(`/budget-form?id=${item.id}`)}
                  />
                );
              }}
              ItemSeparatorComponent={() => (
                <View
                  className="mx-lg"
                  style={{ height: 0.5, backgroundColor: colors.border }}
                />
              )}
            />
          </View>
        )}
      </ResponsiveContent>
      </ScrollView>
    </ScreenContainer>
  );
}

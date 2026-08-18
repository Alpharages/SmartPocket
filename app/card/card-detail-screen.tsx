import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Animated, FadeInDown, FadeInUp } from "@/lib/motion";

import { ScreenContainer } from "@/components/screen-container";
import { EmptyState } from "@/components/ui/EmptyState";
import { TransactionRow } from "@/components/ui/TransactionRow";
import { useColors } from "@/hooks/use-colors";
import {
  parseCardRouteId,
  sumCardTransactionTotal,
} from "@/lib/card-transactions";
import { maskCardLastFour } from "@/lib/card-form-validation";
import { useCardTransactions, useExpense } from "@/lib/expense-context";
import { useCurrency } from "@/lib/currency-provider";
import { formatCurrency } from "@/lib/currency";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";

function formatMoney(
  total: number,
  currency: ReturnType<typeof useCurrency>["currency"],
): string {
  return formatCurrency(total, currency);
}

export default function CardDetailScreen() {
  const router = useRouter();
  const colors = useColors();
  const { currency } = useCurrency();
  const { id } = useLocalSearchParams<{ id: string }>();
  const cardId = parseCardRouteId(id);
  const { creditCards, categories, refreshCreditCards } = useExpense();
  const { cardTransactions, loadingCardTransactions, refreshCardTransactions } =
    useCardTransactions(cardId);

  const onRefresh = useCallback(async () => {
    await Promise.all([refreshCreditCards(), refreshCardTransactions()]);
  }, [refreshCreditCards, refreshCardTransactions]);
  const refreshProps = usePullToRefresh(onRefresh);

  const card = useMemo(
    () => creditCards.find((item) => item.id === cardId),
    [creditCards, cardId],
  );

  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const total = sumCardTransactionTotal(cardTransactions);
  const limitAmount = card ? Number(card.creditLimit) : 0;
  const utilisation = limitAmount > 0 ? Math.max(0, total) / limitAmount : 0;
  const overLimit = utilisation > 1;
  // A non-zero balance must never floor to "0%" at integer resolution.
  const utilisationLabel =
    utilisation === 0
      ? "0%"
      : utilisation < 0.01
        ? "<1%"
        : `${Math.round(utilisation * 100)}%`;
  // Screen readers commonly drop or mangle a leading "<" at default
  // punctuation verbosity, announcing "1 percent" — the opposite of what the
  // floor guard means. Spell it out for the accessibility label only; the
  // visible text keeps the compact "<1%" form.
  const utilisationAccessibleLabel =
    utilisation > 0 && utilisation < 0.01 ? "less than 1%" : utilisationLabel;

  if (cardId === null || !card) {
    return (
      <ScreenContainer
        className="flex-1 bg-background"
        edges={["top", "left", "right", "bottom"]}
      >
        <View className="flex-row items-center px-6 pt-6 pb-2">
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            // SP-086: no accessibilityRole, so this never reached the DOM as a
            // button — screen-reader and keyboard users had no way out of the
            // screen. Sizing also moved to `style`: NativeWind className is
            // disabled on Pressable app-wide, so `w-10 h-10` never applied.
            accessibilityRole="button"
            accessibilityLabel="Go back"
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
          <Ionicons name="search-outline" size={32} color={colors.muted} />
          <Text className="mt-3 text-muted font-medium text-sm">
            Card not found
          </Text>
        </View>
      </ScreenContainer>
    );
  }

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
        <Text className="flex-1 text-center text-h1 text-foreground mr-10">
          {card.name}
        </Text>
      </View>

      <Animated.View
        entering={FadeInUp.delay(100).duration(400)}
        className="mx-6 mt-4 rounded-2xl p-5"
        style={{ backgroundColor: card.color }}
        accessibilityLabel={`Card ending in ${card.cardNumberLast4}`}
      >
        <Text className="text-white/80 text-sm font-medium mb-1">
          {maskCardLastFour(card.cardNumberLast4)}
        </Text>
        {loadingCardTransactions ? (
          <ActivityIndicator
            color="white"
            size="small"
            style={{ alignSelf: "flex-start", marginVertical: 8 }}
            testID="card-detail-total-loading"
          />
        ) : (
          <Text
            className="text-white text-3xl font-bold"
            style={{ fontVariant: ["tabular-nums"] }}
            accessibilityRole="text"
            accessibilityLabel={`Total ${formatMoney(total, currency)}`}
          >
            {formatMoney(total, currency)}
          </Text>
        )}
        <Text className="text-white/70 text-xs font-medium mt-1 uppercase tracking-wide">
          Total on this card
        </Text>

        {/* SP-034: the credit limit was collected, validated and stored, then
         * displayed nowhere — the field existed purely as an unused input. */}
        {limitAmount > 0 ? (
          <View className="mt-3">
            <View
              className="h-1.5 rounded-full overflow-hidden"
              style={{ backgroundColor: "rgba(255,255,255,0.25)" }}
            >
              <View
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, utilisation * 100)}%`,
                  backgroundColor: overLimit
                    ? colors.error
                    : "rgba(255,255,255,0.9)",
                }}
              />
            </View>
            <Text
              testID="card-detail-utilisation"
              className="text-white/80 text-xs font-medium mt-1.5"
              accessibilityLabel={`${utilisationAccessibleLabel} of your ${formatMoney(limitAmount, currency)} limit used${overLimit ? ", over limit" : ""}`}
            >
              {utilisationLabel} of {formatMoney(limitAmount, currency)} limit
              {overLimit ? " — over limit" : ""}
            </Text>
          </View>
        ) : null}
      </Animated.View>

      <View className="flex-1 px-6 mt-6">
        {cardTransactions.length > 0 ? (
          <Animated.View
            entering={FadeInDown.delay(150).duration(400)}
            className="flex-1 rounded-3xl overflow-hidden"
            style={{ backgroundColor: colors.surface }}
          >
            <FlatList
              data={cardTransactions}
              keyExtractor={(item) => item.id.toString()}
              refreshControl={<RefreshControl {...refreshProps} />}
              renderItem={({ item, index }) => {
                const category = categoriesById.get(item.categoryId);
                const categoryIcon = (category?.icon ??
                  "pricetag-outline") as keyof typeof Ionicons.glyphMap;
                return (
                  <Animated.View
                    entering={FadeInDown.delay(index * 40).duration(400)}
                  >
                    <TransactionRow
                      title={category?.name || "Uncategorized"}
                      date={item.date}
                      amount={item.amount}
                      type={item.type}
                      categoryColor={category?.color ?? colors.muted}
                      categoryIcon={categoryIcon}
                      note={item.description ?? undefined}
                      onPress={() => router.push(`/transaction/${item.id}`)}
                      style={{ backgroundColor: colors.surface }}
                    />
                  </Animated.View>
                );
              }}
              ItemSeparatorComponent={() => (
                <View
                  className="mx-lg"
                  style={{ height: 0.5, backgroundColor: colors.border }}
                />
              )}
              contentContainerStyle={{ paddingBottom: 32 }}
            />
          </Animated.View>
        ) : (
          <ScrollView
            className="flex-1 rounded-3xl overflow-hidden"
            style={{ backgroundColor: colors.surface }}
            contentContainerStyle={{ flexGrow: 1 }}
            refreshControl={<RefreshControl {...refreshProps} />}
          >
            {loadingCardTransactions ? (
              <View
                className="flex-1 items-center justify-center py-20"
                testID="card-detail-loading"
              >
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <EmptyState
                variant="no-data"
                icon={
                  <Ionicons
                    name="receipt-outline"
                    size={28}
                    color={colors.muted}
                  />
                }
                title="No transactions for this card yet"
                description="Expenses linked to this card will appear here"
              />
            )}
          </ScrollView>
        )}
      </View>
    </ScreenContainer>
  );
}

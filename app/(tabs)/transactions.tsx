import {
  ScrollView,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  FlatList,
  TextInput,
  StyleSheet,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useExpense } from "@/lib/expense-context";
import { useColors } from "@/hooks/use-colors";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useState, useMemo } from "react";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

type FilterType = "all" | "income" | "expense" | "thisMonth" | "thisWeek";

export default function TransactionsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { transactions, loadingTransactions } = useExpense();
  const [searchText, setSearchText] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");

  const filteredTransactions = useMemo(() => {
    let filtered = transactions;

    if (filterType === "income") {
      filtered = filtered.filter((t) => t.type === "income");
    } else if (filterType === "expense") {
      filtered = filtered.filter((t) => t.type === "expense");
    } else if (filterType === "thisMonth") {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      filtered = filtered.filter((t) => new Date(t.date) >= startOfMonth);
    } else if (filterType === "thisWeek") {
      const now = new Date();
      const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
      filtered = filtered.filter((t) => new Date(t.date) >= startOfWeek);
    }

    if (searchText) {
      filtered = filtered.filter(
        (t) =>
          t.description?.toLowerCase().includes(searchText.toLowerCase()) ||
          t.amount.includes(searchText)
      );
    }

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, filterType, searchText]);

  const filterButtons: Array<{ label: string; value: FilterType }> = [
    { label: "All", value: "all" },
    { label: "Income", value: "income" },
    { label: "Expense", value: "expense" },
    { label: "This Month", value: "thisMonth" },
    { label: "This Week", value: "thisWeek" },
  ];

  return (
    <ScreenContainer className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(500)} className="px-6 pt-6 pb-2">
          <Text className="text-[28px] font-bold text-foreground">Transactions</Text>
          <Text className="text-sm text-muted font-medium mt-1">
            {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? "s" : ""}
          </Text>
        </Animated.View>

        {/* Search Bar */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)} className="px-6 mt-5">
          <View
            className="flex-row items-center gap-3 px-4 py-3.5 rounded-2xl"
            style={{ backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border }}
          >
            <Ionicons name="search" size={18} color={colors.muted} />
            <TextInput
              placeholder="Search transactions..."
              placeholderTextColor={colors.muted}
              value={searchText}
              onChangeText={setSearchText}
              className="flex-1 text-foreground"
              style={{ fontSize: 15 }}
            />
            {searchText ? (
              <Pressable onPress={() => setSearchText("")} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
        </Animated.View>

        {/* Filter Buttons */}
        <Animated.View entering={FadeInUp.delay(150).duration(500)} className="mt-4">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 24, gap: 8 }}
          >
            {filterButtons.map((filter, index) => {
              const isActive = filterType === filter.value;
              return (
                <Animated.View key={filter.value} entering={FadeInUp.delay(index * 40).duration(400)}>
                  <Pressable
                    onPress={() => setFilterType(filter.value)}
                    style={{
                      backgroundColor: isActive ? colors.primary : colors.surface,
                      borderWidth: isActive ? 0 : 0.5,
                      borderColor: colors.border,
                    }}
                    className="px-4 py-2.5 rounded-full active:opacity-80"
                  >
                    <Text
                      className="text-sm font-semibold"
                      style={{
                        color: isActive ? "white" : colors.foreground,
                      }}
                    >
                      {filter.label}
                    </Text>
                  </Pressable>
                </Animated.View>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* Transactions List */}
        <View className="px-6 mt-6">
          {loadingTransactions ? (
            <View className="items-center justify-center py-20">
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : filteredTransactions.length > 0 ? (
            <Animated.View
              entering={FadeInUp.delay(200).duration(500)}
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
                data={filteredTransactions}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item, index }) => {
                  const isIncome = item.type === "income";
                  const categoryName = item.categoryId ? `Category ${item.categoryId}` : "Uncategorized";

                  return (
                    <Animated.View entering={FadeInDown.delay(index * 25).duration(400)}>
                      <Pressable
                        onPress={() => router.push(`/transaction/${item.id}`)}
                        className="flex-row items-center justify-between py-3.5 px-4 active:opacity-70"
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
                              {new Date(item.date).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </Text>
                          </View>
                        </View>
                        <View className="items-end">
                          <Text
                            className="font-bold text-sm"
                            style={{ color: isIncome ? colors.success : colors.error }}
                          >
                            {isIncome ? "+" : "-"}${Math.abs(parseFloat(item.amount)).toFixed(2)}
                          </Text>
                          {item.description ? (
                            <Text className="text-xs text-muted mt-0.5 max-w-[120px]" numberOfLines={1}>
                              {item.description}
                            </Text>
                          ) : null}
                        </View>
                      </Pressable>
                    </Animated.View>
                  );
                }}
                scrollEnabled={false}
                ItemSeparatorComponent={() => (
                  <View className="mx-4" style={{ height: 0.5, backgroundColor: colors.border }} />
                )}
              />
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInUp.delay(200).duration(500)} className="items-center justify-center py-20 rounded-3xl" style={{ backgroundColor: colors.surface }}>
              <View
                className="w-14 h-14 rounded-full items-center justify-center mb-3"
                style={{ backgroundColor: colors.border }}
              >
                <Ionicons name="search-outline" size={28} color={colors.muted} />
              </View>
              <Text className="text-muted font-medium text-sm">No transactions found</Text>
              <Text className="text-xs text-muted mt-1">Try adjusting your filters or search</Text>
            </Animated.View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Pressable,
  ScrollView,
  SectionList,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { useExpense } from "@/lib/expense-context";
import { useColors } from "@/hooks/use-colors";
import { useBreakpoints } from "@/hooks/use-breakpoint";
import {
  EmptyState,
  FilterChipGroup,
  Pill,
  ScreenHeader,
  TransactionRow,
} from "@/components/ui";
import type { ChipOption } from "@/components/ui";
import { Spacing, Typography } from "@/lib/_core/theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FilterType = "all" | "income" | "expense" | "thisMonth" | "thisWeek";
type ExpenseTransaction = ReturnType<typeof useExpense>["transactions"][number];

export type TransactionSection = {
  title: string;
  data: ExpenseTransaction[];
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FILTER_OPTIONS: ChipOption<FilterType>[] = [
  { value: "all", label: "All" },
  { value: "income", label: "Income" },
  { value: "expense", label: "Expense" },
  { value: "thisMonth", label: "This Month" },
  { value: "thisWeek", label: "This Week" },
];

// ---------------------------------------------------------------------------
// Helpers (exported for unit testing)
// ---------------------------------------------------------------------------

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Group a sorted (newest-first) transaction list by calendar day.
 * Sections are returned in the same newest-first order.
 */
export function groupTransactionsByDate(
  transactions: ExpenseTransaction[],
): TransactionSection[] {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups = new Map<string, ExpenseTransaction[]>();

  for (const t of transactions) {
    const d = new Date(t.date);
    let label: string;
    if (isSameDay(d, today)) {
      label = "Today";
    } else if (isSameDay(d, yesterday)) {
      label = "Yesterday";
    } else {
      label = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }

    const group = groups.get(label);
    if (group) {
      group.push(t);
    } else {
      groups.set(label, [t]);
    }
  }

  return Array.from(groups.entries()).map(([title, data]) => ({ title, data }));
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function TransactionsScreen() {
  const router = useRouter();
  const { transactions, categories, loadingTransactions, deleteTransaction } =
    useExpense();
  const [searchText, setSearchText] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const colors = useColors();
  const { isLg } = useBreakpoints();

  const isSearchOrFilterActive = searchText.length > 0 || filterType !== "all";

  // Build category lookup map for O(1) resolution per row.
  const categoryById = useMemo(() => {
    const map = new Map<number, (typeof categories)[number]>();
    for (const cat of categories) {
      map.set(cat.id, cat);
    }
    return map;
  }, [categories]);

  // Filter + sort — FR-3 behavior is unchanged from the original screen.
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
          t.amount.includes(searchText),
      );
    }

    return filtered.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [transactions, filterType, searchText]);

  // Group into SectionList sections after filtering.
  const sections = useMemo(
    () => groupTransactionsByDate(filteredTransactions),
    [filteredTransactions],
  );

  const handleDelete = useCallback(
    (id: number, title: string) => {
      Alert.alert(
        "Delete Transaction",
        `Delete "${title}"? This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => deleteTransaction(id),
          },
        ],
      );
    },
    [deleteTransaction],
  );

  // ListHeaderComponent passed as a React element (not a component function)
  // so React reconciles TextInput in-place on state updates and focus is kept.
  const listHeader = (
    <>
      <ScreenHeader
        title="Activity"
        subtitle={`${filteredTransactions.length} transaction${
          filteredTransactions.length !== 1 ? "s" : ""
        }`}
        accessibilityLabel="Activity screen"
        action={
          <Pressable
            onPress={() => router.push("/add-transaction")}
            accessibilityRole="button"
            accessibilityLabel="Add transaction"
            hitSlop={8}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </Pressable>
        }
      />

      {/* Search bar */}
      <View
        className="mx-lg mb-md flex-row items-center gap-md rounded-md px-md"
        style={{
          backgroundColor: colors.surface,
          borderWidth: 0.5,
          borderColor: colors.border,
          minHeight: 44,
        }}
      >
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          placeholder="Search transactions…"
          placeholderTextColor={colors.muted}
          value={searchText}
          onChangeText={setSearchText}
          className="flex-1 text-foreground"
          style={{ fontSize: Typography.body.fontSize }}
          returnKeyType="search"
          accessibilityLabel="Search transactions"
        />
        {searchText ? (
          <Pressable
            onPress={() => setSearchText("")}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      {/* Filter chips */}
      <FilterChipGroup
        mode="single"
        options={FILTER_OPTIONS}
        value={filterType}
        onChange={setFilterType}
        className="mb-sm"
      />
    </>
  );

  const listEmpty = loadingTransactions ? (
    <View className="items-center justify-center py-20">
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  ) : (
    <EmptyState
      variant={isSearchOrFilterActive ? "no-results" : "no-data"}
      icon={
        <Ionicons
          name={isSearchOrFilterActive ? "search-outline" : "receipt-outline"}
          size={28}
          color={colors.muted}
        />
      }
      title={
        isSearchOrFilterActive ? "No results found" : "No transactions yet"
      }
      description={
        isSearchOrFilterActive
          ? "Try adjusting your filters or search term"
          : "Add your first income or expense to get started"
      }
      action={
        isSearchOrFilterActive
          ? undefined
          : {
              label: "Add Transaction",
              onPress: () => router.push("/add-transaction"),
            }
      }
    />
  );

  const transactionList = (
    <SectionList<ExpenseTransaction, TransactionSection>
      sections={sections}
      keyExtractor={(item) => item.id.toString()}
      ListHeaderComponent={isLg ? undefined : listHeader}
      ListEmptyComponent={listEmpty}
      stickySectionHeadersEnabled={false}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: Spacing["2xl"] }}
      renderSectionHeader={({ section }) => (
        <View
          className="px-lg py-xs"
          style={{ backgroundColor: colors.background }}
          accessibilityRole="header"
        >
          <Text
            className="text-muted font-semibold"
            style={{ fontSize: Typography.label.fontSize }}
          >
            {section.title}
          </Text>
        </View>
      )}
      renderItem={({ item }) => {
        const category = item.categoryId
          ? categoryById.get(item.categoryId)
          : undefined;
        const categoryColor = category?.color ?? colors.muted;
        const categoryIcon = (
          category?.icon ?? "pricetag-outline"
        ) as keyof typeof Ionicons.glyphMap;
        const title = category?.name ?? "Uncategorized";

        return (
          <TransactionRow
            title={title}
            date={item.date}
            amount={item.amount}
            type={item.type}
            categoryColor={categoryColor}
            categoryIcon={categoryIcon}
            note={item.description ?? undefined}
            onDelete={() => handleDelete(item.id, title)}
            style={{ backgroundColor: colors.surface }}
          />
        );
      }}
      ItemSeparatorComponent={() => (
        <View
          style={{
            height: 0.5,
            marginLeft: 72,
            backgroundColor: colors.border,
          }}
        />
      )}
      SectionSeparatorComponent={() => (
        <View
          style={{ height: Spacing.sm, backgroundColor: colors.background }}
        />
      )}
    />
  );

  if (isLg) {
    return (
      <ScreenContainer className="flex-row bg-background">
        {/* Left pane: header + search + filter chips (sticky sidebar) */}
        <ScrollView
          style={{
            width: 280,
            borderRightWidth: 0.5,
            borderRightColor: colors.border,
          }}
          contentContainerStyle={{ paddingBottom: Spacing["2xl"] }}
          showsVerticalScrollIndicator={false}
        >
          <ScreenHeader
            title="Activity"
            subtitle={`${filteredTransactions.length} transaction${filteredTransactions.length !== 1 ? "s" : ""}`}
            accessibilityLabel="Activity screen"
            action={
              <Pressable
                onPress={() => router.push("/add-transaction")}
                accessibilityRole="button"
                accessibilityLabel="Add transaction"
                hitSlop={8}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="add" size={22} color="#fff" />
              </Pressable>
            }
          />

          {/* Search bar */}
          <View
            className="mx-lg mb-md flex-row items-center gap-md rounded-md px-md"
            style={{
              backgroundColor: colors.surface,
              borderWidth: 0.5,
              borderColor: colors.border,
              minHeight: 44,
            }}
          >
            <Ionicons name="search" size={18} color={colors.muted} />
            <TextInput
              placeholder="Search…"
              placeholderTextColor={colors.muted}
              value={searchText}
              onChangeText={setSearchText}
              className="flex-1 text-foreground"
              style={{ fontSize: Typography.body.fontSize }}
              returnKeyType="search"
              accessibilityLabel="Search transactions"
            />
            {searchText ? (
              <Pressable
                onPress={() => setSearchText("")}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>

          {/* Filter pills stacked vertically in the sidebar */}
          <View style={{ paddingHorizontal: Spacing.lg, gap: Spacing.sm }}>
            {FILTER_OPTIONS.map((option) => (
              <Pill
                key={option.value}
                label={option.label}
                selected={filterType === option.value}
                onPress={() => setFilterType(option.value)}
              />
            ))}
          </View>
        </ScrollView>

        {/* Right pane: transaction list */}
        <View style={{ flex: 1 }}>
          {transactionList}
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1 bg-background">
      {transactionList}
    </ScreenContainer>
  );
}

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { useExpense } from "@/lib/expense-context";
import { useThemeTokens } from "@/lib/theme-provider";
import { useBreakpoints } from "@/hooks/use-breakpoint";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  EmptyState,
  FilterChipGroup,
  GlassSurface,
  ScreenHeader,
  TransactionRow,
  TwoPaneLayout,
} from "@/components/ui";
import type { ChipOption } from "@/components/ui";
import { readableTextOn } from "@/lib/_core/contrast";
import { useCurrency } from "@/lib/currency-provider";
import { formatSignedCurrency } from "@/lib/currency";
import { getStartOfWeek } from "@/lib/date-utils";
import { useFirstDayOfWeek } from "@/lib/first-day-of-week-provider";
import {
  Radius,
  Spacing,
  Typography,
  getElevationStyle,
  resolveCategoryColor,
} from "@/lib/_core/theme";
import { TAB_BAR_CLEARANCE } from "@/lib/_core/theme";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { confirmDestructive } from "@/lib/confirm-dialog";

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
// Detail pane — inline transaction detail for two-pane layout
// ---------------------------------------------------------------------------

function formatDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

function TransactionDetailPane({
  transaction,
  refreshControlProps,
}: {
  transaction: ExpenseTransaction;
  refreshControlProps?: ReturnType<typeof usePullToRefresh>;
}) {
  // Same active-theme token source the surface primitives read — never
  // the theme-agnostic useColors() (frozen to the default theme; AC1).
  const { colors, themeId } = useThemeTokens();
  const { currency } = useCurrency();
  const { categories, deleteTransaction } = useExpense();

  const scheme = (useColorScheme() ?? "light") as "light" | "dark";
  const isIncome = transaction.type === "income";
  const accent = isIncome ? colors.success : colors.error;
  const category = categories.find((c) => c.id === transaction.categoryId);
  // Resolve the scheme- and theme-appropriate swatch (active theme's category
  // map, Story 12.2) so the on-color icon contrast is computed against what
  // actually renders (mirrors the Insights detail pane).
  const categorySwatchColor = category
    ? resolveCategoryColor(category.color, scheme, themeId)
    : undefined;

  const handleDelete = async () => {
    // SP-040: Alert.alert buttons are inert on web, so this was a dead action
    // in the desktop two-pane layout.
    const confirmed = await confirmDestructive({
      title: "Delete transaction",
      message: "This cannot be undone.",
    });
    if (confirmed) {
      await deleteTransaction(transaction.id);
    }
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
      refreshControl={
        refreshControlProps ? (
          <RefreshControl {...refreshControlProps} />
        ) : undefined
      }
    >
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 pt-6 pb-2">
        <Text className="text-h1 text-foreground">Details</Text>
        <Pressable
          onPress={() => void handleDelete()}
          hitSlop={8}
          accessibilityLabel="Delete transaction"
          // SP-091: NativeWind className is disabled on Pressable in this app,
          // so `w-10 h-10` never applied and the control rendered at 40x40 —
          // under the 44x44 minimum. Size it in `style`.
          style={{
            backgroundColor: colors.error + "14",
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </Pressable>
      </View>

      {/* Amount */}
      <View className="items-center mt-6 px-6">
        <View
          className="w-16 h-16 rounded-full items-center justify-center mb-3"
          style={{ backgroundColor: accent + "18" }}
        >
          <Ionicons
            name={isIncome ? "arrow-down" : "arrow-up"}
            size={26}
            color={accent}
          />
        </View>
        <Text className="text-4xl font-bold" style={{ color: accent }}>
          {formatSignedCurrency(transaction.amount, currency, transaction.type)}
        </Text>
        <Text className="mt-xs text-sm text-muted font-medium capitalize">
          {transaction.type}
        </Text>
      </View>

      {/* Details card */}
      <View
        className="mx-6 mt-8 rounded-2xl overflow-hidden"
        style={getElevationStyle("sm", colors.foreground)}
      >
        {/* Frosted glass surface, opaque AA-safe tint fallback when blur is
         * unsupported/disabled (Story 12.3, RDR-3) — borderRadius matches
         * the rounded-2xl container so the surface's 1px border stroke
         * rounds with the card instead of being clipped square. */}
        <GlassSurface
          style={[StyleSheet.absoluteFill, { borderRadius: Radius.lg }]}
        />
        {/* Category */}
        <View className="flex-row items-center justify-between px-5 py-4">
          <Text className="text-sm font-medium text-muted">Category</Text>
          <View className="flex-row items-center gap-2">
            {category && categorySwatchColor && (
              <View
                className="w-6 h-6 rounded-full items-center justify-center"
                style={{ backgroundColor: categorySwatchColor }}
              >
                <Ionicons
                  name={(category.icon as IoniconName) ?? "pricetag"}
                  size={13}
                  color={readableTextOn(categorySwatchColor)}
                />
              </View>
            )}
            <Text className="text-sm font-semibold text-foreground">
              {category?.name ?? "Uncategorized"}
            </Text>
          </View>
        </View>

        <View style={{ height: 0.5, backgroundColor: colors.border }} />

        {/* Date */}
        <View className="flex-row items-center justify-between px-5 py-4">
          <Text className="text-sm font-medium text-muted">Date</Text>
          <Text className="text-sm font-semibold text-foreground">
            {formatDate(transaction.date)}
          </Text>
        </View>

        {transaction.description ? (
          <>
            <View style={{ height: 0.5, backgroundColor: colors.border }} />
            {/* Description */}
            <View className="px-5 py-4">
              <Text className="text-sm font-medium text-muted mb-1.5">
                Description
              </Text>
              <Text className="text-sm text-foreground leading-5">
                {transaction.description}
              </Text>
            </View>
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function TransactionsScreen() {
  const router = useRouter();
  const {
    transactions,
    categories,
    loadingTransactions,
    deleteTransaction,
    refreshTransactions,
  } = useExpense();
  const [searchText, setSearchText] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [selectedTransactionId, setSelectedTransactionId] = useState<
    number | null
  >(null);
  // Same active-theme token source the surface primitives read — never
  // the theme-agnostic useColors() (frozen to the default theme; AC1).
  const { colors } = useThemeTokens();
  const { isLg } = useBreakpoints();
  const { firstDayOfWeek } = useFirstDayOfWeek();

  const onRefresh = useCallback(async () => {
    await refreshTransactions();
  }, [refreshTransactions]);
  const refreshProps = usePullToRefresh(onRefresh);

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
      const startOfWeek = getStartOfWeek(new Date(), firstDayOfWeek);
      filtered = filtered.filter((t) => new Date(t.date) >= startOfWeek);
    }

    if (searchText.trim()) {
      // SP-027: `t.amount.includes(searchText)` was a raw substring test, so
      // "5" matched 15.00, 500.00 and 0.55; and the category name — the value
      // actually rendered as each row's title — was not searched at all.
      const needle = searchText.trim().toLowerCase();
      const numeric = Number(needle.replace(/[^0-9.]/g, ""));
      const hasNumber = needle.replace(/[^0-9.]/g, "").length > 0;

      filtered = filtered.filter((t) => {
        if (t.description?.toLowerCase().includes(needle)) return true;
        const categoryName = categoryById.get(t.categoryId)?.name;
        if (categoryName?.toLowerCase().includes(needle)) return true;
        if (hasNumber && Number.isFinite(numeric)) {
          return Number(t.amount) === numeric;
        }
        return false;
      });
    }

    // SP-028: `.sort()` mutates in place, and when no filter is active
    // `filtered` *is* the provider's `transactions` array — so this reordered
    // shared state during render.
    return [...filtered].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [transactions, filterType, searchText, firstDayOfWeek, categoryById]);

  // Group into SectionList sections after filtering.
  const sections = useMemo(
    () => groupTransactionsByDate(filteredTransactions),
    [filteredTransactions],
  );

  const handleDelete = useCallback(
    async (id: number, title: string) => {
      // SP-007: this used Alert.alert, whose buttons never fire on web — the
      // affordance was present, labelled, and completely inert.
      const confirmed = await confirmDestructive({
        title: "Delete Transaction",
        message: `Delete "${title}"? This cannot be undone.`,
      });
      if (confirmed) {
        await deleteTransaction(id);
      }
    },
    [deleteTransaction],
  );

  const handleTransactionPress = useCallback(
    (id: number) => {
      if (isLg) {
        setSelectedTransactionId(id);
      } else {
        router.push(`/transaction/${id}`);
      }
    },
    [isLg, router],
  );

  const selectedTransaction = useMemo(
    () => transactions.find((t) => t.id === selectedTransactionId) ?? null,
    [transactions, selectedTransactionId],
  );

  // Clear the selection if the selected transaction no longer exists (e.g. deleted).
  useEffect(() => {
    if (selectedTransactionId != null && !selectedTransaction) {
      setSelectedTransactionId(null);
    }
  }, [selectedTransactionId, selectedTransaction]);

  // ListHeaderComponent passed as a React element (not a component function)
  // so React reconciles TextInput in-place on state updates and focus is kept.
  const listHeader = (
    <>
      <ScreenHeader
        title="Activity"
        subtitle={`${filteredTransactions.length} transaction${
          filteredTransactions.length !== 1 ? "s" : ""
        }`}
        accessibilityLabel="Activity screen header"
        action={
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Pressable
              onPress={() => router.push("/recurring")}
              accessibilityRole="button"
              accessibilityLabel="Recurring transactions"
              hitSlop={8}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.surface,
                borderWidth: 0.5,
                borderColor: colors.border,
              }}
            >
              <Ionicons name="repeat" size={18} color={colors.foreground} />
            </Pressable>
            <Pressable
              onPress={() => router.push("/add-transaction")}
              accessibilityRole="button"
              accessibilityLabel="Add transaction"
              hitSlop={8}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name="add"
                size={22}
                color={readableTextOn(colors.primary)}
              />
            </Pressable>
          </View>
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
          style={{
            // SP-097: without `minWidth: 0` a flex <input> refuses to shrink below
            // its intrinsic width, overflowing the row and horizontally scrolling
            // the sheet — which clipped the first character off every label.
            minWidth: 0,
            fontSize: Typography.body.fontSize,
          }}
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
      ListHeaderComponent={listHeader}
      ListEmptyComponent={listEmpty}
      stickySectionHeadersEnabled={false}
      showsVerticalScrollIndicator={false}
      // SP-063: rows rendered flush to x=0 while the header/search/chips inset
      // to 24, breaking the master pane's left alignment on desktop.
      contentContainerStyle={{
        paddingBottom: TAB_BAR_CLEARANCE,
        paddingHorizontal: Spacing.lg,
      }}
      refreshControl={<RefreshControl {...refreshProps} />}
      renderSectionHeader={({ section }) => (
        <View
          className="px-lg py-xs"
          style={{ backgroundColor: colors.background }}
        >
          <Text
            className="text-muted font-semibold"
            style={{ fontSize: Typography.label.fontSize }}
            accessibilityRole="header"
            aria-level={2}
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
        const categoryIcon = (category?.icon ??
          "pricetag-outline") as keyof typeof Ionicons.glyphMap;
        const categoryName = category?.name?.trim() || "Uncategorized";
        // SP-050: the title was always the category, so every row in a category
        // read identically. Lead with the description when there is one — the
        // coloured category token already conveys the category.
        const title = item.description?.trim() || categoryName;

        return (
          <TransactionRow
            title={title}
            date={item.date}
            amount={item.amount}
            type={item.type}
            categoryColor={categoryColor}
            categoryIcon={categoryIcon}
            note={item.description?.trim() ? categoryName : undefined}
            // SP-064: the SectionList header above already states this date.
            hideDate
            selected={selectedTransactionId === item.id}
            onPress={() => handleTransactionPress(item.id)}
            onDelete={() => void handleDelete(item.id, title)}
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

  const detailPane = selectedTransaction ? (
    <TransactionDetailPane
      transaction={selectedTransaction}
      refreshControlProps={refreshProps}
    />
  ) : (
    <View className="flex-1 items-center justify-center">
      <EmptyState
        variant="no-data"
        icon={
          <Ionicons name="receipt-outline" size={28} color={colors.muted} />
        }
        title="No transaction selected"
        description="Tap a transaction in the list to view its details"
      />
    </View>
  );

  // Single render tree for both breakpoints — TwoPaneLayout hides the detail
  // pane below `lg` via CSS (`hidden lg:flex`), so crossing the 1024 boundary
  // reflows in place without remounting the list or resetting scroll position.
  return (
    <ScreenContainer className="flex-1 bg-background">
      <TwoPaneLayout master={transactionList} detail={detailPane} />
    </ScreenContainer>
  );
}

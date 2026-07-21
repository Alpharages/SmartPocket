import React, { useMemo } from "react";
import { View, Text, type StyleProp, type ViewStyle } from "react-native";

import { useThemeTokens } from "@/lib/theme-provider";
import { cn } from "@/lib/utils";
import { Radius, Spacing } from "@/constants/theme";
import { CategoryToken } from "./CategoryToken";
import type { Category } from "@/lib/expense-context";

export interface CategoryPickerGridProps {
  /** Categories to display. */
  categories: Category[];
  /** Currently selected category ID, or null. */
  selectedId: number | null;
  /** Called when a category is tapped. */
  onSelect: (id: number) => void;
  /**
   * Optional transaction list to derive recently-used ordering.
   * When provided, categories referenced by the most-recent transactions
   * float to the front (deduped, in recency order), followed by the
   * remainder in their existing order.
   */
  transactions?: {
    categoryId: number;
    date?: Date | string;
    createdAt?: Date | string;
  }[];
  /** Max number of recently-used categories to float to the front. Defaults to 4. */
  recentLimit?: number;
  /** Text shown when the category list is empty. */
  emptyText?: string;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

/** Resolve a transaction's sort timestamp: `date`, falling back to `createdAt`. */
function txTime(tx: {
  date?: Date | string;
  createdAt?: Date | string;
}): number {
  const value = tx.date ?? tx.createdAt;
  return value ? new Date(value).getTime() : 0;
}

/**
 * CategoryPickerGrid — responsive wrap/grid of CategoryTokens.
 *
 * Lays out `CategoryToken`s in a responsive wrap, takes `categories`,
 * `selectedId`, and `onSelect`, and renders a fallback when the list is empty.
 * Optionally floats recently-used categories to the front when `transactions`
 * are provided.
 *
 * Wrapped in an accessible `radiogroup` whose tokens expose the `radio` role +
 * `checked` state, so screen readers announce a single navigable group.
 *
 * Architecture guardrails:
 * - Presentational only — receives plain props, never calls the API directly.
 * - Consumes spacing tokens from theme.config.js — no hardcoded px.
 * - Color resolution lives in CategoryToken (single source of truth).
 * - NFR-5: screen-reader navigable, color never sole signal (icon + name).
 */
export function CategoryPickerGrid({
  categories,
  selectedId,
  onSelect,
  transactions,
  recentLimit = 4,
  emptyText = "No categories available",
  className,
  style,
}: CategoryPickerGridProps) {
  // Same active-theme token source the surface primitives read — never
  // the theme-agnostic useColors() (frozen to the default theme; AC3).
  const { colors } = useThemeTokens();

  const orderedCategories = useMemo(() => {
    if (
      !transactions ||
      transactions.length === 0 ||
      categories.length === 0 ||
      recentLimit <= 0
    ) {
      return categories;
    }

    // Only categories actually visible in this grid are eligible to float —
    // otherwise opposite-type transactions silently consume recency slots.
    const visibleIds = new Set(categories.map((c) => c.id));

    // Build a recency-ordered, deduped list of visible category IDs.
    // Sort by date desc, falling back to createdAt.
    const recentIds: number[] = [];
    const sorted = [...transactions].sort((a, b) => txTime(b) - txTime(a));

    for (const tx of sorted) {
      if (recentIds.length >= recentLimit) break;
      if (!visibleIds.has(tx.categoryId)) continue;
      if (!recentIds.includes(tx.categoryId)) {
        recentIds.push(tx.categoryId);
      }
    }

    // Recent first (in recency order), then the rest in their original order.
    const recent = recentIds
      .map((id) => categories.find((c) => c.id === id))
      .filter(Boolean) as Category[];

    const remaining = categories.filter((c) => !recentIds.includes(c.id));

    return [...recent, ...remaining];
  }, [categories, transactions, recentLimit]);

  if (orderedCategories.length === 0) {
    return (
      <View
        className={cn("items-center", className)}
        style={[
          {
            paddingVertical: Spacing.lg,
            paddingHorizontal: Spacing.lg,
            borderRadius: Radius.lg,
            backgroundColor: colors.surface,
            borderWidth: 0.5,
            borderColor: colors.border,
          },
          style,
        ]}
      >
        <Text className="text-muted text-sm">{emptyText}</Text>
      </View>
    );
  }

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Category picker"
      className={cn("flex-row flex-wrap", className)}
      style={[{ gap: Spacing.sm }, style]}
    >
      {orderedCategories.map((cat) => {
        const isSelected = selectedId === cat.id;
        return (
          <CategoryToken
            key={cat.id}
            name={cat.name}
            color={cat.color}
            icon={cat.icon}
            state={isSelected ? "selected" : "default"}
            onPress={() => onSelect(cat.id)}
            showLabel
            role="radio"
            accessibilityLabel={`${cat.name}${isSelected ? ", selected" : ""}`}
          />
        );
      })}
    </View>
  );
}

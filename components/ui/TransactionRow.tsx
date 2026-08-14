import React, { useCallback, useMemo } from "react";
import {
  Platform,
  Pressable,
  Text,
  View,
  type AccessibilityActionEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";

import { useThemeTokens } from "@/lib/theme-provider";
import { useCurrency } from "@/lib/currency-provider";
import { formatSignedCurrency } from "@/lib/currency";
import { Typography } from "@/lib/_core/theme";
import { usePressFeedback } from "@/hooks/use-press-feedback";
import { cn } from "@/lib/utils";
import { CategoryToken } from "./CategoryToken";

// Registered for NativeWind interop in lib/_core/nativewind-pressable (SP-057).
import { AnimatedPressable } from "@/lib/_core/nativewind-pressable";

export interface TransactionRowProps {
  title: string;
  date: string | Date;
  amount: string | number;
  type: "income" | "expense";
  categoryColor: string;
  categoryIcon: keyof typeof Ionicons.glyphMap;
  note?: string;
  cardLabel?: string;
  selected?: boolean;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
  /**
   * Hide the per-row date. Set by lists that already group rows under a dated
   * section header, where repeating it is pure noise (SP-064).
   */
  hideDate?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Coerce a date prop to a valid Date, or null if unparseable — never let
 *  `new Date(bad)` leak a literal "Invalid Date" into the UI or a11y label. */
function toValidDate(date: string | Date): Date | null {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return Number.isNaN(dateObj.getTime()) ? null : dateObj;
}

/** Append a 2-digit hex alpha to a 6-digit hex color. Prop/DB-sourced colors
 *  aren't guaranteed `#RRGGBB`, so anything else passes through opaque rather
 *  than producing an unparseable "#RRGGBBAA18"-style value. */
function withAlpha(color: string, alphaHex: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? `${color}${alphaHex}` : color;
}

/** Format a decimal amount as signed currency. */
function formatSignedAmount(
  amount: string | number,
  type: "income" | "expense",
  currency: ReturnType<typeof useCurrency>["currency"],
): string {
  return formatSignedCurrency(amount, currency, type);
}

/** Build a screen-reader friendly summary label. */
function buildAccessibilityLabel(
  title: string,
  type: "income" | "expense",
  amount: string | number,
  date: string | Date,
  currency: ReturnType<typeof useCurrency>["currency"],
  note?: string,
  cardLabel?: string,
): string {
  const formattedAmount = formatSignedAmount(amount, type, currency);
  const dateObj = toValidDate(date);
  const dateStr = dateObj
    ? dateObj.toLocaleDateString("en-US", { month: "long", day: "numeric" })
    : "";

  // SP-D19: a row exposed an empty accessibility label. `title` traces back to
  // a nullable `description` column and to category names, so an empty string
  // can reach here and used to be joined in as a blank leading segment. Filter
  // empty segments out; `type` and the formatted amount are always present, so
  // the label can no longer come out blank whatever the caller passes.
  const parts: string[] = [title.trim(), type, formattedAmount];
  if (dateStr) parts.push(dateStr);
  if (cardLabel) parts.push(`via ${cardLabel}`);
  if (note) parts.push(note);

  return parts.filter((part) => part.trim().length > 0).join(", ");
}

/** Format date for display. Falls back to an em dash for invalid input. */
function formatDate(date: string | Date): string {
  const dateObj = toValidDate(date);
  return dateObj
    ? dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "—";
}

/**
 * TransactionRow — reusable ledger row primitive.
 *
 * Composes a category color+icon avatar, title+date, and a trailing signed
 * amount. Supports default / pressed / swipe-revealed / selected states and
 * with-card-badge / with-note variants.
 *
 * Architecture guardrails:
 * - Uses tokens from theme.config.js via NativeWind classes (spacing, radius,
 *   typography, elevation) and never hardcodes px/hex.
 * - Colors come from useColors() / constants/theme.ts.
 * - Presentational only — screens pass data in via props.
 *
 * Wrapped in `React.memo` (Story 12.11, AC1) — skips re-rendering rows whose
 * props are referentially unchanged, e.g. when a sibling row's press state
 * updates during Activity/Insights list scrolling.
 */
function TransactionRowImpl({
  title,
  date,
  amount,
  type,
  categoryColor,
  categoryIcon,
  note,
  cardLabel,
  selected = false,
  onPress,
  onEdit,
  onDelete,
  className,
  hideDate = false,
  style,
}: TransactionRowProps) {
  // Same active-theme token source the surface primitives read — never
  // the theme-agnostic useColors() (frozen to the default theme; AC3).
  const { colors } = useThemeTokens();
  const { currency, isReady } = useCurrency();
  const { animatedStyle, onPressIn, onPressOut } = usePressFeedback();

  const hasSwipeActions = Boolean(onEdit || onDelete);
  // QA report SP-007: edit/delete lived only inside `renderRightActions`, so on
  // web they rendered off-screen (measured at x = -9638) with no swipe gesture
  // to bring them in — the actions were physically unreachable. Render them
  // inline wherever swipe is not an input method.
  const usesInlineActions = Platform.OS === "web" && hasSwipeActions;

  const handlePressIn = useCallback(() => {
    onPressIn();
  }, [onPressIn]);

  const handlePressOut = useCallback(() => {
    onPressOut();
  }, [onPressOut]);

  const handlePress = useCallback(() => {
    onPress?.();
  }, [onPress]);

  const displayAmount = useMemo(
    () => (isReady ? formatSignedAmount(amount, type, currency) : "—"),
    [amount, type, currency, isReady],
  );

  const displayDate = useMemo(() => formatDate(date), [date]);

  const accessibilityLabel = useMemo(
    () =>
      buildAccessibilityLabel(
        title,
        type,
        amount,
        date,
        currency,
        note,
        cardLabel,
      ),
    [title, type, amount, date, currency, note, cardLabel],
  );

  // Edit/Delete are swipe-only for sighted touch users; expose the same actions
  // to assistive tech via accessibilityActions so VoiceOver/TalkBack (and
  // motor-impaired) users can invoke them without performing a swipe (NFR-5).
  const accessibilityActions = useMemo(() => {
    const actions: { name: string; label: string }[] = [];
    if (onEdit) actions.push({ name: "edit", label: "Edit" });
    if (onDelete) actions.push({ name: "delete", label: "Delete" });
    return actions;
  }, [onEdit, onDelete]);

  const handleAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      switch (event.nativeEvent.actionName) {
        case "edit":
          onEdit?.();
          break;
        case "delete":
          onDelete?.();
          break;
      }
    },
    [onEdit, onDelete],
  );

  const amountColor = type === "income" ? colors.success : colors.error;

  const rowContent = (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      accessibilityActions={
        accessibilityActions.length ? accessibilityActions : undefined
      }
      onAccessibilityAction={
        accessibilityActions.length ? handleAccessibilityAction : undefined
      }
      className={cn("flex-row items-center justify-between", className)}
      style={[
        {
          // Padding and the selected fill live in `style`, not className: this
          // app drops NativeWind className visual styles on Pressable (notably
          // on web), so px/py and the background must be set here to render.
          minHeight: 56, // ≥ 44pt touch target with comfortable padding
          paddingHorizontal: 16,
          paddingVertical: 14,
          backgroundColor: selected
            ? withAlpha(colors.primary, "0D")
            : undefined,
        },
        animatedStyle,
        style,
      ]}
    >
      {/* Left: Avatar + Title/Date */}
      <View className="flex-row items-center gap-3 flex-1">
        {/* Category Avatar */}
        <CategoryToken
          name={title}
          color={categoryColor}
          icon={categoryIcon}
          state="default"
          size="md"
        />

        {/* Title + Date + Note */}
        <View className="flex-1">
          <View className="flex-row items-center gap-1.5">
            <Text
              className="text-foreground font-semibold text-sm shrink"
              numberOfLines={1}
            >
              {title}
            </Text>
            {cardLabel ? (
              <View
                className="px-1.5 py-0.5 rounded-md"
                style={{ backgroundColor: colors.border }}
              >
                <Text
                  className="font-medium"
                  style={{
                    color: colors.muted,
                    fontSize: Typography.micro.fontSize,
                    lineHeight: Typography.micro.lineHeight,
                  }}
                  numberOfLines={1}
                >
                  {cardLabel}
                </Text>
              </View>
            ) : null}
          </View>
          {hideDate ? null : (
            <Text className="text-xs text-muted mt-0.5">{displayDate}</Text>
          )}
          {note ? (
            <Text className="text-xs text-muted mt-0.5" numberOfLines={1}>
              {note}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Right: Amount */}
      <View className="items-end ml-2">
        <Text
          className="font-bold text-sm tabular-nums"
          style={{ color: amountColor }}
        >
          {displayAmount}
        </Text>
      </View>

    </AnimatedPressable>
  );

  // SP-078: these used to render *inside* the row Pressable, producing
  // `<button>` inside `<button>` — invalid HTML that React reports as a
  // hydration error and that leaves the row's own hit area ambiguous. They are
  // siblings of the row now. The row keeps its `accessibilityActions` for
  // edit/delete, so screen-reader users lose nothing by the regrouping.
  const inlineActions = usesInlineActions ? (
    <View className="flex-row items-center pr-2">
      {onEdit ? (
        <Pressable
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${title}`}
          className="items-center justify-center"
          style={{ minWidth: 44, minHeight: 44 }}
        >
          <Ionicons name="create-outline" size={18} color={colors.primary} />
        </Pressable>
      ) : null}
      {onDelete ? (
        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${title}`}
          className="items-center justify-center"
          style={{ minWidth: 44, minHeight: 44 }}
        >
          <Ionicons name="trash-outline" size={18} color={colors.error} />
        </Pressable>
      ) : null}
    </View>
  ) : null;

  if (hasSwipeActions && !usesInlineActions) {
    return (
      <Swipeable
        friction={2}
        rightThreshold={40}
        renderRightActions={() => (
          <View className="flex-row items-center">
            {onEdit ? (
              <Pressable
                onPress={onEdit}
                className="items-center justify-center px-4"
                style={{
                  minHeight: 56,
                  backgroundColor: withAlpha(colors.primary, "14"),
                }}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${title}`}
              >
                <Ionicons
                  name="create-outline"
                  size={20}
                  color={colors.primary}
                />
              </Pressable>
            ) : null}
            {onDelete ? (
              <Pressable
                onPress={onDelete}
                className="items-center justify-center px-4"
                style={{
                  minHeight: 56,
                  backgroundColor: withAlpha(colors.error, "14"),
                }}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${title}`}
              >
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              </Pressable>
            ) : null}
          </View>
        )}
      >
        {rowContent}
      </Swipeable>
    );
  }

  if (inlineActions) {
    return (
      <View className="flex-row items-center">
        <View className="flex-1">{rowContent}</View>
        {inlineActions}
      </View>
    );
  }

  return rowContent;
}

export const TransactionRow = React.memo(TransactionRowImpl);
TransactionRow.displayName = "TransactionRow";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "expo-router";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  FlatList,
  TextInput,
  Platform,
  type ViewStyle,
} from "react-native";
import { ResponsiveContent } from "@/components/responsive-content";
import { ScreenContainer } from "@/components/screen-container";
import {
  useExpense,
  type CreditCard as CreditCardRecord,
} from "@/lib/expense-context";
import { useThemeTokens } from "@/lib/theme-provider";
import { Ionicons } from "@expo/vector-icons";
import { Animated, FadeInUp } from "@/lib/motion";
import {
  Button,
  ConfirmSheet,
  CreditCard,
  EmptyState,
  GlassSurface,
  ScreenHeader,
  Sheet,
} from "@/components/ui";
import { useToast } from "@/components/ui/ToastProvider";
import { useConfirm } from "@/hooks/use-confirm";
import { ContentMaxWidth, getElevationStyle } from "@/lib/_core/theme";
import { TAB_BAR_CLEARANCE } from "@/lib/_core/theme";
import { readableTextOn } from "@/lib/_core/contrast";
import { useCurrency } from "@/lib/currency-provider";
import { getCurrencySymbol } from "@/lib/currency";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import {
  isCardFormValid,
  maskCardLastFour,
  type CardFormValues,
} from "@/lib/card-form-validation";

const PREDEFINED_COLORS = [
  "#6366F1",
  "#EC4899",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
  "#EF4444",
  "#06B6D4",
  "#14B8A6",
];

const CARD_TYPES = ["credit", "debit"] as const;

type SheetMode = "add" | "edit" | null;

const EMPTY_FORM: CardFormValues = {
  cardName: "",
  cardNumber: "",
  cardholderName: "",
  expiryMonth: "",
  expiryYear: "",
  creditLimit: "",
  cardType: "credit",
};

function CardFormFields({
  mode,
  values,
  selectedColor,
  maskedCardNumber,
  onChange,
  onSelectColor,
}: {
  mode: "add" | "edit";
  values: CardFormValues;
  selectedColor: string;
  maskedCardNumber?: string;
  onChange: (patch: Partial<CardFormValues>) => void;
  onSelectColor: (color: string) => void;
}) {
  // Same active-theme token source the surface primitives read — never
  // the theme-agnostic useColors() (frozen to the default theme; AC4).
  const { colors } = useThemeTokens();
  const { currency } = useCurrency();

  return (
    <>
      <View>
        <Text className="text-sm font-semibold text-foreground mb-2">
          Card Name
        </Text>
        <View
          className="px-4 py-3.5 rounded-xl flex-row items-center"
          style={{
            backgroundColor: colors.background,
            borderWidth: 0.5,
            borderColor: colors.border,
          }}
        >
          <TextInput
            placeholder="e.g., My Visa"
            placeholderTextColor={colors.muted}
            value={values.cardName}
            onChangeText={(cardName) => onChange({ cardName })}
            className="flex-1 text-foreground"
            style={{ fontSize: 15 }}
          />
        </View>
      </View>

      {mode === "add" ? (
        <View>
          <Text className="text-sm font-semibold text-foreground mb-2">
            Card Number
          </Text>
          <View
            className="px-4 py-3.5 rounded-xl flex-row items-center"
            style={{
              backgroundColor: colors.background,
              borderWidth: 0.5,
              borderColor: colors.border,
            }}
          >
            <TextInput
              placeholder="1234 5678 9012 3456"
              placeholderTextColor={colors.muted}
              value={values.cardNumber}
              onChangeText={(cardNumber) => onChange({ cardNumber })}
              className="flex-1 text-foreground"
              keyboardType="numeric"
              style={{ fontSize: 15 }}
            />
          </View>
        </View>
      ) : (
        <View>
          <Text className="text-sm font-semibold text-foreground mb-2">
            Card Number
          </Text>
          <View
            className="px-4 py-3.5 rounded-xl"
            style={{
              backgroundColor: colors.background,
              borderWidth: 0.5,
              borderColor: colors.border,
            }}
            accessibilityLabel={`Card number masked, ending in ${maskedCardNumber?.slice(-4) ?? "unknown"}`}
          >
            <Text
              className="text-foreground font-semibold"
              style={{ fontSize: 15 }}
            >
              {maskedCardNumber ?? "•••• •••• •••• ••••"}
            </Text>
          </View>
        </View>
      )}

      <View>
        <Text className="text-sm font-semibold text-foreground mb-2">
          Cardholder Name
        </Text>
        <View
          className="px-4 py-3.5 rounded-xl flex-row items-center"
          style={{
            backgroundColor: colors.background,
            borderWidth: 0.5,
            borderColor: colors.border,
          }}
        >
          <TextInput
            placeholder="John Doe"
            placeholderTextColor={colors.muted}
            value={values.cardholderName}
            onChangeText={(cardholderName) => onChange({ cardholderName })}
            className="flex-1 text-foreground"
            style={{ fontSize: 15 }}
          />
        </View>
      </View>

      <View className="flex-row gap-3">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-foreground mb-2">
            Expiry Month
          </Text>
          <View
            className="px-4 py-3.5 rounded-xl"
            style={{
              backgroundColor: colors.background,
              borderWidth: 0.5,
              borderColor: colors.border,
            }}
          >
            <TextInput
              placeholder="MM"
              placeholderTextColor={colors.muted}
              value={values.expiryMonth}
              onChangeText={(expiryMonth) => onChange({ expiryMonth })}
              className="text-foreground"
              keyboardType="numeric"
              maxLength={2}
              style={{ fontSize: 15 }}
            />
          </View>
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-foreground mb-2">
            Expiry Year
          </Text>
          <View
            className="px-4 py-3.5 rounded-xl"
            style={{
              backgroundColor: colors.background,
              borderWidth: 0.5,
              borderColor: colors.border,
            }}
          >
            <TextInput
              placeholder="YYYY"
              placeholderTextColor={colors.muted}
              value={values.expiryYear}
              onChangeText={(expiryYear) => onChange({ expiryYear })}
              className="text-foreground"
              keyboardType="numeric"
              maxLength={4}
              style={{ fontSize: 15 }}
            />
          </View>
        </View>
      </View>

      <View>
        <Text className="text-sm font-semibold text-foreground mb-2">
          Credit Limit
        </Text>
        <View
          className="px-4 py-3.5 rounded-xl flex-row items-center"
          style={{
            backgroundColor: colors.background,
            borderWidth: 0.5,
            borderColor: colors.border,
          }}
        >
          {/* SP-029: was a hard-coded "$" while the list formatted with the
           * user's currency. */}
          <Text className="text-foreground mr-2 font-semibold">
            {getCurrencySymbol(currency)}
          </Text>
          <TextInput
            placeholder="5000"
            placeholderTextColor={colors.muted}
            value={values.creditLimit}
            onChangeText={(creditLimit) => onChange({ creditLimit })}
            className="flex-1 text-foreground"
            keyboardType="decimal-pad"
            style={{ fontSize: 15 }}
          />
        </View>
      </View>

      <View>
        <Text className="text-sm font-semibold text-foreground mb-2">
          Card Type
        </Text>
        <View className="flex-row gap-3">
          {CARD_TYPES.map((type) => (
            <Pressable
              key={type}
              onPress={() => onChange({ cardType: type })}
              className="flex-1 py-3 rounded-xl items-center capitalize"
              style={{
                backgroundColor:
                  values.cardType === type ? colors.primary : colors.background,
                borderWidth: values.cardType === type ? 0 : 0.5,
                borderColor: colors.border,
              }}
              accessibilityRole="button"
              accessibilityLabel={`${type} card type`}
              accessibilityState={{ selected: values.cardType === type }}
            >
              <Text
                className="font-semibold capitalize"
                style={{
                  color: values.cardType === type ? "white" : colors.foreground,
                }}
              >
                {type}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View>
        <Text className="text-sm font-semibold text-foreground mb-3">
          Choose Color
        </Text>
        <View className="flex-row flex-wrap gap-3">
          {PREDEFINED_COLORS.map((color) => (
            <Pressable
              key={color}
              onPress={() => onSelectColor(color)}
              accessibilityRole="button"
              accessibilityLabel={`Select color ${color}`}
              accessibilityState={{ selected: selectedColor === color }}
              className="w-12 h-12 rounded-full items-center justify-center"
              style={{
                backgroundColor: color,
                borderWidth: selectedColor === color ? 3 : 0,
                borderColor: colors.foreground,
              }}
            >
              {selectedColor === color && (
                // SP-047: was hard-coded white — 2.15:1 on #F59E0B.
                <Ionicons
                  name="checkmark"
                  size={20}
                  color={readableTextOn(color)}
                />
              )}
            </Pressable>
          ))}
        </View>
      </View>
    </>
  );
}

export default function CardsScreen() {
  const router = useRouter();
  // Same active-theme token source the surface primitives read — never
  // the theme-agnostic useColors() (frozen to the default theme; AC4).
  const { colors } = useThemeTokens();
  const {
    creditCards,
    loadingCards,
    addCreditCard,
    updateCreditCard,
    deleteCreditCard,
    refreshCreditCards,
  } = useExpense();
  const toast = useToast();
  const {
    visible: confirmVisible,
    options: confirmOptions,
    confirm,
    onConfirm,
    onCancel,
  } = useConfirm();
  const [sheetMode, setSheetMode] = useState<SheetMode>(null);
  const [editingCard, setEditingCard] = useState<CreditCardRecord | null>(null);
  const [formValues, setFormValues] = useState<CardFormValues>(EMPTY_FORM);
  const [selectedColor, setSelectedColor] = useState(PREDEFINED_COLORS[0]);
  const [saving, setSaving] = useState(false);
  // Synchronous double-submit guard: rapid taps land before React re-renders
  // the disabled/loading state, so the async `saving` state alone can't stop
  // a same-tick second press.
  const savingRef = useRef(false);

  const onRefresh = useCallback(async () => {
    await refreshCreditCards();
  }, [refreshCreditCards]);
  const refreshProps = usePullToRefresh(onRefresh);

  const desktopActionStyle: ViewStyle | undefined =
    Platform.OS === "web" ? { alignSelf: "flex-start" } : undefined;
  const cardPreviewStyle: ViewStyle | undefined =
    Platform.OS === "web"
      ? {
          width: "100%" as const,
          maxWidth: ContentMaxWidth.card,
          alignSelf: "flex-start",
        }
      : undefined;

  const resetForm = useCallback(() => {
    setFormValues(EMPTY_FORM);
    setSelectedColor(PREDEFINED_COLORS[0]);
    setEditingCard(null);
    setSheetMode(null);
  }, []);

  const openAddSheet = useCallback(() => {
    setFormValues(EMPTY_FORM);
    setSelectedColor(PREDEFINED_COLORS[0]);
    setEditingCard(null);
    setSheetMode("add");
  }, []);

  const openEditSheet = useCallback((card: CreditCardRecord) => {
    setEditingCard(card);
    setFormValues({
      cardName: card.name,
      cardNumber: "",
      cardholderName: card.cardholderName,
      expiryMonth: String(card.expiryMonth),
      expiryYear: String(card.expiryYear),
      creditLimit: card.creditLimit,
      cardType: card.cardType || "credit",
    });
    setSelectedColor(card.color || PREDEFINED_COLORS[0]);
    setSheetMode("edit");
  }, []);

  const closeSheet = useCallback(() => {
    resetForm();
  }, [resetForm]);

  const formValid = useMemo(() => {
    if (!sheetMode) return false;
    return isCardFormValid(formValues, sheetMode);
  }, [formValues, sheetMode]);

  const handleAddCard = async () => {
    if (savingRef.current) return;
    if (!isCardFormValid(formValues, "add")) {
      toast.show({
        type: "error",
        message: "Please fill in all fields correctly",
      });
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      await addCreditCard({
        name: formValues.cardName.trim(),
        cardNumber: formValues.cardNumber.trim(),
        cardholderName: formValues.cardholderName.trim(),
        expiryMonth: parseInt(formValues.expiryMonth, 10),
        expiryYear: parseInt(formValues.expiryYear, 10),
        creditLimit: formValues.creditLimit.trim(),
        color: selectedColor,
        cardType: formValues.cardType,
        currentBalance: "0",
        isActive: true,
      } as any);
    } catch {
      return;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }

    resetForm();
  };

  const handleUpdateCard = async () => {
    if (savingRef.current) return;
    if (!editingCard || !isCardFormValid(formValues, "edit")) {
      toast.show({
        type: "error",
        message: "Please fill in all fields correctly",
      });
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: formValues.cardName.trim(),
        cardholderName: formValues.cardholderName.trim(),
        expiryMonth: parseInt(formValues.expiryMonth, 10),
        expiryYear: parseInt(formValues.expiryYear, 10),
        creditLimit: formValues.creditLimit.trim(),
        color: selectedColor,
        cardType: formValues.cardType,
      };
      const trimmedNumber = formValues.cardNumber.trim();
      if (trimmedNumber) {
        payload.cardNumber = trimmedNumber;
      }
      await updateCreditCard(
        editingCard.id,
        payload as Partial<CreditCardRecord>,
      );
    } catch {
      return;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }

    resetForm();
  };

  const sheetTitle = sheetMode === "edit" ? "Edit Card" : "New Card";
  const sheetTestId =
    sheetMode === "edit" ? "edit-card-sheet" : "add-card-sheet";

  return (
    <ScreenContainer className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
        refreshControl={<RefreshControl {...refreshProps} />}
      >
        <ResponsiveContent maxWidth={ContentMaxWidth.screen}>
          <ScreenHeader
            title="Cards"
            subtitle={`${creditCards.length} card${creditCards.length !== 1 ? "s" : ""}`}
            accessibilityLabel="Cards screen"
          />

          <Animated.View
            entering={FadeInUp.delay(100).duration(500)}
            className="px-6 mt-5"
          >
            <Button
              variant="primary"
              label="Add New Card"
              leftIcon={<Ionicons name="add" size={18} color="white" />}
              onPress={openAddSheet}
              style={desktopActionStyle}
              size="lg"
              testID="add-card-button"
            />
          </Animated.View>

          <View className="px-6 mt-6">
            {loadingCards ? (
              <View className="items-center justify-center py-20">
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : creditCards.length > 0 ? (
              <Animated.View entering={FadeInUp.delay(150).duration(500)}>
                <FlatList
                  data={creditCards}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={({ item, index }) => (
                    <View
                      style={cardPreviewStyle}
                      testID={`card-preview-${index}`}
                    >
                      <CreditCard
                        name={item.name}
                        cardNumberLast4={item.cardNumberLast4}
                        cardholderName={item.cardholderName}
                        expiryMonth={item.expiryMonth}
                        expiryYear={item.expiryYear}
                        color={item.color}
                        index={index}
                        onPress={() => router.push(`/card/${item.id}`)}
                        onLongPress={async () => {
                          const confirmed = await confirm({
                            title: "Delete Card",
                            message: `Are you sure you want to delete "${item.name}"?`,
                            destructive: true,
                            confirmLabel: "Delete",
                          });
                          if (confirmed) {
                            try {
                              await deleteCreditCard(item.id);
                            } catch {
                              // deleteCreditCard rolled back + showed error toast
                            }
                          }
                        }}
                        onEdit={() => openEditSheet(item)}
                      />
                    </View>
                  )}
                  scrollEnabled={false}
                />
              </Animated.View>
            ) : (
              <Animated.View
                entering={FadeInUp.delay(150).duration(500)}
                className="rounded-3xl overflow-hidden"
                style={getElevationStyle("sm", colors.foreground)}
              >
                {/* Frosted glass surface, opaque AA-safe tint fallback when blur
                 * is unsupported/disabled (Story 12.3, RDR-3) — borderRadius
                 * matches the rounded-3xl container so the surface's 1px
                 * border stroke rounds with the card instead of being
                 * clipped square. */}
                <GlassSurface
                  style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
                />
                <EmptyState
                  variant="no-data"
                  icon={
                    <Ionicons
                      name="card-outline"
                      size={28}
                      color={colors.muted}
                    />
                  }
                  title="No cards added yet"
                  description="Add your first card to get started"
                  action={{ label: "Add Card", onPress: openAddSheet }}
                />
              </Animated.View>
            )}
          </View>
        </ResponsiveContent>
      </ScrollView>

      <ConfirmSheet
        visible={confirmVisible}
        onConfirm={onConfirm}
        onCancel={onCancel}
        {...confirmOptions}
      />

      <Sheet
        visible={sheetMode !== null}
        onClose={closeSheet}
        title={sheetTitle}
        testID={sheetTestId}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          // flexShrink lets the Sheet's 90% height cap bound this ScrollView
          // so the form scrolls (instead of overflowing) on short viewports.
          style={{ flexShrink: 1 }}
          contentContainerStyle={{ gap: 16, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {sheetMode && (
            <CardFormFields
              mode={sheetMode}
              values={formValues}
              selectedColor={selectedColor}
              maskedCardNumber={
                sheetMode === "edit" && editingCard
                  ? maskCardLastFour(editingCard.cardNumberLast4)
                  : undefined
              }
              onChange={(patch) =>
                setFormValues((prev) => ({ ...prev, ...patch }))
              }
              onSelectColor={setSelectedColor}
            />
          )}

          <View className="flex-row gap-3 mt-2">
            <Button
              variant="secondary"
              label="Cancel"
              onPress={closeSheet}
              className="flex-1"
              size="lg"
            />
            <Button
              variant="primary"
              label={sheetMode === "edit" ? "Save" : "Add Card"}
              onPress={sheetMode === "edit" ? handleUpdateCard : handleAddCard}
              disabled={!formValid}
              loading={saving}
              className="flex-1"
              size="lg"
            />
          </View>
        </ScrollView>
      </Sheet>
    </ScreenContainer>
  );
}

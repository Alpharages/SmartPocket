import React, { useCallback, useState } from "react";
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
import { ContentMaxWidth, getElevationStyle } from "@/lib/_core/theme";
import { TAB_BAR_CLEARANCE } from "@/lib/_core/theme";
import { useExpense, type Category } from "@/lib/expense-context";
import { useThemeTokens } from "@/lib/theme-provider";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import {
  CATEGORY_COLOR_LIGHT_VALUES,
  DEFAULT_CATEGORY_ICON,
} from "@/constants/theme";
import {
  Button,
  CategoryToken,
  ConfirmSheet,
  EmptyState,
  GlassSurface,
  ScreenHeader,
  Sheet,
} from "@/components/ui";
import { useConfirm } from "@/hooks/use-confirm";
import { usePressFeedback } from "@/hooks/use-press-feedback";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { AnimatedPressable } from "@/lib/_core/nativewind-pressable";
import { readableTextOn } from "@/lib/_core/contrast";

/**
 * A single category row. Extracted into its own component so it can use the
 * shared scale-0.97 + haptic press feedback hook (Story 1.18 AC5) at the
 * component top level rather than inside a FlatList render callback.
 *
 * Lesson 90e1d916: long-press is gesture-only → expose delete via
 * accessibilityActions so VoiceOver/TalkBack users can invoke it without
 * performing the swipe/long-press gesture (NFR-5).
 */
function CategoryRow({
  item,
  index,
  mutedColor,
  errorColor,
  onEdit,
  onRequestDelete,
}: {
  item: Category;
  index: number;
  mutedColor: string;
  errorColor: string;
  onEdit: (item: Category) => void;
  onRequestDelete: (item: Category) => void;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressFeedback();
  return (
    <Animated.View entering={FadeInDown.delay(index * 30).duration(400)}>
      <AnimatedPressable
        onPress={() => onEdit(item)}
        onLongPress={() => onRequestDelete(item)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${item.type} category`}
        accessibilityHint="Opens edit. Long press to delete."
        accessibilityActions={[
          { name: "edit", label: `Edit ${item.name}` },
          { name: "delete", label: `Delete ${item.name}` },
        ]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === "delete") onRequestDelete(item);
          if (e.nativeEvent.actionName === "edit") onEdit(item);
        }}
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingHorizontal: 16,
            // ≥44pt touch target (NFR-5)
            minHeight: 44,
            paddingVertical: 14,
          },
          animatedStyle,
        ]}
      >
        <CategoryToken
          name={item.name}
          color={item.color}
          icon={item.icon || DEFAULT_CATEGORY_ICON}
          state="default"
          size="md"
        />
        <View className="flex-1">
          {/* SP-070: the type subtitle repeated the section heading this row
           * already sits under ("Expense" under "Expense Categories"). */}
          <Text className="text-foreground font-semibold text-sm">
            {item.name}
          </Text>
        </View>
        <Ionicons name="pencil" size={16} color={mutedColor} />
        {/* SP-037: delete was long-press-only with no visual affordance. */}
        <Pressable
          onPress={() => onRequestDelete(item)}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${item.name}`}
          hitSlop={8}
          className="items-center justify-center"
          style={{ minWidth: 44, minHeight: 44 }}
        >
          <Ionicons name="trash-outline" size={16} color={errorColor} />
        </Pressable>
      </AnimatedPressable>
    </Animated.View>
  );
}

export default function CategoriesScreen() {
  // Same active-theme token source the surface primitives read — never
  // the theme-agnostic useColors() (frozen to the default theme; AC2).
  const { colors } = useThemeTokens();
  const desktopActionStyle: ViewStyle | undefined =
    Platform.OS === "web" ? { alignSelf: "flex-start" } : undefined;
  const {
    categories,
    loadingCategories,
    transactions,
    addCategory,
    updateCategory,
    deleteCategory,
    refreshCategories,
  } = useExpense();
  const {
    visible: confirmVisible,
    options: confirmOptions,
    confirm,
    onConfirm,
    onCancel,
  } = useConfirm();
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [categoryType, setCategoryType] = useState<"income" | "expense">(
    "expense",
  );
  const [categoryName, setCategoryName] = useState("");
  const [selectedColor, setSelectedColor] = useState(
    CATEGORY_COLOR_LIGHT_VALUES[0],
  );

  const expenseCategories = categories.filter((c) => c.type === "expense");
  const incomeCategories = categories.filter((c) => c.type === "income");

  const onRefresh = useCallback(async () => {
    await refreshCategories();
  }, [refreshCategories]);
  const refreshProps = usePullToRefresh(onRefresh);

  const openCreateSheet = useCallback(
    (type: "income" | "expense" = "expense") => {
      setEditingCategory(null);
      setCategoryName("");
      setCategoryType(type);
      setSelectedColor(CATEGORY_COLOR_LIGHT_VALUES[0]);
      setShowModal(true);
    },
    [],
  );

  // SP-016: categories could be created and deleted but never edited, so
  // renaming one meant delete + re-create, which orphaned every transaction
  // in it.
  const openEditSheet = useCallback((item: Category) => {
    setEditingCategory(item);
    setCategoryName(item.name);
    setCategoryType(item.type);
    setSelectedColor(item.color || CATEGORY_COLOR_LIGHT_VALUES[0]);
    setShowModal(true);
  }, []);

  const handleSaveCategory = async () => {
    const name = categoryName.trim();
    if (!name || saving) return;

    setSaving(true);
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, {
          name,
          type: categoryType,
          color: selectedColor,
          icon: editingCategory.icon || DEFAULT_CATEGORY_ICON,
        });
      } else {
        await addCategory({
          name,
          type: categoryType,
          color: selectedColor,
          icon: DEFAULT_CATEGORY_ICON,
          isDefault: false,
        });
      }
    } catch {
      // The context rolled back and showed an error toast before re-throwing.
      // Keep the sheet open so the entry is not lost.
      return;
    } finally {
      setSaving(false);
    }

    setCategoryName("");
    setCategoryType("expense");
    setSelectedColor(CATEGORY_COLOR_LIGHT_VALUES[0]);
    setEditingCategory(null);
    setShowModal(false);
  };

  const requestDelete = async (item: Category) => {
    // SP-032: the confirmation named the category but never said how many
    // transactions would be orphaned — they silently became "Uncategorized"
    // and dropped out of the Insights breakdown.
    const affected = transactions.filter(
      (t) => t.categoryId === item.id,
    ).length;
    const message =
      affected > 0
        ? `"${item.name}" is used by ${affected} transaction${
            affected === 1 ? "" : "s"
          }. Deleting it leaves ${
            affected === 1 ? "it" : "them"
          } uncategorised and removes ${
            affected === 1 ? "it" : "them"
          } from your spending breakdown.`
        : `Are you sure you want to delete "${item.name}"?`;

    const confirmed = await confirm({
      title: "Delete Category",
      message,
      destructive: true,
      confirmLabel: "Delete",
    });
    if (confirmed) {
      try {
        await deleteCategory(item.id);
      } catch {
        // deleteCategory rolled back + showed an error toast before
        // re-throwing; swallow to avoid an unhandled rejection.
      }
    }
  };

  const renderCategoryItem = ({
    item,
    index,
  }: {
    item: Category;
    index: number;
  }) => (
    <CategoryRow
      item={item}
      index={index}
      mutedColor={colors.muted}
      errorColor={colors.error}
      onEdit={openEditSheet}
      onRequestDelete={requestDelete}
    />
  );

  const renderCategorySection = (
    title: string,
    data: Category[],
    startIndex: number,
  ) => (
    <Animated.View
      entering={FadeInUp.delay(startIndex * 50).duration(500)}
      className="mb-6"
    >
      <Text className="text-lg font-bold text-foreground mb-3">{title}</Text>
      {data.length > 0 ? (
        <View
          className="rounded-3xl overflow-hidden"
          style={getElevationStyle("sm", colors.foreground)}
        >
          {/* Frosted glass surface, opaque AA-safe tint fallback when blur is
           * unsupported/disabled (Story 12.3, RDR-3) — borderRadius matches
           * the rounded-3xl container so the surface's 1px border stroke
           * rounds with the card instead of being clipped square. */}
          <GlassSurface
            style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
          />
          <FlatList
            data={data}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item, index }) =>
              renderCategoryItem({ item, index: startIndex + index })
            }
            scrollEnabled={false}
            ItemSeparatorComponent={() => (
              <View
                className="mx-4"
                style={{ height: 0.5, backgroundColor: colors.border }}
              />
            )}
          />
        </View>
      ) : (
        <View className="rounded-3xl overflow-hidden">
          <GlassSurface
            style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
          />
          <EmptyState
            variant="no-data"
            icon={
              <Ionicons name="folder-outline" size={28} color={colors.muted} />
            }
            title="No categories yet"
            description={`Add your first ${title.toLowerCase().replace(" categories", "")} category`}
            action={{
              label: "Add Category",
              // SP-049: this opened the sheet defaulted to Expense even under
              // the "Income Categories" heading.
              onPress: () =>
                openCreateSheet(
                  title.toLowerCase().includes("income") ? "income" : "expense",
                ),
            }}
          />
        </View>
      )}
    </Animated.View>
  );

  return (
    <ScreenContainer className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
        refreshControl={<RefreshControl {...refreshProps} />}
      >
        <ResponsiveContent maxWidth={ContentMaxWidth.screen}>
          {/* SP-065: use the shared ScreenHeader — hand-rolling it here put the
           * title at (24,24) while every other screen sits at (16,12), so the
           * heading visibly jumped when switching to this screen. */}
          <Animated.View entering={FadeInDown.duration(500)}>
            <ScreenHeader
              title="Categories"
              subtitle={`${categories.length} categor${
                categories.length !== 1 ? "ies" : "y"
              }`}
              accessibilityLabel="Categories screen"
            />
          </Animated.View>

          {/* Add Category Button — proper Button primitive, not a full-width banner */}
          <Animated.View
            entering={FadeInUp.delay(100).duration(500)}
            className="px-lg mt-5"
          >
            <Button
              variant="primary"
              label="Add New Category"
              leftIcon={<Ionicons name="add" size={18} color="white" />}
              onPress={() => setShowModal(true)}
              style={desktopActionStyle}
              testID="add-category-button"
            />
          </Animated.View>

          {/* Categories Lists */}
          <View className="px-lg mt-6">
            {loadingCategories ? (
              <View className="items-center justify-center py-20">
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <>
                {renderCategorySection(
                  "Expense Categories",
                  expenseCategories,
                  0,
                )}
                {renderCategorySection(
                  "Income Categories",
                  incomeCategories,
                  expenseCategories.length,
                )}
              </>
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
        visible={showModal}
        onClose={() => {
          setEditingCategory(null);
          setShowModal(false);
        }}
        title={editingCategory ? "Edit Category" : "New Category"}
        testID="add-category-sheet"
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 16, paddingBottom: 24 }}
        >
          {/* Category Type Toggle */}
          <View className="flex-row gap-3">
            {(["expense", "income"] as const).map((type) => (
              <Pressable
                key={type}
                onPress={() => setCategoryType(type)}
                accessibilityRole="button"
                accessibilityLabel={`${type} category type`}
                accessibilityState={{ selected: categoryType === type }}
                className="flex-1 py-3 rounded-xl items-center"
                style={{
                  backgroundColor:
                    categoryType === type ? colors.primary : colors.background,
                  borderWidth: categoryType === type ? 0 : 0.5,
                  borderColor: colors.border,
                  minHeight: 44,
                }}
              >
                <Text
                  className="font-semibold capitalize"
                  style={{
                    color: categoryType === type ? "white" : colors.foreground,
                  }}
                >
                  {type}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Category Name Input */}
          <View>
            <Text className="text-sm font-semibold text-foreground mb-2">
              Category Name
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
                placeholder="e.g., Groceries"
                placeholderTextColor={colors.muted}
                value={categoryName}
                onChangeText={setCategoryName}
                className="flex-1 text-foreground"
                style={{ fontSize: 15 }}
              />
            </View>
          </View>

          {/* Color Picker */}
          <View>
            <Text className="text-sm font-semibold text-foreground mb-3">
              Choose Color
            </Text>
            <View className="flex-row flex-wrap gap-3">
              {CATEGORY_COLOR_LIGHT_VALUES.map((color) => (
                <Pressable
                  key={color}
                  onPress={() => setSelectedColor(color)}
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

          {/* Action Buttons */}
          <View className="flex-row gap-3 mt-2">
            <Pressable
              onPress={() => {
                setEditingCategory(null);
                setShowModal(false);
              }}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              className="flex-1 py-3.5 rounded-xl items-center"
              style={{
                backgroundColor: colors.background,
                borderWidth: 0.5,
                borderColor: colors.border,
                minHeight: 44,
              }}
            >
              <Text className="text-foreground font-semibold">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSaveCategory}
              disabled={!categoryName.trim()}
              accessibilityRole="button"
              accessibilityLabel={
                editingCategory ? "Save Category" : "Add Category"
              }
              accessibilityState={{ disabled: !categoryName.trim() }}
              className="flex-1 py-3.5 rounded-xl items-center"
              style={{
                backgroundColor: categoryName.trim()
                  ? colors.primary
                  : colors.muted,
                minHeight: 44,
              }}
            >
              <Text className="text-white font-semibold">
                {editingCategory ? "Save" : "Add Category"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </Sheet>
    </ScreenContainer>
  );
}

import React, { useState } from "react";
import {
  ScrollView,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  FlatList,
  TextInput,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useExpense, type Category } from "@/lib/expense-context";
import { useColors } from "@/hooks/use-colors";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { CATEGORY_COLOR_LIGHT_VALUES } from "@/constants/theme";
import { Button, CategoryToken, EmptyState, Sheet } from "@/components/ui";

export default function CategoriesScreen() {
  const colors = useColors();
  const { categories, loadingCategories, addCategory, deleteCategory } =
    useExpense();
  const [showModal, setShowModal] = useState(false);
  const [categoryType, setCategoryType] = useState<"income" | "expense">(
    "expense",
  );
  const [categoryName, setCategoryName] = useState("");
  const [selectedColor, setSelectedColor] = useState(
    CATEGORY_COLOR_LIGHT_VALUES[0],
  );

  const expenseCategories = categories.filter((c) => c.type === "expense");
  const incomeCategories = categories.filter((c) => c.type === "income");

  const handleAddCategory = async () => {
    if (!categoryName.trim()) return;

    await addCategory({
      name: categoryName,
      type: categoryType,
      color: selectedColor,
      icon: "tag",
      isDefault: false,
    });

    setCategoryName("");
    setCategoryType("expense");
    setSelectedColor(CATEGORY_COLOR_LIGHT_VALUES[0]);
    setShowModal(false);
  };

  const renderCategoryItem = ({
    item,
    index,
  }: {
    item: Category;
    index: number;
  }) => {
    return (
      <Animated.View entering={FadeInDown.delay(index * 30).duration(400)}>
        {/* Lesson 90e1d916: long-press is gesture-only → expose delete via
            accessibilityActions so VoiceOver/TalkBack users can invoke it
            without performing the swipe/long-press gesture (NFR-5). */}
        <Pressable
          onLongPress={() => deleteCategory(item.id)}
          accessibilityRole="button"
          accessibilityLabel={`${item.name}, ${item.type} category`}
          accessibilityHint="Long press to delete"
          accessibilityActions={[{ name: "delete", label: `Delete ${item.name}` }]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === "delete") deleteCategory(item.id);
          }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingHorizontal: 16,
            // ≥44pt touch target (NFR-5)
            minHeight: 44,
            paddingVertical: 14,
          }}
        >
          <CategoryToken
            name={item.name}
            color={item.color}
            icon={item.icon || "tag"}
            state="default"
            size="md"
          />
          <View className="flex-1">
            <Text className="text-foreground font-semibold text-sm">
              {item.name}
            </Text>
            <Text className="text-xs text-muted capitalize mt-0.5">
              {item.type}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </Pressable>
      </Animated.View>
    );
  };

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
        <View
          className="rounded-3xl overflow-hidden"
          style={{ backgroundColor: colors.surface }}
        >
          <EmptyState
            variant="no-data"
            icon={
              <Ionicons name="folder-outline" size={28} color={colors.muted} />
            }
            title="No categories yet"
            description={`Add your first ${title.toLowerCase().replace(" categories", "")} category`}
            action={{
              label: "Add Category",
              onPress: () => setShowModal(true),
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
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Header */}
        <Animated.View
          entering={FadeInDown.duration(500)}
          className="px-6 pt-6 pb-2"
        >
          <Text className="text-[28px] font-bold text-foreground">
            Categories
          </Text>
          <Text className="text-sm text-muted font-medium mt-1">
            {categories.length} categor{categories.length !== 1 ? "ies" : "y"}
          </Text>
        </Animated.View>

        {/* Add Category Button — proper Button primitive, not a full-width banner */}
        <Animated.View
          entering={FadeInUp.delay(100).duration(500)}
          className="px-6 mt-5"
        >
          <Button
            variant="primary"
            label="Add New Category"
            leftIcon={<Ionicons name="add" size={18} color="white" />}
            onPress={() => setShowModal(true)}
            testID="add-category-button"
          />
        </Animated.View>

        {/* Categories Lists */}
        <View className="px-6 mt-6">
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
      </ScrollView>

      <Sheet
        visible={showModal}
        onClose={() => setShowModal(false)}
        title="New Category"
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
                className="flex-1 py-3 rounded-xl items-center"
                style={{
                  backgroundColor:
                    categoryType === type ? colors.primary : colors.background,
                  borderWidth: categoryType === type ? 0 : 0.5,
                  borderColor: colors.border,
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
                  className="w-12 h-12 rounded-full items-center justify-center"
                  style={{
                    backgroundColor: color,
                    borderWidth: selectedColor === color ? 3 : 0,
                    borderColor: colors.foreground,
                  }}
                >
                  {selectedColor === color && (
                    <Ionicons name="checkmark" size={20} color="white" />
                  )}
                </Pressable>
              ))}
            </View>
          </View>

          {/* Action Buttons */}
          <View className="flex-row gap-3 mt-2">
            <Pressable
              onPress={() => setShowModal(false)}
              className="flex-1 py-3.5 rounded-xl items-center"
              style={{
                backgroundColor: colors.background,
                borderWidth: 0.5,
                borderColor: colors.border,
              }}
            >
              <Text className="text-foreground font-semibold">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleAddCategory}
              disabled={!categoryName.trim()}
              className="flex-1 py-3.5 rounded-xl items-center"
              style={{
                backgroundColor: categoryName.trim()
                  ? colors.primary
                  : colors.muted,
              }}
            >
              <Text className="text-white font-semibold">Add Category</Text>
            </Pressable>
          </View>
        </ScrollView>
      </Sheet>
    </ScreenContainer>
  );
}

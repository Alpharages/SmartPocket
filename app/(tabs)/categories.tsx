import {
  ScrollView,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  FlatList,
  Modal,
  TextInput,
  StyleSheet,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useExpense } from "@/lib/expense-context";
import { useColors } from "@/hooks/use-colors";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { CATEGORY_COLOR_LIGHT_VALUES } from "@/constants/theme";
import { CategoryToken } from "@/components/ui/CategoryToken";

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
    setSelectedColor(CATEGORY_COLOR_LIGHT_VALUES[0]);
    setShowModal(false);
  };

  const renderCategoryItem = ({
    item,
    index,
  }: {
    item: any;
    index: number;
  }) => {
    return (
      <Animated.View entering={FadeInDown.delay(index * 30).duration(400)}>
        <Pressable
          onLongPress={() => deleteCategory(item.id)}
          className="flex-row items-center gap-3 py-3.5 px-4 active:opacity-70"
        >
          <CategoryToken
            name={item.name}
            color={item.color}
            icon={item.icon}
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
    data: any[],
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
          className="rounded-3xl p-6 items-center"
          style={{ backgroundColor: colors.surface }}
        >
          <Ionicons name="folder-outline" size={32} color={colors.muted} />
          <Text className="text-muted text-sm mt-2">No categories yet</Text>
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

        {/* Add Category Button */}
        <Animated.View
          entering={FadeInUp.delay(100).duration(500)}
          className="px-6 mt-5"
        >
          <Pressable
            onPress={() => setShowModal(true)}
            style={{ backgroundColor: colors.primary }}
            className="flex-row items-center justify-center gap-2 py-4 rounded-2xl active:opacity-90"
          >
            <Ionicons name="add" size={20} color="white" />
            <Text className="text-white font-semibold">Add New Category</Text>
          </Pressable>
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

      {/* Add Category Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View
          className="flex-1 justify-end"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
        >
          <Animated.View
            entering={FadeInUp.duration(400)}
            className="rounded-t-3xl p-6 gap-4"
            style={{ backgroundColor: colors.surface, maxHeight: "85%" }}
          >
            {/* Handle indicator */}
            <View className="items-center mb-2">
              <View
                className="w-10 h-1 rounded-full"
                style={{ backgroundColor: colors.border }}
              />
            </View>

            {/* Header */}
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-xl font-bold text-foreground">
                New Category
              </Text>
              <Pressable onPress={() => setShowModal(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </Pressable>
            </View>

            {/* Category Type Toggle */}
            <View className="flex-row gap-3 mb-2">
              {(["expense", "income"] as const).map((type) => (
                <Pressable
                  key={type}
                  onPress={() => setCategoryType(type)}
                  className="flex-1 py-3 rounded-xl items-center"
                  style={{
                    backgroundColor:
                      categoryType === type
                        ? colors.primary
                        : colors.background,
                    borderWidth: categoryType === type ? 0 : 0.5,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    className="font-semibold capitalize"
                    style={{
                      color:
                        categoryType === type ? "white" : colors.foreground,
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
          </Animated.View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

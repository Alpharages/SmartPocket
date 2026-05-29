import { View, Text, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useExpense } from "@/lib/expense-context";
import Animated, { FadeInUp } from "react-native-reanimated";

export default function AddTransactionScreen() {
  const router = useRouter();
  const colors = useColors();
  const { type: queryType } = useLocalSearchParams();
  const { categories, addTransaction } = useExpense();

  const [type, setType] = useState<"income" | "expense">(
    (queryType as "income" | "expense") || "expense"
  );
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [date] = useState(new Date());

  const filteredCategories = categories.filter((c) => c.type === type);

  const handleSave = async () => {
    if (!amount || !selectedCategory) {
      alert("Please fill in all fields");
      return;
    }

    await addTransaction({
      categoryId: selectedCategory,
      type,
      amount,
      description: description || undefined,
      date,
    });

    router.back();
  };

  const isFormValid = amount && selectedCategory;

  return (
    <ScreenContainer className="flex-1 bg-background" edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View className="flex-row items-center justify-between px-6 pt-6 pb-2">
            <Text className="text-[28px] font-bold text-foreground">Add Transaction</Text>
            <Pressable onPress={() => router.back()} hitSlop={8} className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: colors.surface }}>
              <Ionicons name="close" size={22} color={colors.foreground} />
            </Pressable>
          </View>

          {/* Type Selector */}
          <Animated.View entering={FadeInUp.delay(100).duration(400)} className="px-6 mt-6">
            <Text className="text-sm font-semibold text-muted mb-2.5">Transaction Type</Text>
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => {
                  setType("expense");
                  setSelectedCategory(null);
                }}
                className="flex-1 py-3.5 rounded-2xl items-center flex-row justify-center gap-2"
                style={{
                  backgroundColor: type === "expense" ? colors.error + "14" : colors.surface,
                  borderWidth: type === "expense" ? 1.5 : 0.5,
                  borderColor: type === "expense" ? colors.error : colors.border,
                }}
              >
                <Ionicons name="arrow-up" size={16} color={type === "expense" ? colors.error : colors.muted} />
                <Text
                  className="font-semibold"
                  style={{
                    color: type === "expense" ? colors.error : colors.foreground,
                  }}
                >
                  Expense
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setType("income");
                  setSelectedCategory(null);
                }}
                className="flex-1 py-3.5 rounded-2xl items-center flex-row justify-center gap-2"
                style={{
                  backgroundColor: type === "income" ? colors.success + "14" : colors.surface,
                  borderWidth: type === "income" ? 1.5 : 0.5,
                  borderColor: type === "income" ? colors.success : colors.border,
                }}
              >
                <Ionicons name="arrow-down" size={16} color={type === "income" ? colors.success : colors.muted} />
                <Text
                  className="font-semibold"
                  style={{
                    color: type === "income" ? colors.success : colors.foreground,
                  }}
                >
                  Income
                </Text>
              </Pressable>
            </View>
          </Animated.View>

          {/* Amount Input */}
          <Animated.View entering={FadeInUp.delay(150).duration(400)} className="px-6 mt-6">
            <Text className="text-sm font-semibold text-muted mb-2.5">Amount</Text>
            <View
              className="flex-row items-center rounded-2xl px-5 py-4"
              style={{ backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border }}
            >
              <Text className="text-foreground text-2xl font-bold mr-2">$</Text>
              <TextInput
                placeholder="0.00"
                placeholderTextColor={colors.muted}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                className="flex-1 text-foreground"
                style={{ fontSize: 24, fontWeight: "700" }}
              />
            </View>
          </Animated.View>

          {/* Category Selector */}
          <Animated.View entering={FadeInUp.delay(200).duration(400)} className="px-6 mt-6">
            <Text className="text-sm font-semibold text-muted mb-2.5">Category</Text>
            {filteredCategories.length > 0 ? (
              <View className="flex-row flex-wrap gap-2">
                {filteredCategories.map((cat) => (
                  <Pressable
                    key={cat.id}
                    onPress={() => setSelectedCategory(cat.id)}
                    className="px-4 py-2.5 rounded-xl flex-row items-center gap-2"
                    style={{
                      backgroundColor: selectedCategory === cat.id ? cat.color : colors.surface,
                      borderWidth: selectedCategory === cat.id ? 0 : 0.5,
                      borderColor: colors.border,
                    }}
                  >
                    {selectedCategory === cat.id && (
                      <Ionicons name="checkmark" size={14} color="white" />
                    )}
                    <Text
                      style={{
                        color: selectedCategory === cat.id ? "white" : colors.foreground,
                      }}
                      className="font-semibold text-sm"
                    >
                      {cat.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View className="py-4 px-4 rounded-2xl items-center" style={{ backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border }}>
                <Text className="text-muted text-sm">No {type} categories available</Text>
              </View>
            )}
          </Animated.View>

          {/* Description */}
          <Animated.View entering={FadeInUp.delay(250).duration(400)} className="px-6 mt-6">
            <Text className="text-sm font-semibold text-muted mb-2.5">Description (Optional)</Text>
            <View
              className="rounded-2xl px-4 py-3.5"
              style={{ backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border }}
            >
              <TextInput
                placeholder="Add a note..."
                placeholderTextColor={colors.muted}
                value={description}
                onChangeText={setDescription}
                className="text-foreground"
                style={{ fontSize: 15, minHeight: 60 }}
                multiline
                textAlignVertical="top"
              />
            </View>
          </Animated.View>

          {/* Action Buttons */}
          <Animated.View entering={FadeInUp.delay(300).duration(400)} className="px-6 mt-8 flex-row gap-3">
            <Pressable
              onPress={() => router.back()}
              className="flex-1 py-4 rounded-2xl items-center"
              style={{ backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border }}
            >
              <Text className="font-semibold text-foreground">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={!isFormValid}
              className="flex-1 py-4 rounded-2xl items-center"
              style={{
                backgroundColor: isFormValid ? colors.primary : colors.muted,
                shadowColor: isFormValid ? colors.primary : "transparent",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
                elevation: isFormValid ? 4 : 0,
              }}
            >
              <Text className="font-semibold text-white">Save</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

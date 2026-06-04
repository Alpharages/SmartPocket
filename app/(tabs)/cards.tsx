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
import { useExpense } from "@/lib/expense-context";
import { useColors } from "@/hooks/use-colors";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { EmptyState, Sheet } from "@/components/ui";

const PREDEFINED_COLORS = [
  "#6366F1", "#EC4899", "#10B981", "#F59E0B",
  "#8B5CF6", "#EF4444", "#06B6D4", "#14B8A6",
];

export default function CardsScreen() {
  const colors = useColors();
  const { creditCards, loadingCards, addCreditCard, deleteCreditCard } = useExpense();
  const [showModal, setShowModal] = useState(false);
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardholderName, setCardholderName] = useState("");
  const [expiryMonth, setExpiryMonth] = useState("");
  const [expiryYear, setExpiryYear] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [selectedColor, setSelectedColor] = useState(PREDEFINED_COLORS[0]);

  const handleAddCard = async () => {
    if (!cardName.trim() || !cardNumber.trim() || !cardholderName.trim() || !expiryMonth || !expiryYear || !creditLimit) {
      alert("Please fill in all fields");
      return;
    }

    await addCreditCard({
      name: cardName,
      cardNumber,
      cardholderName,
      expiryMonth: parseInt(expiryMonth),
      expiryYear: parseInt(expiryYear),
      creditLimit,
      color: selectedColor,
      cardType: "credit",
      currentBalance: "0",
      isActive: true,
    } as any);

    setCardName("");
    setCardNumber("");
    setCardholderName("");
    setExpiryMonth("");
    setExpiryYear("");
    setCreditLimit("");
    setSelectedColor(PREDEFINED_COLORS[0]);
    setShowModal(false);
  };

  const renderCardItem = ({ item, index }: { item: any; index: number }) => {
    const lastFourDigits = item.cardNumber.slice(-4);

    return (
      <Animated.View entering={FadeInDown.delay(index * 50).duration(400)}>
        <Pressable
          onLongPress={() => deleteCreditCard(item.id)}
          style={{
            backgroundColor: item.color,
            shadowColor: item.color,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.2,
            shadowRadius: 12,
            elevation: 6,
          }}
          className="rounded-3xl p-6 mb-4 overflow-hidden active:opacity-90"
        >
          <View>
            <View className="flex-row items-center justify-between mb-8">
              <Text className="text-white text-sm font-semibold opacity-80">{item.name}</Text>
              <Ionicons name="card" size={22} color="white" />
            </View>

            <View className="mb-8">
              <Text className="text-white text-xs opacity-60 mb-1">Card Number</Text>
              <Text className="text-white text-xl font-bold tracking-[4px]">
                •••• •••• •••• {lastFourDigits}
              </Text>
            </View>

            <View className="flex-row items-end justify-between">
              <View>
                <Text className="text-white text-xs opacity-60 mb-1">Cardholder</Text>
                <Text className="text-white font-semibold text-sm">{item.cardholderName}</Text>
              </View>
              <View className="items-end">
                <Text className="text-white text-xs opacity-60 mb-1">Expires</Text>
                <Text className="text-white font-semibold text-sm">
                  {String(item.expiryMonth).padStart(2, "0")}/{String(item.expiryYear).slice(-2)}
                </Text>
              </View>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <ScreenContainer className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(500)} className="px-6 pt-6 pb-2">
          <Text className="text-[28px] font-bold text-foreground">Cards</Text>
          <Text className="text-sm text-muted font-medium mt-1">
            {creditCards.length} card{creditCards.length !== 1 ? "s" : ""}
          </Text>
        </Animated.View>

        {/* Add Card Button */}
        <Animated.View entering={FadeInUp.delay(100).duration(500)} className="px-6 mt-5">
          <Pressable
            onPress={() => setShowModal(true)}
            style={{ backgroundColor: colors.primary }}
            className="flex-row items-center justify-center gap-2 py-4 rounded-2xl active:opacity-90"
          >
            <Ionicons name="add" size={20} color="white" />
            <Text className="text-white font-semibold">Add New Card</Text>
          </Pressable>
        </Animated.View>

        {/* Cards List */}
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
                renderItem={renderCardItem}
                scrollEnabled={false}
              />
            </Animated.View>
          ) : (
            <Animated.View
              entering={FadeInUp.delay(150).duration(500)}
              className="rounded-3xl overflow-hidden"
              style={{ backgroundColor: colors.surface }}
            >
              <EmptyState
                variant="no-data"
                icon={<Ionicons name="card-outline" size={28} color={colors.muted} />}
                title="No cards added yet"
                description="Add your first card to get started"
                action={{ label: "Add Card", onPress: () => setShowModal(true) }}
              />
            </Animated.View>
          )}
        </View>
      </ScrollView>

      <Sheet
        visible={showModal}
        onClose={() => setShowModal(false)}
        title="New Card"
        testID="add-card-sheet"
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>
              {/* Card Name Input */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">Card Name</Text>
                <View
                  className="px-4 py-3.5 rounded-xl flex-row items-center"
                  style={{ backgroundColor: colors.background, borderWidth: 0.5, borderColor: colors.border }}
                >
                  <TextInput
                    placeholder="e.g., My Visa"
                    placeholderTextColor={colors.muted}
                    value={cardName}
                    onChangeText={setCardName}
                    className="flex-1 text-foreground"
                    style={{ fontSize: 15 }}
                  />
                </View>
              </View>

              {/* Card Number Input */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">Card Number</Text>
                <View
                  className="px-4 py-3.5 rounded-xl flex-row items-center"
                  style={{ backgroundColor: colors.background, borderWidth: 0.5, borderColor: colors.border }}
                >
                  <TextInput
                    placeholder="1234 5678 9012 3456"
                    placeholderTextColor={colors.muted}
                    value={cardNumber}
                    onChangeText={setCardNumber}
                    className="flex-1 text-foreground"
                    keyboardType="numeric"
                    style={{ fontSize: 15 }}
                  />
                </View>
              </View>

              {/* Cardholder Name Input */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">Cardholder Name</Text>
                <View
                  className="px-4 py-3.5 rounded-xl flex-row items-center"
                  style={{ backgroundColor: colors.background, borderWidth: 0.5, borderColor: colors.border }}
                >
                  <TextInput
                    placeholder="John Doe"
                    placeholderTextColor={colors.muted}
                    value={cardholderName}
                    onChangeText={setCardholderName}
                    className="flex-1 text-foreground"
                    style={{ fontSize: 15 }}
                  />
                </View>
              </View>

              {/* Expiry and Limit Row */}
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground mb-2">Expiry Month</Text>
                  <View
                    className="px-4 py-3.5 rounded-xl"
                    style={{ backgroundColor: colors.background, borderWidth: 0.5, borderColor: colors.border }}
                  >
                    <TextInput
                      placeholder="MM"
                      placeholderTextColor={colors.muted}
                      value={expiryMonth}
                      onChangeText={setExpiryMonth}
                      className="text-foreground"
                      keyboardType="numeric"
                      maxLength={2}
                      style={{ fontSize: 15 }}
                    />
                  </View>
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground mb-2">Expiry Year</Text>
                  <View
                    className="px-4 py-3.5 rounded-xl"
                    style={{ backgroundColor: colors.background, borderWidth: 0.5, borderColor: colors.border }}
                  >
                    <TextInput
                      placeholder="YYYY"
                      placeholderTextColor={colors.muted}
                      value={expiryYear}
                      onChangeText={setExpiryYear}
                      className="text-foreground"
                      keyboardType="numeric"
                      maxLength={4}
                      style={{ fontSize: 15 }}
                    />
                  </View>
                </View>
              </View>

              {/* Credit Limit Input */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">Credit Limit</Text>
                <View
                  className="px-4 py-3.5 rounded-xl flex-row items-center"
                  style={{ backgroundColor: colors.background, borderWidth: 0.5, borderColor: colors.border }}
                >
                  <Text className="text-foreground mr-2 font-semibold">$</Text>
                  <TextInput
                    placeholder="5000"
                    placeholderTextColor={colors.muted}
                    value={creditLimit}
                    onChangeText={setCreditLimit}
                    className="flex-1 text-foreground"
                    keyboardType="decimal-pad"
                    style={{ fontSize: 15 }}
                  />
                </View>
              </View>

              {/* Color Picker */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-3">Choose Color</Text>
                <View className="flex-row flex-wrap gap-3">
                  {PREDEFINED_COLORS.map((color) => (
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
                  style={{ backgroundColor: colors.background, borderWidth: 0.5, borderColor: colors.border }}
                >
                  <Text className="text-foreground font-semibold">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleAddCard}
                  disabled={!cardName.trim() || !cardNumber.trim() || !cardholderName.trim() || !expiryMonth || !expiryYear || !creditLimit}
                  className="flex-1 py-3.5 rounded-xl items-center"
                  style={{
                    backgroundColor: cardName.trim() && cardNumber.trim() && cardholderName.trim() && expiryMonth && expiryYear && creditLimit ? colors.primary : colors.muted,
                  }}
                >
                  <Text className="text-white font-semibold">Add Card</Text>
                </Pressable>
              </View>
        </ScrollView>
      </Sheet>
    </ScreenContainer>
  );
}

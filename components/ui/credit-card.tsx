import React from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";

export type CreditCardProps = {
  name: string;
  cardNumber: string;
  cardholderName: string;
  expiryMonth: number;
  expiryYear: number;
  color: string;
  index: number;
  onLongPress?: () => void;
};

export function CreditCard({
  name,
  cardNumber,
  cardholderName,
  expiryMonth,
  expiryYear,
  color,
  index,
  onLongPress,
}: CreditCardProps) {
  const maskedNumber = cardNumber.length >= 4
    ? `**** **** **** ${cardNumber.slice(-4)}`
    : cardNumber;

  const expiry = `${String(expiryMonth).padStart(2, "0")}/${String(expiryYear).slice(-2)}`;

  return (
    <Animated.View entering={FadeInUp.delay(index * 80).duration(400)}>
      <Pressable
        onLongPress={onLongPress}
        accessibilityRole="button"
        accessibilityLabel={`${name} card ending in ${cardNumber.slice(-4)}`}
        accessibilityHint="Long press to delete"
        className="rounded-2xl p-5 mb-3"
        style={{ backgroundColor: color }}
      >
        <View className="flex-row justify-between items-start mb-6">
          <Text className="text-white font-bold text-lg">{name}</Text>
        </View>
        <Text className="text-white/90 text-base tracking-widest mb-4">
          {maskedNumber}
        </Text>
        <View className="flex-row justify-between items-end">
          <View>
            <Text className="text-white/60 text-xs uppercase mb-1">Cardholder</Text>
            <Text className="text-white font-medium text-sm">{cardholderName}</Text>
          </View>
          <View>
            <Text className="text-white/60 text-xs uppercase mb-1">Expires</Text>
            <Text className="text-white font-medium text-sm">{expiry}</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

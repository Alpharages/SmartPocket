import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp } from "react-native-reanimated";

import { usePressFeedback } from "@/hooks/use-press-feedback";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type CreditCardProps = {
  name: string;
  cardNumber: string;
  cardholderName: string;
  expiryMonth: number;
  expiryYear: number;
  color: string;
  index: number;
  onLongPress?: () => void;
  /** Called when the edit affordance is pressed. */
  onEdit?: () => void;
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
  onEdit,
}: CreditCardProps) {
  const lastFour = cardNumber.slice(-4);
  const maskedNumber = `•••• •••• •••• ${lastFour}`;
  const expiry = `${String(expiryMonth).padStart(2, "0")}/${String(expiryYear).slice(-2)}`;

  const { animatedStyle, onPressIn, onPressOut } = usePressFeedback();

  return (
    <Animated.View entering={FadeInUp.delay(index * 80).duration(400)}>
      <View
        className="rounded-2xl mb-3 overflow-hidden"
        style={{ backgroundColor: color }}
      >
        {onEdit && (
          <Pressable
            onPress={onEdit}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${name}`}
            hitSlop={8}
            className="absolute top-4 right-4 z-10 p-1"
          >
            <Ionicons name="pencil" size={18} color="white" />
          </Pressable>
        )}
        <AnimatedPressable
          onLongPress={onLongPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          accessibilityRole="button"
          accessibilityLabel={`${name} card ending in ${lastFour}`}
          accessibilityHint="Long press to delete"
          className="p-5"
          style={animatedStyle}
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
        </AnimatedPressable>
      </View>
    </Animated.View>
  );
}

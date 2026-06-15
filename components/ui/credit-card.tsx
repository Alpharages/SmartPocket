import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp } from "react-native-reanimated";

import { usePressFeedback } from "@/hooks/use-press-feedback";
import { Radius, Spacing } from "@/lib/_core/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type CardBrand = "visa" | "mastercard" | "amex" | null;

function detectBrand(cardNumber: string): CardBrand {
  if (/^4/.test(cardNumber)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(cardNumber)) return "mastercard";
  if (/^3[47]/.test(cardNumber)) return "amex";
  return null;
}

/** EMV chip — pure Views so it renders identically on web and native. */
function CardChip() {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: 38,
        height: 28,
        borderRadius: 6,
        backgroundColor: "#E6C26E",
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.2)",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <View style={{ height: 1, backgroundColor: "rgba(0,0,0,0.25)" }} />
      <View
        style={{
          alignSelf: "center",
          width: 14,
          height: 10,
          marginVertical: 2,
          borderRadius: 2,
          borderWidth: 1,
          borderColor: "rgba(0,0,0,0.25)",
        }}
      />
      <View style={{ height: 1, backgroundColor: "rgba(0,0,0,0.25)" }} />
    </View>
  );
}

/** Brand mark derived from the card number prefix. */
function CardBrandMark({ brand }: { brand: CardBrand }) {
  if (brand === "mastercard") {
    return (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ flexDirection: "row", alignItems: "center" }}
      >
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: "#EB001B",
          }}
        />
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: "#F79E1B",
            marginLeft: -12,
            opacity: 0.9,
          }}
        />
      </View>
    );
  }
  if (brand === "visa" || brand === "amex") {
    return (
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          color: "white",
          fontSize: brand === "visa" ? 20 : 16,
          fontWeight: "800",
          fontStyle: "italic",
          letterSpacing: 1,
        }}
      >
        {brand === "visa" ? "VISA" : "AMEX"}
      </Text>
    );
  }
  return null;
}

export type CreditCardProps = {
  name: string;
  cardNumberLast4: string;
  cardholderName: string;
  expiryMonth: number;
  expiryYear: number;
  color: string;
  index: number;
  onLongPress?: () => void;
  /** Opens card detail when the card body is tapped. */
  onPress?: () => void;
  /** Called when the edit affordance is pressed. */
  onEdit?: () => void;
};

export function CreditCard({
  name,
  cardNumberLast4,
  cardholderName,
  expiryMonth,
  expiryYear,
  color,
  index,
  onLongPress,
  onPress,
  onEdit,
}: CreditCardProps) {
  const maskedNumber = `•••• •••• •••• ${cardNumberLast4}`;
  const expiry = `${String(expiryMonth).padStart(2, "0")}/${String(expiryYear).slice(-2)}`;
  const brand = detectBrand(cardNumberLast4);

  const { animatedStyle, onPressIn, onPressOut } = usePressFeedback();

  return (
    <Animated.View entering={FadeInUp.delay(index * 80).duration(400)}>
      <View
        className="mb-3"
        style={{
          backgroundColor: color,
          borderRadius: Radius.lg,
          overflow: "hidden",
        }}
      >
        {/* Decorative depth circles, hidden from assistive tech. */}
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            position: "absolute",
            top: -60,
            right: -40,
            width: 180,
            height: 180,
            borderRadius: 90,
            backgroundColor: "rgba(255,255,255,0.08)",
          }}
        />
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            position: "absolute",
            bottom: -80,
            left: -50,
            width: 200,
            height: 200,
            borderRadius: 100,
            backgroundColor: "rgba(0,0,0,0.08)",
          }}
        />
        {onEdit && (
          <Pressable
            onPress={onEdit}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${name}`}
            hitSlop={8}
            // Visual styles live on the style prop: NativeWind className is
            // remapped off on Pressable and silently drops on web.
            style={{
              position: "absolute",
              top: Spacing.lg,
              right: Spacing.lg,
              zIndex: 10,
              padding: Spacing.xs,
            }}
          >
            <Ionicons name="pencil" size={18} color="white" />
          </Pressable>
        )}
        <AnimatedPressable
          onPress={onPress}
          onLongPress={onLongPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          accessibilityRole="button"
          accessibilityLabel={`${name} card ending in ${cardNumberLast4}`}
          accessibilityHint={
            onPress
              ? "Opens card details. Long press to delete."
              : "Long press to delete"
          }
          style={[{ padding: Spacing.xl }, animatedStyle]}
        >
          <View className="flex-row justify-between items-start mb-4">
            <Text className="text-white font-bold text-lg">{name}</Text>
          </View>
          <View className="mb-4">
            <CardChip />
          </View>
          <Text
            className="text-white/90 mb-4"
            style={{ fontSize: 17, letterSpacing: 2.5 }}
          >
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
            <CardBrandMark brand={brand} />
          </View>
        </AnimatedPressable>
      </View>
    </Animated.View>
  );
}

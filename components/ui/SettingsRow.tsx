import React, { useCallback } from "react";
import {
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useColors } from "@/hooks/use-colors";
import { cn } from "@/lib/utils";

const MIN_TOUCH_TARGET = 44;

export type SettingsRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  trailingValue?: string;
  onPress?: () => void;
  disabled?: boolean;
  comingSoon?: boolean;
  destructive?: boolean;
  showChevron?: boolean;
  accessibilityLabel?: string;
  className?: string;
  style?: StyleProp<ViewStyle>;
};

export function SettingsRow({
  icon,
  label,
  trailingValue,
  onPress,
  disabled = false,
  comingSoon = false,
  destructive = false,
  showChevron = true,
  accessibilityLabel,
  className,
  style,
}: SettingsRowProps) {
  const colors = useColors();
  const isInactive = disabled || comingSoon;
  const resolvedTrailing = comingSoon ? "Coming soon" : trailingValue;

  const handlePress = useCallback(() => {
    if (isInactive) return;
    onPress?.();
  }, [isInactive, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      disabled={isInactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isInactive }}
      className={cn(
        "flex-row items-center px-lg",
        isInactive && "opacity-60",
        className,
      )}
      style={[{ minHeight: MIN_TOUCH_TARGET }, style]}
    >
      <View
        className="w-9 h-9 rounded-full items-center justify-center mr-md"
        style={{ backgroundColor: colors.surface }}
      >
        <Ionicons
          name={icon}
          size={18}
          color={destructive ? colors.error : colors.foreground}
        />
      </View>

      <Text
        className="flex-1 text-body font-medium"
        style={{ color: destructive ? colors.error : colors.foreground }}
      >
        {label}
      </Text>

      {resolvedTrailing ? (
        <Text className="text-caption text-muted mr-sm">
          {resolvedTrailing}
        </Text>
      ) : null}

      {showChevron ? (
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      ) : null}
    </Pressable>
  );
}

SettingsRow.displayName = "SettingsRow";

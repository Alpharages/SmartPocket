import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "@/hooks/use-theme";
import { getThemeTokens, type ThemeId } from "@/constants/theme";
import { readableTextOn } from "@/lib/_core/contrast";
import { THEME_ID_OPTIONS } from "@/lib/theme-preference";

type ThemePickerControlProps = {
  value: ThemeId;
  onChange: (id: ThemeId) => void;
};

export function ThemePickerControl({
  value,
  onChange,
}: ThemePickerControlProps) {
  const { colorScheme } = useTheme();

  return (
    <View className="px-lg py-md" accessibilityLabel="Theme style options">
      <Text className="mb-sm text-body font-medium text-foreground">
        Theme style
      </Text>
      <View className="gap-sm">
        {THEME_ID_OPTIONS.map((option) => {
          const selected = option.value === value;
          return (
            <ThemeOptionCard
              key={option.value}
              themeId={option.value}
              label={option.label}
              selected={selected}
              onPress={() => onChange(option.value)}
              colorScheme={colorScheme}
            />
          );
        })}
      </View>
    </View>
  );
}

function ThemeOptionCard({
  themeId,
  label,
  selected,
  onPress,
  colorScheme,
}: {
  themeId: ThemeId;
  label: string;
  selected: boolean;
  onPress: () => void;
  colorScheme: "light" | "dark";
}) {
  const preview = getThemeTokens(themeId, colorScheme);
  const ink = readableTextOn(preview.colors.primary);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}${selected ? ", selected" : ""}`}
      accessibilityState={{ selected }}
      testID={`theme-picker-${themeId}`}
      style={[
        styles.card,
        {
          borderColor: selected
            ? preview.colors.primary
            : preview.colors.border,
          backgroundColor: preview.colors.surface,
        },
      ]}
    >
      <View className="flex-row items-center gap-md">
        <ThemePreviewSwatch themeId={themeId} colorScheme={colorScheme} />
        <Text className="flex-1 text-body font-semibold text-foreground">
          {label}
        </Text>
        {selected ? (
          <View
            testID={`theme-picker-${themeId}-check`}
            style={[styles.check, { backgroundColor: preview.colors.primary }]}
          >
            <Ionicons name="checkmark" size={16} color={ink} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function ThemePreviewSwatch({
  themeId,
  colorScheme,
}: {
  themeId: ThemeId;
  colorScheme: "light" | "dark";
}) {
  const theme = getThemeTokens(themeId, colorScheme);

  return (
    <View
      testID={`theme-preview-${themeId}`}
      className="overflow-hidden rounded-lg"
      style={[styles.swatch, { borderColor: theme.colors.border }]}
    >
      <LinearGradient
        testID={`theme-preview-${themeId}-gradient`}
        colors={theme.gradient.colors as [string, string, ...string[]]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View
        style={[
          styles.accentDot,
          {
            backgroundColor: theme.colors.accent,
            borderColor: theme.colors.surface,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 44,
    overflow: "hidden",
    padding: 12,
  },
  swatch: {
    width: 72,
    height: 44,
    borderWidth: 1,
  },
  accentDot: {
    position: "absolute",
    bottom: 6,
    right: 6,
    width: 16,
    height: 16,
    borderWidth: 2,
    borderRadius: 999,
  },
  check: {
    alignItems: "center",
    borderRadius: 999,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
});

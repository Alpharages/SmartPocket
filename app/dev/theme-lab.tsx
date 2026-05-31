import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/Button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SchemeColors, type ColorScheme } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { useThemeContext } from "@/lib/theme-provider";

type PaletteName = keyof typeof SchemeColors.light;

const paletteNames: PaletteName[] = Object.keys(
  SchemeColors.light,
) as PaletteName[];

function ColorSwatch({ name, value }: { name: PaletteName; value: string }) {
  return (
    <View className="flex-row items-center justify-between rounded-xl border border-border px-3 py-2">
      <View className="flex-row items-center gap-3">
        <View
          className="h-6 w-6 rounded-full border border-border"
          style={{ backgroundColor: value }}
        />
        <Text className="text-sm font-semibold text-foreground">{name}</Text>
      </View>
      <Text className="text-xs font-mono text-muted">{value}</Text>
    </View>
  );
}

export default function ThemeLabScreen() {
  const [pressCount, setPressCount] = useState(0);
  const [lastAction, setLastAction] = useState<string>("None yet");
  const { colorScheme, setColorScheme } = useThemeContext();
  const colors = useColors();

  const swatches = useMemo(
    () =>
      paletteNames.map((name) => ({
        name,
        value: SchemeColors[colorScheme][name],
      })),
    [colorScheme],
  );

  const tileStyles = useMemo(() => {
    const build = (scheme: ColorScheme) => ({
      background: SchemeColors[scheme].background,
      border: SchemeColors[scheme].border,
      text: SchemeColors[scheme].foreground,
      subText: SchemeColors[scheme].muted,
      activeBackground: SchemeColors[scheme].primary,
      activeText: SchemeColors[scheme].background,
    });
    return {
      light: build("light"),
      dark: build("dark"),
    };
  }, []);

  return (
    <ScreenContainer className="p-5">
      <ScrollView className="flex-1">
        <View className="gap-4 pb-8">
          <View className="flex-row gap-2">
            {(["light", "dark"] as ColorScheme[]).map((scheme) => (
              <Pressable
                key={scheme}
                style={[
                  styles.schemeToggle,
                  {
                    backgroundColor:
                      colorScheme === scheme
                        ? tileStyles[scheme].activeBackground
                        : tileStyles[scheme].background,
                    borderColor:
                      colorScheme === scheme
                        ? tileStyles[scheme].activeBackground
                        : tileStyles[scheme].border,
                  },
                ]}
                onPress={() => {
                  setColorScheme(scheme);
                  setLastAction(`Applied ${scheme} globally`);
                }}
              >
                <Text
                  style={[
                    styles.schemeToggleTitle,
                    {
                      color:
                        colorScheme === scheme
                          ? tileStyles[scheme].activeText
                          : tileStyles[scheme].text,
                    },
                  ]}
                >
                  {scheme === "light" ? "Light preview" : "Dark preview"}
                </Text>
                <Text
                  style={[
                    styles.schemeToggleSubtitle,
                    {
                      color:
                        colorScheme === scheme
                          ? tileStyles[scheme].activeText
                          : tileStyles[scheme].subText,
                    },
                  ]}
                >
                  Global theme (NativeWind + useColors)
                </Text>
              </Pressable>
            ))}
          </View>

          <ThemedView className="rounded-2xl border border-border p-4">
            <Text className="text-lg font-bold text-foreground">
              Story 1.1 tokens (spacing · radius · type · elevation)
            </Text>
            <Text className="mt-1 text-sm text-muted">
              Driven entirely by NativeWind classes from theme.config.js
            </Text>

            {/* Spacing scale — bar height = spacing token */}
            <Text className="mt-4 text-label text-muted">Spacing (xs→2xl)</Text>
            <View className="mt-2 flex-row items-end gap-3">
              <View className="h-xs w-6 rounded-sm bg-primary" />
              <View className="h-sm w-6 rounded-sm bg-primary" />
              <View className="h-md w-6 rounded-sm bg-primary" />
              <View className="h-lg w-6 rounded-sm bg-primary" />
              <View className="h-xl w-6 rounded-sm bg-primary" />
              <View className="h-2xl w-6 rounded-sm bg-primary" />
            </View>

            {/* Radius scale */}
            <Text className="mt-4 text-label text-muted">
              Radius (sm/md/lg/full)
            </Text>
            <View className="mt-2 flex-row gap-3">
              <View className="h-12 w-12 rounded-sm bg-primary" />
              <View className="h-12 w-12 rounded-md bg-primary" />
              <View className="h-12 w-12 rounded-lg bg-primary" />
              <View className="h-12 w-12 rounded-full bg-primary" />
            </View>

            {/* Type scale */}
            <Text className="mt-4 text-label text-muted">Type scale</Text>
            <View className="mt-2 gap-1">
              <Text
                nativeID="qa-display"
                className="text-display text-foreground"
              >
                Display
              </Text>
              <Text className="text-h1 text-foreground">Heading 1</Text>
              <Text className="text-h2 text-foreground">Heading 2</Text>
              <Text className="text-h3 text-foreground">Heading 3</Text>
              <Text className="text-body text-foreground">Body text</Text>
              <Text className="text-label text-foreground">Label</Text>
              <Text className="text-caption text-muted">Caption</Text>
            </View>

            {/* Tabular numbers — should align in a column */}
            <Text className="mt-4 text-label text-muted">
              Tabular numbers (text-number + tabular-nums)
            </Text>
            <View className="mt-2 items-end">
              <Text
                nativeID="qa-number"
                className="text-number tabular-nums text-foreground"
              >
                1,111.11
              </Text>
              <Text className="text-number tabular-nums text-foreground">
                8,888.88
              </Text>
              <Text className="text-number tabular-nums text-foreground">
                12.30
              </Text>
            </View>

            {/* Elevation — shadow color derives from foreground (theme-aware) */}
            <Text className="mt-4 text-label text-muted">
              Elevation (sm/md/lg) on surface
            </Text>
            <View className="mt-2 flex-row flex-wrap gap-4 p-2">
              <View
                nativeID="qa-shadow-sm"
                className="h-16 w-16 rounded-lg bg-surface shadow-sm"
              />
              <View
                nativeID="qa-shadow-md"
                className="h-16 w-16 rounded-lg bg-surface shadow-md"
              />
              <View
                nativeID="qa-shadow-lg"
                className="h-16 w-16 rounded-lg bg-surface shadow-lg"
              />
            </View>
          </ThemedView>

          <ThemedView className="rounded-2xl border border-border p-4">
            <Text className="text-lg font-bold text-foreground">
              Tailwind tokens
            </Text>
            <Text className="mt-1 text-sm text-muted">
              Buttons and badges driven by global {colorScheme} palette
            </Text>

            <View className="mt-4 flex-row flex-wrap gap-2">
              <TouchableOpacity
                className="rounded-full px-4 py-2"
                style={{ backgroundColor: SchemeColors[colorScheme].primary }}
                onPress={() => {
                  setPressCount((count) => count + 1);
                  setLastAction("Pressed Primary token");
                }}
              >
                <Text className="text-sm font-semibold text-background">
                  Primary
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="rounded-full px-4 py-2 border border-border"
                style={{ backgroundColor: SchemeColors[colorScheme].surface }}
                onPress={() => {
                  setPressCount((count) => count + 1);
                  setLastAction("Pressed Surface token");
                }}
              >
                <Text className="text-sm font-semibold text-foreground">
                  Surface
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="rounded-full px-4 py-2"
                style={{ backgroundColor: SchemeColors[colorScheme].success }}
                onPress={() => {
                  setPressCount((count) => count + 1);
                  setLastAction("Pressed Success token");
                }}
              >
                <Text className="text-sm font-semibold text-background">
                  Success
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="rounded-full px-4 py-2"
                style={{ backgroundColor: SchemeColors[colorScheme].warning }}
                onPress={() => {
                  setPressCount((count) => count + 1);
                  setLastAction("Pressed Warning token");
                }}
              >
                <Text className="text-sm font-semibold text-background">
                  Warning
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="rounded-full px-4 py-2"
                style={{ backgroundColor: SchemeColors[colorScheme].error }}
                onPress={() => {
                  setPressCount((count) => count + 1);
                  setLastAction("Pressed Error token");
                }}
              >
                <Text className="text-sm font-semibold text-background">
                  Error
                </Text>
              </TouchableOpacity>
            </View>

            <View className="mt-4 rounded-xl bg-background p-4 border border-border">
              <Text className="text-base font-semibold text-foreground">
                useColors()
              </Text>
              <Text className="mt-1 text-sm text-muted">
                Background: {colors.background} • Text: {colors.text} • Tint:{" "}
                {colors.tint}
              </Text>
              <Text className="text-xs text-muted">
                (Pressable uses style; Tailwind on Pressable is disabled via
                remap)
              </Text>
              <View className="mt-3 gap-2">
                <View className="flex-row items-center gap-2">
                  <IconSymbol name="house.fill" color={colors.tint} size={20} />
                  <Text className="text-sm text-foreground">
                    Press count: {pressCount}
                  </Text>
                </View>
                <Text className="text-sm text-muted">
                  Last action: {lastAction}
                </Text>
              </View>
            </View>
          </ThemedView>

          <ThemedView className="rounded-2xl border border-border p-4">
            <Text className="text-lg font-bold text-foreground">
              Button primitive
            </Text>
            <Text className="mt-1 text-sm text-muted">
              All variants, sizes, and states
            </Text>
            <View className="mt-4 gap-3">
              <Text className="text-label text-muted">Variants</Text>
              <View className="flex-row flex-wrap gap-2">
                <Button variant="primary" label="Primary" />
                <Button variant="secondary" label="Secondary" />
                <Button variant="ghost" label="Ghost" />
                <Button variant="destructive" label="Destructive" />
                <Button variant="income" label="Income" />
                <Button
                  variant="icon-only"
                  accessibilityLabel="Add"
                  leftIcon={
                    <IconSymbol name="plus" color="#FFFFFF" size={20} />
                  }
                />
              </View>

              <Text className="text-label text-muted">Sizes</Text>
              <View className="flex-row flex-wrap gap-2 items-center">
                <Button size="sm" label="Small" />
                <Button size="md" label="Medium" />
                <Button size="lg" label="Large" />
              </View>

              <Text className="text-label text-muted">States</Text>
              <View className="flex-row flex-wrap gap-2">
                <Button label="Default" />
                <Button label="Disabled" disabled />
                <Button label="Loading" loading />
              </View>

              <Text className="text-label text-muted">With icons</Text>
              <View className="flex-row flex-wrap gap-2">
                <Button
                  label="Left"
                  leftIcon={
                    <IconSymbol name="arrow.left" color="#FFFFFF" size={16} />
                  }
                />
                <Button
                  variant="secondary"
                  label="Right"
                  rightIcon={
                    <IconSymbol name="arrow.right" color="#111827" size={16} />
                  }
                />
              </View>
            </View>
          </ThemedView>

          <ThemedView className="rounded-2xl border border-border p-4">
            <Text className="text-lg font-bold text-foreground">
              Palette values
            </Text>
            <Text className="mt-1 text-sm text-muted">
              Live values for the selected scheme
            </Text>
            <View className="mt-3 gap-2">
              {swatches.map((item) => (
                <ColorSwatch
                  key={item.name}
                  name={item.name}
                  value={item.value}
                />
              ))}
            </View>
          </ThemedView>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  schemeToggle: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
  },
  schemeToggleTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  schemeToggleSubtitle: {
    fontSize: 12,
  },
});

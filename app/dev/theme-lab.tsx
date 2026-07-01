import { useMemo, useState, useCallback } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/Button";
import { FilterChipGroup, Pill, ScreenHeader } from "@/components/ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import {
  SchemeColors,
  THEME_IDS,
  getThemeTokens,
  type ColorScheme,
  type ThemeId,
} from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { useTheme } from "@/hooks/use-theme";
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

function SegmentDemo() {
  const [value, setValue] = useState<string>("all");
  return (
    <FilterChipGroup
      mode="single"
      value={value}
      onChange={setValue}
      options={[
        { value: "all", label: "All" },
        { value: "income", label: "Income" },
        { value: "expense", label: "Expense" },
        { value: "thisMonth", label: "This Month" },
      ]}
    />
  );
}

function FilterDemo() {
  const [value, setValue] = useState<string[]>(["food"]);
  return (
    <FilterChipGroup
      mode="multi"
      value={value}
      onChange={setValue}
      options={[
        { value: "food", label: "Food" },
        { value: "transport", label: "Transport" },
        { value: "utilities", label: "Utilities" },
        { value: "entertainment", label: "Entertainment" },
      ]}
    />
  );
}

const MATRIX_SEMANTIC_KEYS = [
  "primary",
  "success",
  "warning",
  "error",
  "accent",
  "secondary",
] as const;

/**
 * Story 12.2 (AC 7): renders one theme × variant on its OWN background so all
 * 3 themes × light/dark can be eyeballed side-by-side for AA spot-checking —
 * independent of the globally active theme. Uses inline styles (not NativeWind
 * classes) precisely because these tiles must NOT track the active theme's vars.
 */
function ThemeCell({
  themeId,
  scheme,
}: {
  themeId: ThemeId;
  scheme: ColorScheme;
}) {
  const { colors, gradient, category } = getThemeTokens(themeId, scheme);
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 16,
        padding: 12,
        gap: 8,
      }}
    >
      <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>
        {themeId} · {scheme}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 11 }}>
        bg {colors.background} · fg {colors.foreground}
      </Text>

      {/* Hero gradient stops */}
      <View style={{ flexDirection: "row", gap: 3 }}>
        {gradient.colors.map((stop) => (
          <View
            key={stop}
            style={{ flex: 1, height: 18, borderRadius: 6, backgroundColor: stop }}
          />
        ))}
      </View>

      {/* Semantic tokens */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {MATRIX_SEMANTIC_KEYS.map((key) => (
          <View
            key={key}
            style={{
              height: 22,
              width: 22,
              borderRadius: 11,
              backgroundColor: colors[key],
              borderWidth: 1,
              borderColor: colors.border,
            }}
          />
        ))}
      </View>

      {/* Per-theme category map */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
        {category.map((cat) => (
          <View
            key={cat.name}
            style={{
              height: 16,
              width: 16,
              borderRadius: 4,
              backgroundColor: scheme === "dark" ? cat.dark : cat.light,
            }}
          />
        ))}
      </View>
    </View>
  );
}

export default function ThemeLabScreen() {
  const [pressCount, setPressCount] = useState(0);
  const [lastAction, setLastAction] = useState<string>("None yet");
  const { colorScheme, setColorScheme } = useThemeContext();
  const { themeId, setThemeId } = useTheme();
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

  const refreshProps = usePullToRefresh(useCallback(async () => {}, []));

  return (
    <ScreenContainer className="p-5">
      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl {...refreshProps} />}
      >
        <View className="gap-4 pb-8">
          <ThemedView className="rounded-2xl border border-border p-4">
            <Text className="text-lg font-bold text-foreground">
              Story 12.1: Theme identity switcher
            </Text>
            <Text className="mt-1 text-sm text-muted">
              Runtime switch, no reload — composes with light/dark below
            </Text>
            <View className="mt-3 flex-row flex-wrap gap-2">
              {THEME_IDS.map((id) => (
                <Pressable
                  key={id}
                  accessibilityRole="button"
                  accessibilityLabel={`Switch to ${id} theme`}
                  className={
                    themeId === id
                      ? "rounded-full bg-primary px-4 py-2"
                      : "rounded-full border border-border px-4 py-2"
                  }
                  onPress={() => {
                    void setThemeId(id);
                    setLastAction(`Switched theme to ${id}`);
                  }}
                >
                  <Text
                    className={
                      themeId === id
                        ? "text-sm font-semibold text-background"
                        : "text-sm font-semibold text-foreground"
                    }
                  >
                    {id}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ThemedView>

          <ThemedView className="rounded-2xl border border-border p-4">
            <Text className="text-lg font-bold text-foreground">
              Story 12.2: Three themes × light/dark
            </Text>
            <Text className="mt-1 text-sm text-muted">
              Each tile renders on its own theme — semantic tokens, category map,
              and hero gradient for side-by-side AA spot-checking
            </Text>
            <View className="mt-3 gap-3">
              {THEME_IDS.map((id) => (
                <View key={id} className="flex-row gap-3">
                  <ThemeCell themeId={id} scheme="light" />
                  <ThemeCell themeId={id} scheme="dark" />
                </View>
              ))}
            </View>
          </ThemedView>

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
              ScreenHeader primitive
            </Text>
            <Text className="mt-1 text-sm text-muted">
              Title, subtitle, count, and action slot
            </Text>
            <View className="mt-4 gap-4">
              <ScreenHeader title="Title only" />
              <ScreenHeader
                title="With subtitle"
                subtitle="Monthly breakdown"
              />
              <ScreenHeader title="With count" count={12} />
              <ScreenHeader
                title="Subtitle + count"
                subtitle="Transactions"
                count={42}
              />
              <ScreenHeader
                title="With action"
                subtitle="Manage your cards"
                accessibilityLabel="Cards header"
                action={
                  <Button
                    variant="icon-only"
                    size="sm"
                    accessibilityLabel="Add card"
                    leftIcon={
                      <IconSymbol name="plus" color="#FFFFFF" size={18} />
                    }
                  />
                }
              />
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
                <Button
                  label="Default"
                  onPress={() => {
                    setPressCount((count) => count + 1);
                    setLastAction("Button: Default");
                  }}
                />
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
              Pill / FilterChip primitive
            </Text>
            <Text className="mt-1 text-sm text-muted">
              Filter (multi-select) and segment (single-select) variants
            </Text>

            <Text className="mt-4 text-label text-muted">States</Text>
            <View className="mt-2 flex-row flex-wrap gap-2">
              <Pill label="Default" />
              <Pill label="Selected" selected />
              <Pill label="Disabled" disabled />
              <Pill label="With count" selected count={3} />
              <Pill
                label="With icon"
                selected
                leftIcon={
                  <IconSymbol name="house.fill" color="#FFFFFF" size={14} />
                }
              />
            </View>

            <Text className="mt-4 text-label text-muted">
              Segment (single-select)
            </Text>
            <View className="mt-2">
              <SegmentDemo />
            </View>

            <Text className="mt-4 text-label text-muted">
              Filter (multi-select)
            </Text>
            <View className="mt-2">
              <FilterDemo />
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

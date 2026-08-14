import React, { useCallback, useRef } from "react";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePressFeedback } from "@/hooks/use-press-feedback";
import { Radius, getElevationStyle } from "@/lib/_core/theme";
import { useThemeTokens } from "@/lib/theme-provider";
import { readableTextOn } from "@/lib/_core/contrast";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { AnimatedPressable } from "@/lib/_core/nativewind-pressable";

// Routes rendered in the bar, in order. NOTE: adding a `Tabs.Screen` is not
// enough — a route missing from this list is silently invisible, which is how
// the entire Loans module became unreachable (QA report SP-004). Exported so
// tests/app.tabs-layout.test.tsx can assert it stays in sync with which
// screens declare `href: null` (86eyepunf) instead of restating the list.
export const TAB_ROUTES = [
  "dashboard",
  "transactions",
  "summary",
  "loans",
  "cards",
];
const MIN_TARGET = 44;
const FAB_SIZE = 58;

type GlassTabBarProps = BottomTabBarProps & {
  disableBlur?: boolean;
};

export function GlassTabBar({
  state,
  descriptors,
  navigation,
  disableBlur,
}: GlassTabBarProps) {
  const theme = useThemeTokens();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);
  const routes = state.routes.filter((route) =>
    TAB_ROUTES.includes(route.name),
  );

  // AC8: tab inks are the theme's active `primary` / inactive `muted` tokens,
  // which are authored AA (>=4.6:1) over the theme's own `background`/`surface` —
  // the only content that ever sits behind a docked bar in this app (blur samples
  // theme-colored surfaces, not full-bleed media). GlassTabBar.test locks this in
  // all themes x variants so a token/glass change can't silently drop below AA.

  return (
    // SP-059: the band behind the docked bar had no background of its own, so
    // in dark mode it fell through to a light container and rendered as a
    // near-white strip across the bottom of an otherwise dark app — dropping
    // the inactive tab labels to 2.27:1. Anchor it to the theme background.
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { backgroundColor: theme.colors.background }]}
    >
      <GlassSurface
        disableBlur={disableBlur}
        style={[
          styles.surface,
          getElevationStyle("lg", theme.colors.foreground),
          {
            paddingBottom: bottomPadding,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <View style={styles.tabs}>
          {routes.map((route) => {
            const index = state.routes.findIndex(
              (item) => item.key === route.key,
            );
            const focused = state.index === index;
            const options = descriptors[route.key]?.options ?? {};
            const label =
              typeof options.title === "string" ? options.title : route.name;
            // SP-061: `tabBarAccessibilityLabel` was configured on every tab in
            // app/(tabs)/_layout.tsx and then ignored here, so the rendered
            // a11y name was just the visible title.
            const accessibilityLabel =
              typeof options.tabBarAccessibilityLabel === "string"
                ? options.tabBarAccessibilityLabel
                : label;
            const color = focused ? theme.colors.primary : theme.colors.muted;

            return (
              <TabButton
                key={route.key}
                label={label}
                accessibilityLabel={accessibilityLabel}
                focused={focused}
                color={color}
                icon={options.tabBarIcon?.({ focused, color, size: 22 })}
                onPress={() => {
                  const event = navigation.emit({
                    type: "tabPress",
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!focused && !event.defaultPrevented) {
                    navigation.navigate(route.name);
                  }
                }}
                onLongPress={() => {
                  navigation.emit({ type: "tabLongPress", target: route.key });
                }}
              />
            );
          })}
        </View>
      </GlassSurface>
      <FloatingAddButton />
    </View>
  );
}

function TabButton({
  label,
  accessibilityLabel,
  focused,
  color,
  icon,
  onPress,
  onLongPress,
}: {
  label: string;
  accessibilityLabel: string;
  focused: boolean;
  color: string;
  icon: React.ReactNode;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressFeedback();

  return (
    <AnimatedPressable
      accessibilityRole="tab"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[styles.tab, animatedStyle]}
    >
      {icon}
      <Text numberOfLines={1} style={[styles.label, { color }]}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

function FloatingAddButton() {
  const { colors } = useThemeTokens();
  const { animatedStyle, onPressIn, onPressOut } = usePressFeedback();
  const ink = readableTextOn(colors.accent);
  // Guard against a rapid double-tap stacking two add-transaction routes.
  const navigating = useRef(false);

  const handlePress = useCallback(() => {
    if (navigating.current) return;
    navigating.current = true;
    router.push("/add-transaction");
    setTimeout(() => {
      navigating.current = false;
    }, 600);
  }, []);

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel="Add transaction"
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[
        styles.fab,
        getElevationStyle("md", colors.accent),
        { backgroundColor: colors.accent },
        animatedStyle,
      ]}
    >
      <Ionicons name="add" size={32} color={ink} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 14,
    paddingTop: 30,
  },
  surface: {
    borderRadius: Radius["2xl"],
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 86,
    paddingTop: 34,
    paddingHorizontal: 8,
  } satisfies ViewStyle,
  tabs: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  tab: {
    alignItems: "center",
    flex: 1,
    gap: 4,
    justifyContent: "center",
    minHeight: MIN_TARGET,
    minWidth: MIN_TARGET,
    paddingHorizontal: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
  },
  fab: {
    alignItems: "center",
    borderRadius: FAB_SIZE / 2,
    height: FAB_SIZE,
    justifyContent: "center",
    left: "50%",
    marginLeft: -FAB_SIZE / 2,
    minHeight: MIN_TARGET,
    minWidth: MIN_TARGET,
    position: "absolute",
    top: 0,
    width: FAB_SIZE,
  } satisfies ViewStyle,
});

import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { GlassTabBar } from "@/components/navigation/GlassTabBar";

export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="dashboard"
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Home",
          tabBarAccessibilityLabel: "Home tab",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: "Activity",
          tabBarAccessibilityLabel: "Activity tab",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "receipt" : "receipt-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="categories"
        // SP-042: Categories was demoted from the tab bar to Settings ›
        // Manage — it is registered here only so `router.push("/categories")`
        // resolves. `href: null` records that intent but is inert under our
        // custom `tabBar` (GlassTabBar destructures neither `href` nor
        // `tabBarButton`/`tabBarItemStyle`); TAB_ROUTES in GlassTabBar.tsx is
        // what actually hides it from the bar. The drift guard in
        // tests/app.tabs-layout.test.tsx is what keeps this comment true.
        options={{
          title: "Categories",
          href: null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "grid" : "grid-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="summary"
        options={{
          title: "Insights",
          tabBarAccessibilityLabel: "Insights tab",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "pie-chart" : "pie-chart-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="loans"
        options={{
          title: "Loans",
          tabBarAccessibilityLabel: "Loans tab",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "cash" : "cash-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="cards"
        options={{
          title: "Cards",
          tabBarAccessibilityLabel: "Cards tab",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "card" : "card-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BudgetFormSheet } from "@/components/budgets/BudgetFormSheet";
import { useExpense } from "@/lib/expense-context";
import { useColors } from "@/hooks/use-colors";
import {
  ContentMaxWidth,
  Radius,
  Spacing,
  Typography,
} from "@/lib/_core/theme";

const OPEN_DURATION = 250;
const CLOSE_DURATION = 220;
const SLIDE_DISTANCE = 700;
const SCRIM_COLOR = "rgba(0, 0, 0, 0.6)";

export default function BudgetFormScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { budgets } = useExpense();
  const closingRef = useRef(false);

  const budgetId = id ? Number(id) : undefined;
  const budget = useMemo(
    () =>
      budgetId != null && Number.isFinite(budgetId)
        ? budgets.find((item) => item.id === budgetId)
        : undefined,
    [budgetId, budgets],
  );

  const progress = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  const panelMaxWidth = ContentMaxWidth.modal;

  const goBack = useCallback(() => router.back(), [router]);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    Keyboard.dismiss();
    progress.value = reducedMotion
      ? 0
      : withTiming(0, { duration: CLOSE_DURATION }, (finished) => {
          if (finished) runOnJS(goBack)();
        });
  }, [progress, goBack, reducedMotion]);

  useEffect(() => {
    progress.value = reducedMotion
      ? 1
      : withTiming(1, { duration: OPEN_DURATION });
  }, [progress, reducedMotion]);

  const panelAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [SLIDE_DISTANCE, 0]) },
    ],
  }));

  return (
    <View style={StyleSheet.absoluteFillObject} testID="budget-form-screen">
      <Pressable
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: SCRIM_COLOR },
        ]}
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        testID="budget-form-backdrop"
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.panelWrapper}
      >
        <Animated.View style={panelAnimStyle} testID="budget-form-panel">
          <View
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: Radius.lg,
              borderTopRightRadius: Radius.lg,
              paddingTop: Spacing.sm,
              paddingHorizontal: Spacing.lg,
              paddingBottom: Math.max(insets.bottom, Spacing.lg),
              maxHeight: screenHeight * 0.9,
              width: "100%",
              maxWidth:
                Platform.OS === "web"
                  ? Math.min(panelMaxWidth, screenWidth - 24)
                  : undefined,
              alignSelf: Platform.OS === "web" ? "center" : undefined,
            }}
          >
            <View style={styles.dragHandle} accessibilityElementsHidden>
              <View
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: colors.border,
                }}
              />
            </View>

            <View style={styles.header}>
              <Text
                className="text-foreground font-semibold flex-1 pr-2"
                style={{
                  fontSize: Typography.h3.fontSize,
                  lineHeight: Typography.h3.lineHeight,
                  fontWeight: Typography.h3.fontWeight,
                }}
                accessibilityRole="header"
              >
                {budget ? "Edit Budget" : "Add Budget"}
              </Text>
              <Pressable
                onPress={close}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={8}
                style={styles.closeButton}
                testID="budget-form-close"
              >
                <Ionicons name="close" size={24} color={colors.foreground} />
              </Pressable>
            </View>

            <BudgetFormSheet budget={budget} onClose={close} onSaved={close} />
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  panelWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  dragHandle: {
    alignItems: "center",
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  closeButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});

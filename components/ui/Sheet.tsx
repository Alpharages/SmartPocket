import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useColors } from "@/hooks/use-colors";
import {
  ContentMaxWidth,
  Motion,
  Radius,
  Spacing,
  Typography,
  getElevationStyle,
} from "@/lib/_core/theme";

const MIN_TOUCH_TARGET = 44;
const SHEET_MOTION = Motion.sheet;

function sheetEasing() {
  return Easing.out(Easing.cubic);
}

export type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  snapToContent?: boolean;
  testID?: string;
  /**
   * When true, renders as an absoluteFill View instead of a React Native Modal.
   * Use this when the Sheet is already inside a transparent/modal Stack route
   * (e.g. `presentation: "transparentModal"`) to avoid double-modal layering
   * issues on Android where a nested Modal cannot reliably cover the outer
   * navigation layer's elevated views.
   */
  noModal?: boolean;
};

export function Sheet({
  visible,
  onClose,
  title,
  children,
  snapToContent = false,
  testID = "smartpocket-sheet",
  noModal = false,
}: SheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const [mounted, setMounted] = useState(visible);
  const closingRef = useRef(false);
  const closeIdRef = useRef(0);
  const { height: screenHeight } = useWindowDimensions();

  const translateY = useSharedValue(screenHeight);
  const backdropOpacity = useSharedValue(0);
  const dragOffset = useSharedValue(0);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotionEnabled);
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotionEnabled,
    );
    return () => sub.remove();
  }, []);

  const motionDisabled = reducedMotion || reduceMotionEnabled;
  const duration = motionDisabled ? 0 : SHEET_MOTION.durationMs;

  const finishClose = useCallback(() => {
    closingRef.current = false;
    setMounted(false);
  }, []);

  const animateOpen = useCallback(() => {
    translateY.value = motionDisabled
      ? 0
      : withTiming(0, { duration, easing: sheetEasing() });
    backdropOpacity.value = motionDisabled
      ? SHEET_MOTION.backdropOpacity
      : withTiming(SHEET_MOTION.backdropOpacity, {
          duration,
          easing: sheetEasing(),
        });
    dragOffset.value = 0;
  }, [backdropOpacity, dragOffset, duration, motionDisabled, translateY]);

  const animateClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const myCloseId = closeIdRef.current;
    const onDone = () => {
      if (closeIdRef.current !== myCloseId) return;
      finishClose();
    };
    if (motionDisabled) {
      translateY.value = screenHeight;
      backdropOpacity.value = 0;
      dragOffset.value = 0;
      onDone();
      return;
    }
    translateY.value = withTiming(
      screenHeight,
      { duration, easing: sheetEasing() },
      (finished) => {
        if (finished) {
          runOnJS(onDone)();
        }
      },
    );
    backdropOpacity.value = withTiming(0, {
      duration,
      easing: sheetEasing(),
    });
    dragOffset.value = 0;
  }, [
    backdropOpacity,
    dragOffset,
    duration,
    finishClose,
    motionDisabled,
    screenHeight,
    translateY,
  ]);

  const requestClose = useCallback(() => {
    if (!mounted || closingRef.current) return;
    onClose();
  }, [mounted, onClose]);

  useEffect(() => {
    if (visible) {
      closeIdRef.current += 1;
      setMounted(true);
      closingRef.current = false;
      translateY.value = motionDisabled ? 0 : screenHeight;
      backdropOpacity.value = 0;
      animateOpen();
      return;
    }
    if (mounted && !closingRef.current) {
      animateClose();
    }
  }, [
    visible,
    mounted,
    animateOpen,
    animateClose,
    motionDisabled,
    screenHeight,
    translateY,
    backdropOpacity,
  ]);

  const dismissThresholdPx = screenHeight * SHEET_MOTION.dragDismissThreshold;

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([10, Infinity])
        .failOffsetX([-10, 10])
        .onUpdate((event) => {
          if (event.translationY > 0) {
            dragOffset.value = event.translationY;
          }
        })
        .onEnd((event) => {
          if (event.translationY > dismissThresholdPx) {
            runOnJS(requestClose)();
            return;
          }
          dragOffset.value = motionDisabled
            ? 0
            : withTiming(0, { duration, easing: sheetEasing() });
        }),
    [dismissThresholdPx, dragOffset, duration, motionDisabled, requestClose],
  );

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value + dragOffset.value }],
  }));

  // "aria-modal" is a React Native Web HTML attribute, not a ViewStyle key —
  // so it must be spread as a *prop*, never merged into `style`. It was being
  // pushed into the style array, which made RN Web log "Unsupported style
  // property aria-modal" on every sheet open and dropped the attribute, so the
  // sheet never announced itself as modal to assistive technology.
  const panelWebProps: Record<string, boolean> =
    Platform.OS === "web" ? { "aria-modal": true } : {};

  const titleTypography = Typography.h3;
  const panelMaxWidth = ContentMaxWidth.sheet;

  if (!mounted) {
    return null;
  }

  const backdrop = (
    <Animated.View
      style={[
        {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: colors.overlay,
        },
        backdropStyle,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss sheet"
        onPress={requestClose}
        style={{ flex: 1 }}
        testID={`${testID}-backdrop`}
      />
    </Animated.View>
  );

  const panel = (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        accessible={true}
        {...(title ? { accessibilityLabel: title } : {})}
        {...panelWebProps}
        style={[
          {
            // Height cap lives in the style layer (not className) so it holds
            // on web, where NativeWind classes are unreliable on animated
            // hosts; flexShrink lets the content area compress to this cap so
            // an inner ScrollView gets a bounded height and can scroll.
            maxHeight: snapToContent ? undefined : "90%",
            // ponytail: panel stays opaque colors.surface, not GlassSurface —
            // GlassSurface is a plain (non-Animated) View, and this panel's
            // translateY/drag gesture must stay on the real Animated.View to
            // keep Reanimated's off-thread animation; revisit if a future
            // story needs a frosted sheet panel via an Animated-compatible
            // GlassSurface variant.
            backgroundColor: colors.surface,
            borderTopLeftRadius: Radius.lg,
            borderTopRightRadius: Radius.lg,
            paddingTop: Spacing.sm,
            paddingHorizontal: Spacing.lg,
            paddingBottom: Math.max(insets.bottom, Spacing.lg),
            width: "100%",
            maxWidth: Platform.OS === "web" ? panelMaxWidth : undefined,
            alignSelf: Platform.OS === "web" ? "center" : undefined,
            ...getElevationStyle("lg", colors.foreground),
          },
          panelStyle,
        ]}
        testID={`${testID}-panel`}
      >
        <View className="items-center mb-2" accessibilityElementsHidden>
          <View
            className="rounded-full"
            style={{
              width: 40,
              height: 4,
              backgroundColor: colors.border,
            }}
            testID={`${testID}-handle`}
          />
        </View>

        <View className="flex-row items-center justify-between mb-4">
          {title ? (
            <Text
              className="text-foreground font-semibold flex-1 pr-2"
              style={{
                fontSize: titleTypography.fontSize,
                lineHeight: titleTypography.lineHeight,
                fontWeight: titleTypography.fontWeight,
              }}
              accessibilityRole="header"
            >
              {title}
            </Text>
          ) : (
            <View className="flex-1" />
          )}
          <Pressable
            onPress={requestClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={8}
            style={{
              minWidth: MIN_TOUCH_TARGET,
              minHeight: MIN_TOUCH_TARGET,
              alignItems: "center",
              justifyContent: "center",
            }}
            testID={`${testID}-close`}
          >
            <Ionicons name="close" size={24} color={colors.foreground} />
          </Pressable>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
          style={{ flexShrink: 1 }}
        >
          <View style={{ flexShrink: 1 }} testID={`${testID}-content`}>
            {children}
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </GestureDetector>
  );

  // noModal: render as an absoluteFill View so the transparentModal Stack
  // route's own layer acts as the modal surface — avoids double-modal issues
  // on Android where a nested <Modal> cannot reliably cover the outer
  // navigation layer's elevated views (elevation: 8 StatCard, etc).
  if (noModal) {
    return (
      <View
        style={[StyleSheet.absoluteFillObject, { justifyContent: "flex-end" }]}
        testID={testID}
      >
        {backdrop}
        {panel}
      </View>
    );
  }

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={requestClose}
      accessibilityViewIsModal
      testID={testID}
    >
      <View className="flex-1 justify-end">
        {backdrop}
        {panel}
      </View>
    </Modal>
  );
}

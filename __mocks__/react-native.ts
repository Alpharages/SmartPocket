import React from "react";

/**
 * Test double for `react-native` (aliased in vitest.config.ts).
 *
 * Components render to react-test-renderer host nodes whose **type strings
 * match React Native's host component names** (`Text`, `TextInput`, `Image`,
 * `RCTScrollView`, `Modal`, …) and whose **props are preserved verbatim**
 * (`onPress`, `accessibilityRole`, `accessibilityState`, `accessibilityLabel`,
 * `testID`, `style`, …). This is what `@testing-library/react-native` needs:
 * its host-component detection keys off the type string, and `fireEvent.press`
 * invokes the `onPress` prop directly. We deliberately do NOT translate to DOM
 * elements/handlers — doing so strips `onPress` and trips React DOM attribute
 * warnings.
 */

const hostComponent = (hostName: string) =>
  React.forwardRef<any, any>(({ children, ...props }, ref) =>
    React.createElement(hostName, { ref, ...props }, children),
  );

export const View = hostComponent("View");
(View as any).displayName = "View";

export const Text = hostComponent("Text");
(Text as any).displayName = "Text";

export const TextInput = hostComponent("TextInput");
(TextInput as any).displayName = "TextInput";

export const Image = hostComponent("Image");
(Image as any).displayName = "Image";

export const ScrollView = hostComponent("RCTScrollView");
(ScrollView as any).displayName = "ScrollView";

export const SafeAreaView = View;

export const Modal = hostComponent("Modal");
(Modal as any).displayName = "Modal";

export const KeyboardAvoidingView = hostComponent("KeyboardAvoidingView");
(KeyboardAvoidingView as any).displayName = "KeyboardAvoidingView";

export const Pressable = React.forwardRef<any, any>(
  ({ children, ...props }, ref) => {
    // Pressable supports a render-prop child; resolve it to the default
    // (unpressed) state for the test tree. All event/accessibility props are
    // forwarded untouched so RNTL can find them.
    const child =
      typeof children === "function"
        ? children({ pressed: false, hovered: false })
        : children;
    return React.createElement("View", { ref, ...props }, child);
  },
);
(Pressable as any).displayName = "Pressable";

export const Switch = hostComponent("Switch");
(Switch as any).displayName = "Switch";

export const TouchableOpacity = Pressable;
export const TouchableHighlight = Pressable;

export const ActivityIndicator = React.forwardRef<any, any>((props, ref) =>
  // Default `testID` gives tests a stable hook; callers can still override it.
  React.createElement("ActivityIndicator", {
    ref,
    testID: "activity-indicator",
    ...props,
  }),
);
(ActivityIndicator as any).displayName = "ActivityIndicator";

export const FlatList = React.forwardRef<any, any>(
  ({ data, renderItem, ...props }, ref) =>
    React.createElement(
      "View",
      { ref, ...props },
      data?.map((item: any, index: number) =>
        React.createElement(
          React.Fragment,
          { key: item?.key ?? item?.id ?? index },
          renderItem?.({ item, index, separators: {} as any }),
        ),
      ),
    ),
);
(FlatList as any).displayName = "FlatList";

export const SectionList = React.forwardRef<any, any>(
  (
    {
      sections,
      renderItem,
      renderSectionHeader,
      ListHeaderComponent,
      ListEmptyComponent,
      keyExtractor,
      ...props
    }: any,
    ref: any,
  ) => {
    const isEmpty = !sections || sections.every((s: any) => !s.data?.length);

    const emptyNode = isEmpty
      ? typeof ListEmptyComponent === "function"
        ? React.createElement(ListEmptyComponent)
        : ListEmptyComponent
      : null;

    const sectionNodes = !isEmpty
      ? sections?.flatMap((section: any, si: number) => [
          renderSectionHeader?.({ section }),
          ...(section.data ?? []).map((item: any, index: number) =>
            React.createElement(
              React.Fragment,
              {
                key: keyExtractor
                  ? keyExtractor(item, index)
                  : (item?.id ?? `${si}-${index}`),
              },
              renderItem?.({ item, index, section, separators: {} as any }),
            ),
          ),
        ])
      : null;

    return React.createElement(
      "View",
      { ref, ...props },
      ListHeaderComponent,
      emptyNode,
      sectionNodes,
    );
  },
);
(SectionList as any).displayName = "SectionList";

export const Alert = {
  alert: (
    _title: string,
    _message?: string,
    _buttons?: Array<{ text: string; style?: string; onPress?: () => void }>,
  ) => {},
};

export const Platform = {
  select: <T>(spec: {
    ios?: T;
    android?: T;
    web?: T;
    default?: T;
  }): T | undefined => {
    return spec.default ?? spec.ios ?? spec.android ?? spec.web;
  },
  OS: "ios",
};

export const StyleSheet = {
  create: <T>(styles: T): T => styles,
  flatten: (style: any) =>
    Array.isArray(style)
      ? Object.assign({}, ...style.filter(Boolean))
      : (style ?? {}),
  absoluteFill: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  } as any,
  hairlineWidth: 1,
};

export const AccessibilityInfo = {
  isReduceMotionEnabled: () => Promise.resolve(false),
  addEventListener: () => ({ remove: () => {} }),
  announceForAccessibility: () => {},
};

export const Dimensions = {
  get: (_dim: "window" | "screen") => ({
    width: 375,
    height: 812,
    scale: 2,
    fontScale: 1,
  }),
  addEventListener: () => ({ remove: () => {} }),
};

export const useColorScheme = () => "light";

export const Appearance = {
  getColorScheme: () => "light",
  addChangeListener: () => ({ remove: () => {} }),
};

export const Animated = {
  View,
  Text,
  createAnimatedComponent: (Component: any) => Component,
};

export const useWindowDimensions = () => ({ width: 390, height: 844 });

export const I18nManager = {
  isRTL: false,
  allowRTL: () => {},
  forceRTL: () => {},
};

export const StatusBar = {
  setBarStyle: () => {},
  setHidden: () => {},
  setBackgroundColor: () => {},
  setTranslucent: () => {},
  currentHeight: 44,
};

export const Keyboard = {
  dismiss: () => {},
  addListener: () => ({ remove: () => {} }),
};

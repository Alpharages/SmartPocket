import { View, type ViewProps, type ViewStyle } from "react-native";
import { useSafeAreaInsets, type Edge } from "react-native-safe-area-context";

import { cn } from "@/lib/utils";

export interface ScreenContainerProps extends ViewProps {
  /**
   * SafeArea edges to apply. Defaults to ["top", "left", "right"].
   * Bottom is typically handled by Tab Bar.
   */
  edges?: Edge[];
  /**
   * Tailwind className for the content area.
   */
  className?: string;
  /**
   * Additional className for the outer container (background layer).
   */
  containerClassName?: string;
  /**
   * Additional className for the safe-area padding wrapper.
   */
  safeAreaClassName?: string;
}

function paddingForEdges(
  edges: Edge[],
  insets: ReturnType<typeof useSafeAreaInsets>,
): ViewStyle {
  return {
    paddingTop: edges.includes("top") ? insets.top : 0,
    paddingBottom: edges.includes("bottom") ? insets.bottom : 0,
    paddingLeft: edges.includes("left") ? insets.left : 0,
    paddingRight: edges.includes("right") ? insets.right : 0,
  };
}

/**
 * A container component that properly handles SafeArea and background colors.
 *
 * Uses `useSafeAreaInsets()` padding instead of the deprecated React Native
 * `SafeAreaView` so insets stay correct without triggering RN deprecation
 * warnings.
 *
 * Usage:
 * ```tsx
 * <ScreenContainer className="p-4">
 *   <Text className="text-2xl font-bold text-foreground">
 *     Welcome
 *   </Text>
 * </ScreenContainer>
 * ```
 */
export function ScreenContainer({
  children,
  edges = ["top", "left", "right"],
  className,
  containerClassName,
  safeAreaClassName,
  style,
  ...props
}: ScreenContainerProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className={cn("flex-1", "bg-background", containerClassName)}
      {...props}
    >
      <View
        className={cn("flex-1", safeAreaClassName)}
        style={[paddingForEdges(edges, insets), style]}
      >
        <View className={cn("flex-1", className)}>{children}</View>
      </View>
    </View>
  );
}

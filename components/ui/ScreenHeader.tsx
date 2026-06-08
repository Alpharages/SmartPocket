import React from "react";
import {
  Text,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from "react-native";

import { cn } from "@/lib/utils";

export type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  count?: number;
  action?: React.ReactNode;
  accessibilityLabel?: string;
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  className?: string;
  style?: StyleProp<ViewStyle>;
} & Omit<ViewProps, "style">;

export function ScreenHeader({
  title,
  subtitle,
  count,
  action,
  accessibilityLabel,
  headingLevel = 1,
  className,
  style,
  ...viewProps
}: ScreenHeaderProps) {
  // Dev-time guard: when an action slot is provided, the caller should also
  // supply an accessibilityLabel so screen readers can describe the header
  // and its action meaningfully (NFR-5).
  if (__DEV__ && action && !accessibilityLabel) {
    console.warn(
      "[ScreenHeader] `accessibilityLabel` is recommended when an `action` is provided so assistive tech can describe the header context.",
    );
  }

  const captionText = React.useMemo(() => {
    if (subtitle && count !== undefined) {
      return `${subtitle} · ${count}`;
    }
    if (subtitle) {
      return subtitle;
    }
    if (count !== undefined) {
      return String(count);
    }
    return null;
  }, [subtitle, count]);

  return (
    <View
      className={cn(
        "flex-row items-center justify-between px-lg py-md",
        className,
      )}
      style={style}
      accessibilityLabel={accessibilityLabel}
      {...viewProps}
    >
      <View className="flex-1">
        <Text
          className="text-h1 text-foreground"
          accessibilityRole="header"
          aria-level={headingLevel}
        >
          {title}
        </Text>
        {captionText !== null && (
          <Text className="mt-xs text-caption text-muted">{captionText}</Text>
        )}
      </View>
      {action && <View className="ml-md justify-center">{action}</View>}
    </View>
  );
}

ScreenHeader.displayName = "ScreenHeader";

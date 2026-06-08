import React from "react";
import { Platform, View, type ViewProps, type ViewStyle } from "react-native";

import { cn } from "@/lib/utils";

export interface ResponsiveContentProps extends ViewProps {
  maxWidth?: number;
}

export function ResponsiveContent({
  children,
  className,
  maxWidth = 1120,
  style,
  ...props
}: ResponsiveContentProps) {
  const webStyle: ViewStyle | undefined =
    Platform.OS === "web"
      ? {
          width: "100%",
          maxWidth,
          alignSelf: "center",
        }
      : undefined;

  return (
    <View
      className={cn("w-full", className)}
      style={[webStyle, style]}
      {...props}
    >
      {children}
    </View>
  );
}

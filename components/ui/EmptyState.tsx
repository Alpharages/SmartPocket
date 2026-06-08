import React from "react";
import { Text, View } from "react-native";

import { useColors } from "@/hooks/use-colors";
import { Radius, Spacing, Typography } from "@/lib/_core/theme";
import { Button } from "./Button";

export type EmptyStateVariant = "no-data" | "no-results";

export type EmptyStateActionObject = {
  label: string;
  onPress: () => void;
};

export type EmptyStateProps = {
  /** Icon rendered inside the circular container. Pass an <Ionicons> or similar. */
  icon: React.ReactNode;
  title: string;
  description: string;
  titleLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  /**
   * Primary action. Pass `{ label, onPress }` to render a `Button`, or pass a
   * pre-built `Button` node directly (Story 1.3 AC: no new button styles).
   */
  action?: EmptyStateActionObject | React.ReactNode;
  /** Semantic hint for copy selection — does not change the component's visual. */
  variant?: EmptyStateVariant;
  testID?: string;
};

function isActionObject(
  action: NonNullable<EmptyStateProps["action"]>,
): action is EmptyStateActionObject {
  return (
    typeof (action as EmptyStateActionObject).label === "string" &&
    typeof (action as EmptyStateActionObject).onPress === "function"
  );
}

export function EmptyState({
  icon,
  title,
  description,
  titleLevel = 2,
  action,
  variant: _variant = "no-data",
  testID = "empty-state",
}: EmptyStateProps) {
  const colors = useColors();
  const titleTypo = Typography.h3;
  const bodyTypo = Typography.label;

  return (
    <View
      testID={testID}
      className="items-center justify-center"
      style={{
        paddingVertical: Spacing["2xl"] * 2,
        paddingHorizontal: Spacing.lg,
      }}
    >
      <View
        testID={`${testID}-icon`}
        className="items-center justify-center mb-3"
        style={{
          width: 56,
          height: 56,
          borderRadius: Radius.full,
          backgroundColor: colors.border,
        }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {icon}
      </View>

      <Text
        testID={`${testID}-title`}
        accessibilityRole="header"
        aria-level={titleLevel}
        className="text-foreground text-center font-semibold mb-1"
        style={{
          fontSize: titleTypo.fontSize,
          lineHeight: titleTypo.lineHeight,
          fontWeight: titleTypo.fontWeight as "600",
        }}
      >
        {title}
      </Text>

      <Text
        testID={`${testID}-description`}
        className="text-muted text-center"
        style={{
          fontSize: bodyTypo.fontSize,
          lineHeight: bodyTypo.lineHeight,
          marginBottom: action != null ? Spacing.lg : 0,
        }}
      >
        {description}
      </Text>

      {action != null && (
        <View testID={`${testID}-action`}>
          {isActionObject(action) ? (
            <Button
              label={action.label}
              onPress={action.onPress}
              variant="primary"
              size="md"
            />
          ) : (
            action
          )}
        </View>
      )}
    </View>
  );
}

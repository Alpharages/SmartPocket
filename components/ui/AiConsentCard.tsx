import React from "react";
import { Text, View } from "react-native";

import { Button } from "./Button";
import { Sheet } from "./Sheet";

export const AI_EXPLANATION =
  "Lets SmartPocket suggest categories and answer questions about your spending. Your data is only sent for AI when this is on.";

export type AiConsentCardProps = {
  visible: boolean;
  onEnable: () => void;
  onDismiss: () => void;
  enabling?: boolean;
};

export function AiConsentCard({
  visible,
  onEnable,
  onDismiss,
  enabling = false,
}: AiConsentCardProps) {
  return (
    <Sheet
      visible={visible}
      onClose={onDismiss}
      title="Turn on AI features?"
      testID="ai-consent-card"
    >
      <View className="gap-4 pb-2">
        <Text className="text-muted text-sm leading-relaxed">
          {AI_EXPLANATION}
        </Text>
        <Text className="text-muted text-sm leading-relaxed">
          What&apos;s sent: the transaction description and amount for the
          feature you&apos;re using. Why: to suggest categories and answer
          questions about your spending. Reversible: turn AI off anytime in
          Settings → AI.
        </Text>

        <View className="flex-row gap-3 mt-2">
          <Button
            variant="secondary"
            label="Not now"
            onPress={onDismiss}
            className="flex-1"
            size="lg"
            disabled={enabling}
          />
          <Button
            variant="primary"
            label="Enable AI"
            onPress={onEnable}
            className="flex-1"
            size="lg"
            loading={enabling}
            disabled={enabling}
          />
        </View>
      </View>
    </Sheet>
  );
}

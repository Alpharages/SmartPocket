import React from "react";
import { Text, View } from "react-native";

import { Button } from "./Button";
import { Sheet } from "./Sheet";

export type ConfirmOptions = {
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

export type ConfirmSheetProps = ConfirmOptions & {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmSheet({
  visible,
  title = "Are you sure?",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  return (
    <Sheet visible={visible} onClose={onCancel} title={title} testID="confirm-sheet">
      <View className="gap-4 pb-2">
        {message ? (
          <Text className="text-muted text-sm leading-relaxed">
            {message}
          </Text>
        ) : null}

        <View className="flex-row gap-3 mt-2">
          <Button
            variant="secondary"
            label={cancelLabel}
            onPress={onCancel}
            className="flex-1"
            size="lg"
          />
          <Button
            variant={destructive ? "destructive" : "primary"}
            label={confirmLabel}
            onPress={onConfirm}
            className="flex-1"
            size="lg"
          />
        </View>
      </View>
    </Sheet>
  );
}

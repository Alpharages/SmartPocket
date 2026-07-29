import { Alert, Platform } from "react-native";

import { getConfirmHandler } from "@/components/ui/ConfirmProvider";

/**
 * Platform-safe confirmation.
 *
 * QA report SP-007 / SP-040: screens called `Alert.alert` with button
 * callbacks, but on react-native-web those buttons are never wired to a real
 * dialog — so "Delete" in the Activity list produced no dialog, no deletion and
 * no feedback. `app/transaction/[id].tsx` already branched to `window.confirm`;
 * the other call sites did not. This centralises that branch so no screen has
 * to remember it.
 *
 * When a `ConfirmProvider` is mounted (see `components/ui/ConfirmProvider.tsx`),
 * delegate to its themed `ConfirmSheet` on every platform — the raw
 * `globalThis.confirm()` / `Alert.alert` fallbacks below only run when no
 * provider is in the tree (e.g. a unit test rendering a screen in isolation).
 */
export function confirmDestructive({
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
}: {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}): Promise<boolean> {
  const handler = getConfirmHandler();
  if (handler) {
    return handler({
      title,
      message,
      confirmLabel,
      cancelLabel,
      destructive: true,
    });
  }

  if (Platform.OS === "web") {
    const text = message ? `${title}\n\n${message}` : title;
    const confirmed =
      typeof globalThis.confirm === "function"
        ? globalThis.confirm(text)
        : false;
    return Promise.resolve(confirmed);
  }

  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        {
          text: cancelLabel,
          style: "cancel",
          onPress: () => resolve(false),
        },
        {
          text: confirmLabel,
          style: "destructive",
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

import { Alert, Platform } from "react-native";

/**
 * Platform-safe confirmation.
 *
 * QA report SP-007 / SP-040: screens called `Alert.alert` with button
 * callbacks, but on react-native-web those buttons are never wired to a real
 * dialog — so "Delete" in the Activity list produced no dialog, no deletion and
 * no feedback. `app/transaction/[id].tsx` already branched to `window.confirm`;
 * the other call sites did not. This centralises that branch so no screen has
 * to remember it.
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

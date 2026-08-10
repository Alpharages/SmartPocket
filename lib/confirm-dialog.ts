import { Alert, Platform } from "react-native";

import { getConfirmHandler } from "@/lib/confirm-registry";

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
 * On web, when a `ConfirmProvider` is mounted (see
 * `components/ui/ConfirmProvider.tsx`), delegate to its themed
 * `ConfirmSheet`; the raw `globalThis.confirm()` fallback below only runs
 * when no provider is in the tree (e.g. a unit test rendering a screen in
 * isolation). The handler itself is read from `lib/confirm-registry.ts`, a
 * leaf module, so this file never statically imports the UI tree.
 *
 * Native always uses `Alert.alert`, never the provider: `Alert.alert`
 * presents on the topmost view controller, so it works over a route
 * presented as `transparentModal` (e.g. `budget-form`); a provider hosted at
 * the app root cannot reliably layer a `Modal` (or its `noModal` escape
 * hatch, which only works *inside* the presented route) over one.
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

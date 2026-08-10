import type { ConfirmOptions } from "@/components/ui/ConfirmSheet";

export type ConfirmHandler = (options: ConfirmOptions) => Promise<boolean>;

let registeredHandler: ConfirmHandler | null = null;

/**
 * Registers the imperative confirm handler. A leaf module so
 * `lib/confirm-dialog.ts` can read it without statically importing the
 * `ConfirmProvider` -> `ConfirmSheet` -> `Sheet` UI tree.
 */
export function setConfirmHandler(handler: ConfirmHandler | null): void {
  registeredHandler = handler;
}

export function getConfirmHandler(): ConfirmHandler | null {
  return registeredHandler;
}

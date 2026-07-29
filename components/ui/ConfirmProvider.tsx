import React, { useEffect } from "react";

import { useConfirm } from "@/hooks/use-confirm";
import { ConfirmSheet, type ConfirmOptions } from "./ConfirmSheet";

type ConfirmHandler = (options: ConfirmOptions) => Promise<boolean>;

let registeredHandler: ConfirmHandler | null = null;

/** Registers the imperative confirm handler. Exported for `lib/confirm-dialog.ts` and tests. */
export function setConfirmHandler(handler: ConfirmHandler | null): void {
  registeredHandler = handler;
}

export function getConfirmHandler(): ConfirmHandler | null {
  return registeredHandler;
}

/**
 * Mounts the app-wide themed confirm-sheet host, mirroring `ToastProvider`.
 * `lib/confirm-dialog.ts` delegates to the registered handler when mounted,
 * falling back to a platform dialog otherwise.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const { visible, options, confirm, onConfirm, onCancel } = useConfirm();

  useEffect(() => {
    setConfirmHandler(confirm);
    return () => setConfirmHandler(null);
  }, [confirm]);

  return (
    <>
      {children}
      <ConfirmSheet
        visible={visible}
        onConfirm={onConfirm}
        onCancel={onCancel}
        {...options}
      />
    </>
  );
}

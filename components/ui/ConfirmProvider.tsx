import React, { useEffect, useRef } from "react";
import { usePathname } from "expo-router";

import { useConfirm } from "@/hooks/use-confirm";
import { getConfirmHandler, setConfirmHandler } from "@/lib/confirm-registry";
import { ConfirmSheet } from "./ConfirmSheet";

// Re-exported for tests and any existing importers — the registry itself
// lives in `lib/confirm-registry.ts` so `lib/confirm-dialog.ts` never has to
// statically import this UI tree just to read the registered handler.
export { getConfirmHandler, setConfirmHandler };

// Routes mounted as a `transparentModal` Stack screen (see app/_layout.tsx)
// already provide their own modal surface. Layering `Sheet`'s default RN
// <Modal> over one of those is unreliable — see `Sheet.tsx`'s `noModal` doc —
// so a confirm opened from one of these routes must render `noModal` too.
const TRANSPARENT_MODAL_ROUTES = new Set([
  "/add-transaction",
  "/budget-form",
  "/loan/record-repayment",
]);

/**
 * Mounts the app-wide themed confirm-sheet host, mirroring `ToastProvider`.
 * `lib/confirm-dialog.ts` delegates to the registered handler when mounted,
 * falling back to a platform dialog otherwise.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const { visible, options, confirm, onConfirm, onCancel } = useConfirm();
  const pathname = usePathname();
  const previousPathnameRef = useRef(pathname);

  useEffect(() => {
    setConfirmHandler(confirm);
    return () => {
      // Only clear the registration this effect made — a second provider
      // mounting first (Fast Refresh remount, a test harness) must not have
      // its live handler nulled by an older instance's teardown.
      if (getConfirmHandler() === confirm) {
        setConfirmHandler(null);
      }
    };
  }, [confirm]);

  // A pending confirm belongs to the screen that opened it. Since the sheet
  // itself is hosted at the app root, that screen unmounting (navigating
  // away, including the browser Back button on web, which Modal cannot
  // intercept) never resolves the awaiting promise on its own — resolve it
  // `false` and drop the sheet here instead of leaving it orphaned over
  // whatever route comes next.
  useEffect(() => {
    if (visible && pathname !== previousPathnameRef.current) {
      onCancel();
    }
    previousPathnameRef.current = pathname;
  }, [pathname, visible, onCancel]);

  return (
    <>
      {children}
      <ConfirmSheet
        visible={visible}
        onConfirm={onConfirm}
        onCancel={onCancel}
        noModal={TRANSPARENT_MODAL_ROUTES.has(pathname)}
        {...options}
      />
    </>
  );
}

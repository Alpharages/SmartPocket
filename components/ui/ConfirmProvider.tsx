import React, { useEffect, useRef } from "react";
import { usePathname } from "expo-router";

import { useConfirm } from "@/hooks/use-confirm";
import { getConfirmHandler, setConfirmHandler } from "@/lib/confirm-registry";
import { ConfirmSheet } from "./ConfirmSheet";

// Re-exported for tests and any existing importers — the registry itself
// lives in `lib/confirm-registry.ts` so `lib/confirm-dialog.ts` never has to
// statically import this UI tree just to read the registered handler.
export { getConfirmHandler, setConfirmHandler };

/**
 * Mounts the app-wide themed confirm-sheet host, mirroring `ToastProvider`.
 * `lib/confirm-dialog.ts` delegates to the registered handler on web only,
 * falling back to a platform dialog otherwise — native always uses
 * `Alert.alert`, so this sheet only ever renders in response to a web call.
 * A root-hosted `Modal` cannot reliably layer over a native route presented
 * as `transparentModal`, and `Sheet`'s `noModal` escape hatch only works
 * *inside* that presented route, not as a sibling of it — see the ticket
 * 86eyepuyq round-2 review for the regression this caused when the provider
 * briefly also delegated on native.
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
      //
      // Known limitation (non-blocking, round-2 review N5): the reverse
      // order — an older instance still mounted after a newer one unmounts —
      // isn't handled, since this effect's deps (`[confirm]`) don't change
      // and so it never re-registers. Not reachable with today's single
      // root-mounted provider.
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
  //
  // Known limitation (non-blocking, ticket 86eyepuyq round-2 review N1/N2):
  // this is an approximation keyed on the *route*, not the *caller*. A route
  // pushed on top of a still-mounted screen (e.g. a notification deep link)
  // cancels a pending confirm even though the owning screen is still alive,
  // and a caller that unmounts without a route change (e.g. a two-pane
  // detail pane closing) isn't covered at all. A correct fix needs the
  // caller's own lifetime (a `useDestructiveConfirm()` hook or an
  // `AbortSignal` on `confirmDestructive`), which is a larger change than
  // this web-scoped P3 ticket's remaining budget covers.
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
        {...options}
      />
    </>
  );
}

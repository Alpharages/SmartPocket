import { useCallback, useEffect, useRef, useState } from "react";
import type { ConfirmOptions } from "@/components/ui/ConfirmSheet";

type ConfirmResolver = (value: boolean) => void;

export function useConfirm() {
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({});
  const resolverRef = useRef<ConfirmResolver | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions = {}): Promise<boolean> => {
      // Settle any outstanding request before starting a new one so its
      // awaiting caller never hangs if confirm() is re-entered.
      resolverRef.current?.(false);
      setOptions(opts);
      setVisible(true);
      return new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;
      });
    },
    [],
  );

  // Resolve a pending prompt on unmount so the awaiting caller never leaks.
  useEffect(
    () => () => {
      resolverRef.current?.(false);
      resolverRef.current = null;
    },
    [],
  );

  const onConfirm = useCallback(() => {
    setVisible(false);
    resolverRef.current?.(true);
    resolverRef.current = null;
  }, []);

  const onCancel = useCallback(() => {
    setVisible(false);
    resolverRef.current?.(false);
    resolverRef.current = null;
  }, []);

  return {
    visible,
    options,
    confirm,
    onConfirm,
    onCancel,
  };
}

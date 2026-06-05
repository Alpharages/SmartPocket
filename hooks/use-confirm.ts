import { useCallback, useRef, useState } from "react";
import type { ConfirmOptions } from "@/components/ui/ConfirmSheet";

type ConfirmResolver = (value: boolean) => void;

export function useConfirm() {
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({});
  const resolverRef = useRef<ConfirmResolver | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions = {}): Promise<boolean> => {
      setOptions(opts);
      setVisible(true);
      return new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;
      });
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

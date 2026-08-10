import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Spacing } from "@/lib/_core/theme";
import { Toast, type ToastItem, type ToastType } from "./Toast";

export type ShowToastOptions = {
  type: ToastType;
  message: string;
  /** Auto-dismiss timeout in ms. Defaults to 3500. */
  duration?: number;
};

type ToastContextValue = {
  show: (opts: ShowToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const insets = useSafeAreaInsets();
  const counter = useRef(0);

  const show = useCallback(({ type, message, duration }: ShowToastOptions) => {
    const id = `t-${Date.now()}-${++counter.current}`;
    setToasts((prev) => [...prev, { id, type, message, duration }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Memoized so consumers that put `useToast()`'s return value in a
  // useEffect dependency array don't get a new object identity — and thus
  // an infinite re-run loop — on every toast add/dismiss re-render.
  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Overlay — position: absolute, pointerEvents="box-none" so touches pass through */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: insets.top + Spacing.sm,
          left: Spacing.md,
          right: Spacing.md,
          zIndex: 9999,
        }}
        testID="toast-container"
      >
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} onDismiss={dismiss} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

/**
 * Returns the toast imperative API.
 * Must be used inside a `ToastProvider`.
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (ctx === null) {
    throw new Error("useToast must be used within a <ToastProvider>.");
  }
  return ctx;
}

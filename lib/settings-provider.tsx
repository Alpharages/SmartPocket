import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

import { useToast } from "@/components/ui/ToastProvider";
import { trpc } from "@/lib/trpc";

type SettingsContextValue = {
  aiEnabled: boolean;
  setAiEnabled: (enabled: boolean) => Promise<void>;
  isSavingAi: boolean;
  isReady: boolean;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  const settingsQuery = trpc.settings.get.useQuery();
  const setAiMutation = trpc.settings.setAiEnabled.useMutation();
  const [optimisticAiEnabled, setOptimisticAiEnabled] = useState<boolean | null>(
    null,
  );
  const [isSavingAi, setIsSavingAi] = useState(false);
  const intendedAiEnabledRef = useRef<boolean | null>(null);

  const serverAiEnabled = settingsQuery.data?.aiEnabled ?? false;
  const aiEnabled = optimisticAiEnabled ?? serverAiEnabled;

  const setAiEnabled = useCallback(
    async (enabled: boolean) => {
      const rollbackTo = intendedAiEnabledRef.current ?? serverAiEnabled;
      intendedAiEnabledRef.current = enabled;
      setOptimisticAiEnabled(enabled);
      setIsSavingAi(true);

      try {
        await setAiMutation.mutateAsync({ enabled });
        if (intendedAiEnabledRef.current !== enabled) {
          return;
        }
        await settingsQuery.refetch();
        if (intendedAiEnabledRef.current !== enabled) {
          return;
        }
        setOptimisticAiEnabled(null);
      } catch {
        if (intendedAiEnabledRef.current !== enabled) {
          return;
        }
        intendedAiEnabledRef.current = rollbackTo;
        setOptimisticAiEnabled(rollbackTo);
        toast.show({ type: "error", message: "Failed to update AI setting" });
      } finally {
        if (intendedAiEnabledRef.current === enabled) {
          setIsSavingAi(false);
        }
      }
    },
    [serverAiEnabled, setAiMutation, settingsQuery, toast],
  );

  const value = useMemo(
    () => ({
      aiEnabled,
      setAiEnabled,
      isSavingAi,
      isReady: !settingsQuery.isLoading,
    }),
    [aiEnabled, setAiEnabled, isSavingAi, settingsQuery.isLoading],
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return ctx;
}

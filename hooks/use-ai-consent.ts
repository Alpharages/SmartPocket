import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

import { useSettings } from "@/lib/settings-provider";

const DISMISSED_KEY = "ai-consent-dismissed";

type WebStorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

// Mirrors the native/web split in lib/_core/auth.ts's session-token storage.
function getWebStorage(): WebStorageLike | null {
  const storage = (
    globalThis as typeof globalThis & { localStorage?: WebStorageLike }
  ).localStorage;
  return storage ?? null;
}

async function readDismissedMarker(): Promise<boolean> {
  try {
    if (Platform.OS === "web") {
      return getWebStorage()?.getItem(DISMISSED_KEY) === "true";
    }
    return (await SecureStore.getItemAsync(DISMISSED_KEY)) === "true";
  } catch {
    return false;
  }
}

async function writeDismissedMarker(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      getWebStorage()?.setItem(DISMISSED_KEY, "true");
      return;
    }
    await SecureStore.setItemAsync(DISMISSED_KEY, "true");
  } catch {
    // Best-effort: worst case the card re-appears on a later encounter.
  }
}

export type UseAiConsentResult = {
  aiEnabled: boolean;
  needsConsent: boolean;
  visible: boolean;
  enabling: boolean;
  requestConsent: () => void;
  enable: () => Promise<void>;
  dismiss: () => void;
};

export function useAiConsent(): UseAiConsentResult {
  const { aiEnabled, setAiEnabled, isSavingAi } = useSettings();
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);
  const [enabling, setEnabling] = useState(false);
  // React state updates inside the same synchronous call batch don't take
  // effect until re-render, so a same-tick double-tap would read `enabling`
  // as stale `false` twice. A ref guards synchronously instead.
  const enablingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void readDismissedMarker().then((value) => {
      if (!cancelled) setDismissed(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Explicit action (e.g. the Settings toggle) — always opens the card on a
  // false->true attempt, regardless of a prior "Not now" dismissal. Passive
  // first-encounter surfaces should gate on `needsConsent` before calling
  // this so they respect the dismissal.
  const requestConsent = useCallback(() => {
    if (aiEnabled) return;
    setVisible(true);
  }, [aiEnabled]);

  const enable = useCallback(async () => {
    if (enablingRef.current || isSavingAi) return;
    enablingRef.current = true;
    setEnabling(true);
    try {
      await setAiEnabled(true);
      setVisible(false);
    } finally {
      enablingRef.current = false;
      setEnabling(false);
    }
  }, [isSavingAi, setAiEnabled]);

  const dismiss = useCallback(() => {
    setVisible(false);
    setDismissed(true);
    void writeDismissedMarker();
  }, []);

  return {
    aiEnabled,
    needsConsent: !aiEnabled && !dismissed,
    visible,
    enabling,
    requestConsent,
    enable,
    dismiss,
  };
}

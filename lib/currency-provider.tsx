import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  CURRENCY_STORAGE_KEY,
  getDefaultCurrencyFromLocale,
  isSupportedCurrency,
  type CurrencyCode,
} from "@/lib/currency";

type CurrencyContextValue = {
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => Promise<void>;
  isReady: boolean;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

async function readStoredCurrency(): Promise<CurrencyCode | null> {
  try {
    const stored = await AsyncStorage.getItem(CURRENCY_STORAGE_KEY);
    if (stored && isSupportedCurrency(stored)) {
      return stored;
    }
  } catch {
    // fall through
  }
  return null;
}

async function persistCurrency(code: CurrencyCode): Promise<void> {
  try {
    await AsyncStorage.setItem(CURRENCY_STORAGE_KEY, code);
  } catch {
    // non-fatal — preference stays in memory for this session
  }
}

/** Loads persisted currency or seeds the default on first run. */
export async function loadCurrencyPreference(): Promise<CurrencyCode> {
  const stored = await readStoredCurrency();
  if (stored) {
    return stored;
  }

  const defaultCode = getDefaultCurrencyFromLocale();
  await persistCurrency(defaultCode);
  return defaultCode;
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>(() =>
    getDefaultCurrencyFromLocale(),
  );
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const resolved = await loadCurrencyPreference();
      if (cancelled) return;
      setCurrencyState(resolved);
      setIsReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const setCurrency = useCallback(async (code: CurrencyCode) => {
    setCurrencyState(code);
    await persistCurrency(code);
  }, []);

  const value = useMemo(
    () => ({
      currency,
      setCurrency,
      isReady,
    }),
    [currency, setCurrency, isReady],
  );

  return (
    <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error("useCurrency must be used within CurrencyProvider");
  }
  return ctx;
}

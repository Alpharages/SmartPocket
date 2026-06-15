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
  DEFAULT_FIRST_DAY_OF_WEEK,
  FIRST_DAY_OF_WEEK_STORAGE_KEY,
  isSupportedFirstDayOfWeek,
  type FirstDayOfWeek,
} from "@/lib/first-day-of-week";

type FirstDayOfWeekContextValue = {
  firstDayOfWeek: FirstDayOfWeek;
  setFirstDayOfWeek: (day: FirstDayOfWeek) => Promise<void>;
  isReady: boolean;
};

const FirstDayOfWeekContext = createContext<FirstDayOfWeekContextValue | null>(
  null,
);

async function readStoredFirstDayOfWeek(): Promise<FirstDayOfWeek | null> {
  try {
    const stored = await AsyncStorage.getItem(FIRST_DAY_OF_WEEK_STORAGE_KEY);
    if (stored != null) {
      const parsed = Number(stored);
      if (isSupportedFirstDayOfWeek(parsed)) {
        return parsed;
      }
    }
  } catch {
    // fall through
  }
  return null;
}

async function persistFirstDayOfWeek(day: FirstDayOfWeek): Promise<void> {
  try {
    await AsyncStorage.setItem(FIRST_DAY_OF_WEEK_STORAGE_KEY, String(day));
  } catch {
    // non-fatal — preference stays in memory for this session
  }
}

/** Loads persisted first-day-of-week or returns the default (Sunday). */
export async function loadFirstDayOfWeekPreference(): Promise<FirstDayOfWeek> {
  const stored = await readStoredFirstDayOfWeek();
  if (stored != null) {
    return stored;
  }
  return DEFAULT_FIRST_DAY_OF_WEEK;
}

export function FirstDayOfWeekProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [firstDayOfWeek, setFirstDayOfWeekState] = useState<FirstDayOfWeek>(
    DEFAULT_FIRST_DAY_OF_WEEK,
  );
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const resolved = await loadFirstDayOfWeekPreference();
      if (cancelled) return;
      setFirstDayOfWeekState(resolved);
      setIsReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const setFirstDayOfWeek = useCallback(async (day: FirstDayOfWeek) => {
    setFirstDayOfWeekState(day);
    await persistFirstDayOfWeek(day);
  }, []);

  const value = useMemo(
    () => ({
      firstDayOfWeek,
      setFirstDayOfWeek,
      isReady,
    }),
    [firstDayOfWeek, setFirstDayOfWeek, isReady],
  );

  return (
    <FirstDayOfWeekContext.Provider value={value}>
      {children}
    </FirstDayOfWeekContext.Provider>
  );
}

export function useFirstDayOfWeek(): FirstDayOfWeekContextValue {
  const ctx = useContext(FirstDayOfWeekContext);
  if (!ctx) {
    throw new Error("useFirstDayOfWeek must be used within FirstDayOfWeekProvider");
  }
  return ctx;
}

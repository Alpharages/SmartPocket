import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Appearance,
  View,
  useColorScheme as useSystemColorScheme,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colorScheme as nativewindColorScheme, vars } from "nativewind";

import { SchemeColors, type ColorScheme } from "@/constants/theme";
import {
  DEFAULT_THEME_PREFERENCE,
  THEME_STORAGE_KEY,
  isSupportedThemePreference,
  resolveColorScheme,
  type ThemePreference,
} from "@/lib/theme-preference";

type ThemeContextValue = {
  colorScheme: ColorScheme;
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => Promise<void>;
  /** @deprecated Prefer setThemePreference — sets an explicit light/dark preference. */
  setColorScheme: (scheme: ColorScheme) => void;
  isReady: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

async function readStoredThemePreference(): Promise<ThemePreference | null> {
  try {
    const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
    if (stored && isSupportedThemePreference(stored)) {
      return stored;
    }
  } catch {
    // fall through
  }
  return null;
}

async function persistThemePreference(
  preference: ThemePreference,
): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // non-fatal — preference stays in memory for this session
  }
}

/** Loads persisted theme preference or returns the default (system). */
export async function loadThemePreference(): Promise<ThemePreference> {
  const stored = await readStoredThemePreference();
  if (stored) {
    return stored;
  }
  return DEFAULT_THEME_PREFERENCE;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme() ?? "light";
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(
    DEFAULT_THEME_PREFERENCE,
  );
  const [isReady, setIsReady] = useState(false);
  const userChangedPreferenceRef = useRef(false);

  const colorScheme = useMemo(
    () => resolveColorScheme(themePreference, systemScheme),
    [themePreference, systemScheme],
  );

  const applyScheme = useCallback((scheme: ColorScheme) => {
    nativewindColorScheme.set(scheme);
    Appearance.setColorScheme?.(scheme);
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.dataset.theme = scheme;
      root.classList.toggle("dark", scheme === "dark");
      const palette = SchemeColors[scheme];
      Object.entries(palette).forEach(([token, value]) => {
        root.style.setProperty(`--color-${token}`, value);
      });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const resolved = await loadThemePreference();
      if (cancelled) return;
      if (!userChangedPreferenceRef.current) {
        setThemePreferenceState(resolved);
      }
      setIsReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    applyScheme(colorScheme);
  }, [applyScheme, colorScheme]);

  const setThemePreference = useCallback(
    async (preference: ThemePreference) => {
      userChangedPreferenceRef.current = true;
      setThemePreferenceState(preference);
      await persistThemePreference(preference);
    },
    [],
  );

  const setColorScheme = useCallback(
    (scheme: ColorScheme) => {
      void setThemePreference(scheme);
    },
    [setThemePreference],
  );

  const themeVariables = useMemo(
    () =>
      vars({
        "color-primary": SchemeColors[colorScheme].primary,
        "color-background": SchemeColors[colorScheme].background,
        "color-surface": SchemeColors[colorScheme].surface,
        "color-foreground": SchemeColors[colorScheme].foreground,
        "color-muted": SchemeColors[colorScheme].muted,
        "color-border": SchemeColors[colorScheme].border,
        "color-success": SchemeColors[colorScheme].success,
        "color-warning": SchemeColors[colorScheme].warning,
        "color-error": SchemeColors[colorScheme].error,
      }),
    [colorScheme],
  );

  const value = useMemo(
    () => ({
      colorScheme,
      themePreference,
      setThemePreference,
      setColorScheme,
      isReady,
    }),
    [colorScheme, themePreference, setThemePreference, setColorScheme, isReady],
  );

  return (
    <ThemeContext.Provider value={value}>
      <View style={[{ flex: 1 }, themeVariables]}>{children}</View>
    </ThemeContext.Provider>
  );
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useThemeContext must be used within ThemeProvider");
  }
  return ctx;
}

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

import {
  getThemeTokens,
  type ColorScheme,
  type ResolvedThemeTokens,
  type ThemeId,
} from "@/constants/theme";
import {
  DEFAULT_THEME_ID,
  DEFAULT_THEME_PREFERENCE,
  THEME_ID_STORAGE_KEY,
  THEME_STORAGE_KEY,
  isSupportedThemeId,
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
  themeId: ThemeId;
  setThemeId: (themeId: ThemeId) => Promise<void>;
  theme: ResolvedThemeTokens;
  isReady: boolean;
};

// Exported (not just the throwing useThemeContext() below) so purely
// presentational primitives (GlassSurface, GradientHero) can read the active
// theme when a ThemeProvider ancestor exists, and fall back to a sane default
// when rendered standalone (e.g. unit tests with no ThemeProvider wrapper).
export const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Active theme tokens, with a safe aurora/light default for provider-less
 * renders (unit tests, isolated previews) — the shared read used by the
 * presentational primitives instead of each re-implementing the fallback. */
export function useThemeTokens(): ResolvedThemeTokens {
  const ctx = useContext(ThemeContext);
  return ctx?.theme ?? getThemeTokens(DEFAULT_THEME_ID, "light");
}

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

async function readStoredThemeId(): Promise<ThemeId | null> {
  try {
    const stored = await AsyncStorage.getItem(THEME_ID_STORAGE_KEY);
    if (stored && isSupportedThemeId(stored)) {
      return stored;
    }
  } catch {
    // fall through
  }
  return null;
}

async function persistThemeId(themeId: ThemeId): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_ID_STORAGE_KEY, themeId);
  } catch {
    // non-fatal — themeId stays in memory for this session
  }
}

/** Loads the persisted theme identity or returns the default (aurora). */
export async function loadThemeId(): Promise<ThemeId> {
  const stored = await readStoredThemeId();
  if (stored) {
    return stored;
  }
  return DEFAULT_THEME_ID;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme() ?? "light";
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(
    DEFAULT_THEME_PREFERENCE,
  );
  const [themeId, setThemeIdState] = useState<ThemeId>(DEFAULT_THEME_ID);
  const [isReady, setIsReady] = useState(false);
  const userChangedPreferenceRef = useRef(false);
  const userChangedThemeIdRef = useRef(false);

  const colorScheme = useMemo(
    () => resolveColorScheme(themePreference, systemScheme),
    [themePreference, systemScheme],
  );

  const theme = useMemo(
    () => getThemeTokens(themeId, colorScheme),
    [themeId, colorScheme],
  );

  const applyScheme = useCallback(
    (scheme: ColorScheme, activeThemeId: ThemeId) => {
      nativewindColorScheme.set(scheme);
      Appearance.setColorScheme?.(scheme);
      if (typeof document !== "undefined") {
        const root = document.documentElement;
        root.dataset.theme = scheme;
        root.classList.toggle("dark", scheme === "dark");
        const resolved = getThemeTokens(activeThemeId, scheme);
        Object.entries(resolved.colors).forEach(([token, value]) => {
          root.style.setProperty(`--color-${token}`, value);
        });
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [resolvedPreference, resolvedThemeId] = await Promise.all([
        loadThemePreference(),
        loadThemeId(),
      ]);
      if (cancelled) return;
      if (!userChangedPreferenceRef.current) {
        setThemePreferenceState(resolvedPreference);
      }
      if (!userChangedThemeIdRef.current) {
        setThemeIdState(resolvedThemeId);
      }
      setIsReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    applyScheme(colorScheme, themeId);
  }, [applyScheme, colorScheme, themeId]);

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

  const setThemeId = useCallback(async (id: ThemeId) => {
    userChangedThemeIdRef.current = true;
    setThemeIdState(id);
    await persistThemeId(id);
  }, []);

  const themeVariables = useMemo(
    () =>
      vars({
        "color-primary": theme.colors.primary,
        "color-background": theme.colors.background,
        "color-surface": theme.colors.surface,
        "color-foreground": theme.colors.foreground,
        "color-muted": theme.colors.muted,
        "color-border": theme.colors.border,
        "color-success": theme.colors.success,
        "color-warning": theme.colors.warning,
        "color-error": theme.colors.error,
        // accent/secondary/overlay diverge per theme as of Story 12.2 — they MUST
        // be in this native vars() map or they'd freeze on the build-time Tailwind
        // fallback on iOS/Android while switching fine on web (Lore lesson: keep the
        // native vars() map covering the same token set as the web --color-* loop).
        "color-accent": theme.colors.accent,
        "color-secondary": theme.colors.secondary,
        "color-overlay": theme.colors.overlay,
      }),
    [theme],
  );

  const value = useMemo(
    () => ({
      colorScheme,
      themePreference,
      setThemePreference,
      setColorScheme,
      themeId,
      setThemeId,
      theme,
      isReady,
    }),
    [
      colorScheme,
      themePreference,
      setThemePreference,
      setColorScheme,
      themeId,
      setThemeId,
      theme,
      isReady,
    ],
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

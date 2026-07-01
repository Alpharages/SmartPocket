import type { ColorScheme, ThemeId } from "@/constants/theme";

export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "@smartpocket/theme";

export const DEFAULT_THEME_PREFERENCE: ThemePreference = "system";

export const THEME_PREFERENCE_OPTIONS: readonly {
  value: ThemePreference;
  label: string;
}[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const;

export function isSupportedThemePreference(
  value: string,
): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

// Theme identity (Story 12.1, RDR-1) is a separate, independently persisted
// axis from the mode preference above — themeId × mode compose in ThemeProvider.

export const THEME_ID_STORAGE_KEY = "@smartpocket/theme-id";

export const DEFAULT_THEME_ID: ThemeId = "aurora";

export const THEME_ID_OPTIONS: readonly { value: ThemeId; label: string }[] = [
  { value: "aurora", label: "Aurora Glass" },
  { value: "obsidian", label: "Obsidian & Gold" },
  { value: "spectrum", label: "Midnight Spectrum" },
] as const;

const SUPPORTED_THEME_IDS: readonly ThemeId[] = THEME_ID_OPTIONS.map(
  (option) => option.value,
);

export function isSupportedThemeId(value: string): value is ThemeId {
  return (SUPPORTED_THEME_IDS as readonly string[]).includes(value);
}

/** Derives the resolved color scheme from a stored preference and the OS scheme. */
export function resolveColorScheme(
  preference: ThemePreference,
  systemScheme: ColorScheme,
): ColorScheme {
  if (preference === "system") {
    return systemScheme;
  }
  return preference;
}

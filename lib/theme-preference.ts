import type { ColorScheme } from "@/constants/theme";

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

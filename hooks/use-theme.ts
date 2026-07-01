import { useThemeContext } from "@/lib/theme-provider";

/**
 * Returns the active theme identity, its resolved token set, and the setter
 * to switch themes at runtime. Composes with `useColors()`/`useColorScheme()`
 * (the mode axis) rather than replacing them.
 */
export function useTheme() {
  const { themeId, setThemeId, theme, colorScheme } = useThemeContext();
  return { themeId, setThemeId, theme, colorScheme };
}

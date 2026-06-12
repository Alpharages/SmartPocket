import { useEffect, useState } from "react";

import { useThemeContext } from "@/lib/theme-provider";

/**
 * To support static rendering, this value needs to be re-calculated on the
 * client side for web — but the source of truth is ThemeProvider, not RN's
 * useColorScheme(), so user-selected themes apply app-wide on web too.
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);
  const { colorScheme } = useThemeContext();

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  if (hasHydrated) {
    return colorScheme;
  }

  return "light";
}

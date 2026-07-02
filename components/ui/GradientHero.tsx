import React, { useContext } from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { ThemeContext } from "@/lib/theme-provider";
import { DEFAULT_THEME_ID, getThemeTokens } from "@/lib/_core/theme";

export type GradientHeroProps = ViewProps & {
  /** Force the solid-color fallback regardless of gradient availability —
   * mirrors GlassSurface's `disableBlur` for the 12.11 perf toggle. */
  disableGradient?: boolean;
};

/** Converts a CSS-style gradient angle (degrees, 0 = up, clockwise) to the
 * start/end fractional points `expo-linear-gradient` expects. */
function angleToPoints(angle: number): {
  start: { x: number; y: number };
  end: { x: number; y: number };
} {
  const rad = (angle * Math.PI) / 180;
  const x = Math.sin(rad);
  const y = -Math.cos(rad);
  return {
    start: { x: 0.5 - x / 2, y: 0.5 - y / 2 },
    end: { x: 0.5 + x / 2, y: 0.5 + y / 2 },
  };
}

/**
 * Theme hero-gradient backdrop primitive (RDR-3). Renders the active theme's
 * hero `gradient` stops via `expo-linear-gradient`, with a solid-color
 * fallback (the first stop) when the gradient path is unavailable or
 * `disableGradient` is set. Story 12.4 builds the balance hero content on
 * top of this backdrop — 12.3 only delivers the reusable layer.
 */
export function GradientHero({
  disableGradient,
  style,
  children,
  ...rest
}: GradientHeroProps) {
  const ctx = useContext(ThemeContext);
  const theme = ctx?.theme ?? getThemeTokens(DEFAULT_THEME_ID, "light");
  const { colors, angle } = theme.gradient;
  const useGradient = !disableGradient;

  return (
    <View style={[styles.container, style]} {...rest}>
      {useGradient ? (
        <LinearGradient
          testID="gradient-hero-gradient"
          // Theme gradient stops are authored as a plain string[] (2-10
          // stops); expo-linear-gradient's type wants a >=2-tuple to catch
          // single-color misuse at the call site, which the token layer
          // already guarantees, so the cast is safe here.
          colors={colors as [string, string, ...string[]]}
          {...angleToPoints(angle)}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : (
        <View
          testID="gradient-hero-fallback"
          style={[StyleSheet.absoluteFill, { backgroundColor: colors[0] }]}
          pointerEvents="none"
        />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
});

import React, { useMemo } from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import { BlurView } from "expo-blur";

import { useThemeTokens } from "@/lib/theme-provider";
import {
  glassInkRequirements,
  resolveOpaqueGlassFill,
  toRgba,
} from "@/lib/_core/glass";
import { useGlassCapability } from "@/hooks/use-glass-capability";

export type GlassSurfaceProps = ViewProps & {
  /** Force the opaque fallback regardless of platform capability — e.g. the
   * 12.11 low-cost-fallback toggle on a per-instance basis. */
  disableBlur?: boolean;
};

/**
 * Frosted/translucent surface primitive (RDR-3). Renders children over a
 * real backdrop blur where supported, honoring the active theme's `glass`
 * tokens (blur radius, tint, surface/border opacity) resolved via the theme
 * context — or an opaque AA-safe tinted `View` where blur is unsupported or
 * `disableBlur` is set. The fallback is the default-safe branch: every glass
 * render path works even with no blur at all.
 */
export function GlassSurface({
  disableBlur,
  style,
  children,
  ...rest
}: GlassSurfaceProps) {
  const theme = useThemeTokens();
  const { blurEnabled: canBlur } = useGlassCapability(disableBlur);

  const opaqueFill = useMemo(
    () =>
      resolveOpaqueGlassFill(
        theme.glass,
        theme.colors.surface,
        glassInkRequirements(theme.colors),
      ),
    [theme.glass, theme.colors],
  );

  const borderColor = useMemo(
    () => toRgba(theme.glass.tint, theme.glass.borderOpacity),
    [theme.glass.tint, theme.glass.borderOpacity],
  );

  // The border overlay must round with the surface or its stroke gets
  // clipped square at the corners by the container's overflow: hidden —
  // consumers pass borderRadius via `style` and the overlay mirrors it.
  const borderRadius = StyleSheet.flatten(style)?.borderRadius;

  return (
    <View style={[styles.container, style]} {...rest}>
      {canBlur ? (
        <>
          <BlurView
            testID="glass-surface-blur"
            intensity={Math.min(100, Math.max(0, theme.glass.blur))}
            tint={theme.colorScheme}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View
            testID="glass-surface-tint"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: theme.glass.tint,
                opacity: theme.glass.surfaceOpacity,
              },
            ]}
            pointerEvents="none"
          />
        </>
      ) : (
        <View
          testID="glass-surface-fallback"
          style={[StyleSheet.absoluteFill, { backgroundColor: opaqueFill }]}
          pointerEvents="none"
        />
      )}
      <View
        style={[
          StyleSheet.absoluteFill,
          { borderWidth: 1, borderColor, borderRadius },
        ]}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
});

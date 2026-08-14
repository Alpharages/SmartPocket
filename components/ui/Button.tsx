import React, { forwardRef, useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useThemeTokens } from "@/lib/theme-provider";
import { usePressFeedback } from "@/hooks/use-press-feedback";
import { readableTextOn } from "@/lib/_core/contrast";
import { Radius, getElevationStyle } from "@/lib/_core/theme";
import { cn } from "@/lib/utils";

// Registered for NativeWind interop in lib/_core/nativewind-pressable (SP-057).
import { AnimatedPressable } from "@/lib/_core/nativewind-pressable";

type ButtonRef = React.ComponentRef<typeof AnimatedPressable>;

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "destructive"
  | "income"
  | "icon-only";

export type ButtonSize = "sm" | "md" | "lg";

// NFR-5 / WCAG 2.1 AA: every button — every size and variant, icon-only
// included — must present at least a 44pt touch target. Size tokens below set
// the *design* height; this floor is enforced at the style layer so a compact
// `sm` can never render below the accessible minimum.
const MIN_TOUCH_TARGET = 44;

type BaseButtonProps = PressableProps & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
};

type LabelButtonProps = BaseButtonProps & {
  variant?: Exclude<ButtonVariant, "icon-only">;
  label: string;
  accessibilityLabel?: string;
};

type IconOnlyButtonProps = BaseButtonProps & {
  variant?: "icon-only";
  label?: never;
  accessibilityLabel: string;
};

export type ButtonProps = LabelButtonProps | IconOnlyButtonProps;

const SIZE_HEIGHT: Record<ButtonSize, number> = {
  sm: 36,
  md: 44,
  lg: 48,
};

const SIZE_ICON_ONLY_DIMENSION: Record<ButtonSize, number> = {
  sm: 36,
  md: 44,
  lg: 48,
};

const SIZE_PADDING: Record<ButtonSize, { px: number; py: number }> = {
  sm: { px: 12, py: 8 },
  md: { px: 16, py: 12 },
  lg: { px: 20, py: 14 },
};

const SIZE_TEXT: Record<ButtonSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-base",
};

export const Button = forwardRef<ButtonRef, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      label,
      onPress,
      disabled = false,
      loading = false,
      leftIcon,
      rightIcon,
      accessibilityLabel,
      className,
      style,
      ...pressableProps
    },
    ref,
  ) => {
    // Inks/fills come from the active-theme token source (same one the
    // surface primitives read) — never the theme-agnostic useColors(),
    // which is frozen to the default theme and would leave every button
    // on Aurora's palette under Obsidian/Spectrum (AC3).
    const { colors } = useThemeTokens();

    // Dev-time guard: icon-only must have accessibilityLabel
    if (__DEV__ && variant === "icon-only" && !accessibilityLabel) {
      console.warn(
        "[Button] `accessibilityLabel` is required for icon-only buttons.",
      );
    }

    const { animatedStyle, onPressIn, onPressOut } = usePressFeedback();

    const handlePressIn = useCallback(() => {
      if (disabled || loading) return;
      onPressIn();
    }, [disabled, loading, onPressIn]);

    const handlePressOut = useCallback(() => {
      onPressOut();
    }, [onPressOut]);

    const handlePress = useCallback(() => {
      if (!disabled && !loading) {
        onPress?.();
      }
    }, [disabled, loading, onPress]);

    const { containerStyle, textColor, isIconOnly } = useMemo(() => {
      const iconOnly = variant === "icon-only";
      let bg: string;
      let border: string | undefined;
      let fg: string;

      // Filled variants must not hardcode white: in dark mode the semantic/
      // primary tokens are light tints that fail AA behind white text. Resolve
      // the readable ink (white vs near-black) per fill so AC1 holds on both
      // themes — see lib/_core/contrast.ts.
      switch (variant) {
        case "primary":
          bg = colors.primary;
          fg = readableTextOn(bg);
          break;
        case "secondary":
          bg = colors.surface;
          border = colors.border;
          fg = colors.foreground;
          break;
        case "ghost":
          bg = "transparent";
          fg = colors.foreground;
          break;
        case "destructive":
          bg = colors.error;
          fg = readableTextOn(bg);
          break;
        case "income":
          bg = colors.success;
          fg = readableTextOn(bg);
          break;
        case "icon-only":
          bg = colors.primary;
          fg = readableTextOn(bg);
          break;
      }

      const dim = iconOnly
        ? Math.max(MIN_TOUCH_TARGET, SIZE_ICON_ONLY_DIMENSION[size])
        : undefined;
      const pad = iconOnly ? undefined : SIZE_PADDING[size];

      // Filled variants get a subtle theme-driven lift; outlined/transparent
      // variants (secondary, ghost) stay flat — a shadow under a border or
      // transparent fill reads as a rendering glitch, not elevation.
      const elevationLevel =
        variant === "secondary" || variant === "ghost" ? "none" : "sm";

      return {
        containerStyle: {
          ...getElevationStyle(elevationLevel, colors.foreground),
          // SP-096: the `flex-row items-center justify-center` className below
          // is inert on this Pressable (NativeWind interop is remapped off),
          // so every button fell back to React Native's default `column`: a
          // leftIcon/loading spinner stacked ABOVE its label instead of sitting
          // beside it, and labels stopped centring. Visible on "Add account",
          // "Add New Card", "Add New Category" and every icon button in the app.
          // Layout has to live here, next to the radius that needs the same
          // workaround.
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: bg,
          borderColor: border,
          borderWidth: border ? 1 : 0,
          // Mirrors the rounded-md / rounded-lg classes below: className is
          // remapped off on Pressable and silently drops on web, so the
          // radius must also live on the style prop.
          borderRadius: iconOnly ? Radius.lg : Radius.md,
          minHeight: Math.max(MIN_TOUCH_TARGET, SIZE_HEIGHT[size]),
          height: dim,
          width: dim,
          paddingHorizontal: pad?.px,
          paddingVertical: pad?.py,
          opacity: disabled || loading ? 0.5 : 1,
        } as ViewStyle,
        textColor: fg,
        isIconOnly: iconOnly,
      };
    }, [variant, size, colors, disabled, loading]);

    // `disabled` reflects the explicit prop; `loading` is surfaced as `busy`
    // so assistive tech announces a working button as busy rather than
    // disabled (interaction is still blocked via `handlePress` + the
    // Pressable `disabled` below).
    const accessibilityState = useMemo(
      () => ({
        disabled,
        busy: loading,
      }),
      [disabled, loading],
    );

    const resolvedAccessibilityLabel =
      accessibilityLabel ?? (typeof label === "string" ? label : undefined);

    // SP-058: the caller supplies the icon, and every call site passed its own
    // `color` (usually `colors.foreground`), overriding the readable ink this
    // component computes for the fill. Re-colour the icon here so an icon-only
    // button can never render below the 3:1 contrast minimum.
    const tintIcon = (icon: React.ReactNode): React.ReactNode => {
      if (!React.isValidElement(icon)) return icon;
      const props = icon.props as { color?: unknown };
      if (typeof props.color !== "string") return icon;
      return React.cloneElement(
        icon as React.ReactElement<{ color?: string }>,
        { color: textColor },
      );
    };

    const content = isIconOnly ? (
      <>
        {loading ? (
          <ActivityIndicator size="small" color={textColor} />
        ) : (
          tintIcon(leftIcon ?? rightIcon)
        )}
      </>
    ) : (
      <>
        {leftIcon && !loading && (
          <View className="mr-2">{tintIcon(leftIcon)}</View>
        )}
        {loading ? (
          <ActivityIndicator size="small" color={textColor} className="mr-2" />
        ) : (
          <Text
            className={cn("font-semibold", SIZE_TEXT[size])}
            style={{ color: textColor }}
            numberOfLines={1}
          >
            {label}
          </Text>
        )}
        {rightIcon && !loading && (
          <View className="ml-2">{tintIcon(rightIcon)}</View>
        )}
      </>
    );

    // SP-095: NativeWind className is remapped off on Pressable
    // (lib/_core/nativewind-pressable.ts) and silently drops on web, which the
    // radius above already works around. Layout utilities had no such
    // workaround, so the 19 call sites passing `className="flex-1"` to split a
    // sheet footer in half all rendered a content-sized, left-aligned button
    // with dead space beside it. Mirror the layout intent into `style`, which
    // is reliable. Applied before the caller's own `style` so an explicit
    // style always wins.
    const layoutStyle = useMemo<ViewStyle>(() => {
      if (!className) return {};
      const classes = className.split(/\s+/);
      const out: ViewStyle = {};
      if (classes.includes("flex-1")) out.flex = 1;
      if (classes.includes("w-full")) out.width = "100%";
      if (classes.includes("self-start")) out.alignSelf = "flex-start";
      if (classes.includes("self-center")) out.alignSelf = "center";
      return out;
    }, [className]);

    return (
      <AnimatedPressable
        ref={ref}
        // Forwarded Pressable props (testID, etc.) are spread FIRST so the
        // primitive's own behavior, a11y, and styling below always win — a
        // forwarded handler can never silently clobber press-feedback/a11y.
        {...pressableProps}
        accessibilityRole="button"
        accessibilityLabel={resolvedAccessibilityLabel}
        accessibilityState={accessibilityState}
        disabled={disabled || loading}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        className={cn(
          "flex-row items-center justify-center rounded-md",
          isIconOnly && "rounded-lg",
          className,
        )}
        style={[containerStyle, layoutStyle, animatedStyle, style]}
      >
        {content}
      </AnimatedPressable>
    );
  },
);

Button.displayName = "Button";

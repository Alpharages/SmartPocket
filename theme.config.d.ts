export const themeColors: {
  primary: { light: string; dark: string };
  background: { light: string; dark: string };
  surface: { light: string; dark: string };
  foreground: { light: string; dark: string };
  muted: { light: string; dark: string };
  border: { light: string; dark: string };
  success: { light: string; dark: string };
  warning: { light: string; dark: string };
  error: { light: string; dark: string };
  accent: { light: string; dark: string };
  secondary: { light: string; dark: string };
  overlay: { light: string; dark: string };
};

export type CategoryColorToken = {
  name: string;
  light: string;
  dark: string;
};

export const categoryColors: readonly CategoryColorToken[];

export const spacing: {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  "2xl": number;
};

export const radius: {
  sm: number;
  md: number;
  lg: number;
  full: number;
};

export type FontWeight =
  | "normal"
  | "bold"
  | "100"
  | "200"
  | "300"
  | "400"
  | "500"
  | "600"
  | "700"
  | "800"
  | "900";

export type TypographyStyle = {
  fontSize: number;
  lineHeight: number;
  fontWeight: FontWeight;
  fontVariant?: string[];
};

export const typography: {
  display: TypographyStyle;
  h1: TypographyStyle;
  h2: TypographyStyle;
  h3: TypographyStyle;
  body: TypographyStyle;
  label: TypographyStyle;
  caption: TypographyStyle;
  micro: TypographyStyle;
  number: TypographyStyle;
};

export const elevation: {
  none: string;
  sm: string;
  md: string;
  lg: string;
};

export const motion: {
  sheet: {
    durationMs: number;
    easing: string;
    backdropOpacity: number;
    dragDismissThreshold: number;
  };
};

declare const themeConfig: {
  themeColors: typeof themeColors;
  categoryColors: typeof categoryColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  elevation: typeof elevation;
  motion: typeof motion;
};

export default themeConfig;

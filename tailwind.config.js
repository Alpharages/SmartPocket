const {
  themeColors,
  spacing,
  radius,
  typography,
  elevation,
} = require("./theme.config");
const plugin = require("tailwindcss/plugin");

const tailwindColors = Object.fromEntries(
  Object.entries(themeColors).map(([name, swatch]) => [
    name,
    {
      DEFAULT: `var(--color-${name})`,
      light: swatch.light,
      dark: swatch.dark,
    },
  ]),
);

const tailwindSpacing = Object.fromEntries(
  Object.entries(spacing).map(([name, value]) => [name, `${value}px`]),
);

const tailwindRadius = Object.fromEntries(
  Object.entries(radius).map(([name, value]) => [name, `${value}px`]),
);

// Tailwind's fontSize tuple only honors `lineHeight` / `letterSpacing` / `fontWeight`
// in the options object and silently drops any other key. Tabular figures for the
// `number` token are therefore applied via the dedicated `tabular-nums` utility
// (fontVariantNumeric core plugin) alongside `text-number`, or via the runtime
// `Typography.number.fontVariant` export for StyleSheet code — never through this tuple.
const tailwindFontSize = Object.fromEntries(
  Object.entries(typography).map(([name, style]) => [
    name,
    [
      `${style.fontSize}px`,
      {
        lineHeight: `${style.lineHeight}px`,
        fontWeight: style.fontWeight,
      },
    ],
  ]),
);

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  // Scan all component and app files for Tailwind classes
  content: [
    "./app/**/*.{js,ts,tsx}",
    "./components/**/*.{js,ts,tsx}",
    "./lib/**/*.{js,ts,tsx}",
    "./hooks/**/*.{js,ts,tsx}",
  ],

  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: tailwindColors,
      spacing: tailwindSpacing,
      borderRadius: tailwindRadius,
      fontSize: tailwindFontSize,
      boxShadow: elevation,
    },
  },
  plugins: [
    plugin(({ addVariant }) => {
      addVariant("light", ':root:not([data-theme="dark"]) &');
      addVariant("dark", ':root[data-theme="dark"] &');
    }),
  ],
};

import React from "react";
import { StyleSheet } from "react-native";
import { afterEach, describe, expect, it, vi } from "vitest";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";
import * as Reanimated from "react-native-reanimated";

import { BalanceHero } from "@/components/ui/BalanceHero";
import { ThemeContext } from "@/lib/theme-provider";
import { getThemeTokens, type ThemeId } from "@/lib/_core/theme";
import { formatCurrency, formatCurrencyAccessibilityLabel } from "@/lib/currency";
import { resolveOpaqueGlassFill, glassInkRequirements } from "@/lib/_core/glass";
import { contrastRatio } from "@/lib/_core/contrast";

const mockColors = {
  primary: "#4F46E5",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  foreground: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  success: "#059669",
  warning: "#D97706",
  error: "#DC2626",
  accent: "#DB2777",
  secondary: "#7C3AED",
  text: "#111827",
  tint: "#4F46E5",
  icon: "#6B7280",
  tabIconDefault: "#6B7280",
  tabIconSelected: "#4F46E5",
};

const currencyMock = vi.hoisted(() => ({
  currency: "USD" as const,
  setCurrency: vi.fn(),
  isReady: true,
}));

vi.mock("@/hooks/use-colors", () => ({
  useColors: () => mockColors,
}));

vi.mock("@/lib/currency-provider", () => ({
  useCurrency: () => currencyMock,
}));

vi.mock("@expo/vector-icons", () => ({
  Ionicons: ({
    name,
    size,
    color,
  }: {
    name: string;
    size?: number;
    color?: string;
  }) =>
    React.createElement(
      "Text",
      { testID: `icon-${name}` },
      `ICON:${name}:${size}:${color}`,
    ),
}));

let renderer: ReactTestRenderer | null = null;

function render(ui: React.ReactElement): ReactTestInstance {
  act(() => {
    renderer = TestRenderer.create(ui);
  });
  return renderer!.root;
}

function renderWithTheme(
  ui: React.ReactElement,
  themeId: ThemeId,
  colorScheme: "light" | "dark",
): ReactTestInstance {
  const theme = getThemeTokens(themeId, colorScheme);
  return render(
    <ThemeContext.Provider
      value={{
        colorScheme,
        themePreference: colorScheme,
        setThemePreference: async () => {},
        setColorScheme: () => {},
        themeId,
        setThemeId: async () => {},
        theme,
        isReady: true,
      }}
    >
      {ui}
    </ThemeContext.Provider>,
  );
}

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = null;
  currencyMock.isReady = true;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/** Concatenate the visible text under a node. */
function textOf(node: ReactTestInstance | string): string {
  if (typeof node === "string") return node;
  return (node.children ?? [])
    .map((c) => (typeof c === "string" ? c : textOf(c)))
    .join("");
}

function queryText(root: ReactTestInstance, text: string): ReactTestInstance[] {
  return root.findAll((n) => String(n.type) === "Text" && textOf(n) === text);
}

function getByText(root: ReactTestInstance, text: string): ReactTestInstance {
  const matches = queryText(root, text);
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one Text "${text}", found ${matches.length}`,
    );
  }
  return matches[0];
}

function getHeroNode(root: ReactTestInstance): ReactTestInstance {
  return root.find((n) => n.props.accessibilityRole === "text");
}

/** The `color` a node actually renders with, after flattening its style. */
function colorOf(node: ReactTestInstance): string | undefined {
  return StyleSheet.flatten(node.props.style)?.color as string | undefined;
}

/** Renders and ticks the count-up hook's sync interval to its settled value. */
function renderSettled(ui: React.ReactElement): ReactTestInstance {
  vi.useFakeTimers();
  const root = render(ui);
  act(() => {
    vi.advanceTimersByTime(600);
  });
  return root;
}

const THEMES: ThemeId[] = ["aurora", "obsidian", "spectrum"];
const SCHEMES: Array<"light" | "dark"> = ["light", "dark"];

describe("BalanceHero", () => {
  describe("theme composition (AC1)", () => {
    for (const themeId of THEMES) {
      for (const colorScheme of SCHEMES) {
        it(`composes GradientHero + GlassSurface with ${themeId}/${colorScheme} tokens`, () => {
          const root = renderWithTheme(
            <BalanceHero balance={1800} income={3000} expense={1200} />,
            themeId,
            colorScheme,
          );
          const expected = getThemeTokens(themeId, colorScheme).gradient;
          const gradient = root.find(
            (n) => n.props.testID === "gradient-hero-gradient",
          );
          expect(gradient.props.colors).toEqual(expected.colors);
          // GlassSurface renders either the blur or fallback branch — either
          // way one of its testIDs must be present as the content panel.
          const glassNode = root.findAll(
            (n) =>
              n.props.testID === "glass-surface-blur" ||
              n.props.testID === "glass-surface-fallback",
          );
          expect(glassNode.length).toBeGreaterThanOrEqual(1);
        });
      }
    }
  });

  describe("balance + income/expense split (AC2)", () => {
    it("renders the balance, income, and expense figures", () => {
      const root = renderSettled(
        <BalanceHero balance={1800} income={3000} expense={1200} />,
      );
      expect(
        getByText(root, formatCurrency(1800, "USD", { sign: "neutral" })),
      ).toBeTruthy();
      expect(
        getByText(root, formatCurrency(3000, "USD", { sign: "positive" })),
      ).toBeTruthy();
      expect(
        getByText(root, formatCurrency(1200, "USD", { sign: "negative" })),
      ).toBeTruthy();
    });

    it("shows a visible minus sign for a negative net balance", () => {
      const root = renderSettled(
        <BalanceHero balance={-500} income={200} expense={700} />,
      );
      expect(
        getByText(root, formatCurrency(-500, "USD", { sign: "neutral" })),
      ).toBeTruthy();
    });

    it("applies tabular-nums to the balance figure", () => {
      const root = renderSettled(
        <BalanceHero balance={1800} income={3000} expense={1200} />,
      );
      const balanceNode = getByText(
        root,
        formatCurrency(1800, "USD", { sign: "neutral" }),
      );
      expect(balanceNode.props.className).toContain("tabular-nums");
    });
  });

  describe("count-up (AC3) and reduced motion (AC4)", () => {
    it("snaps instantly to the target with no count-up under reduced motion", () => {
      vi.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
      const root = render(
        <BalanceHero balance={1800} income={3000} expense={1200} />,
      );
      expect(
        getByText(root, formatCurrency(1800, "USD", { sign: "neutral" })),
      ).toBeTruthy();
    });

    it("animates from 0 toward the balance once the sync interval ticks", () => {
      vi.useFakeTimers();
      const root = render(
        <BalanceHero balance={1800} income={3000} expense={1200} />,
      );
      expect(
        getByText(root, formatCurrency(0, "USD", { sign: "neutral" })),
      ).toBeTruthy();
      act(() => {
        vi.advanceTimersByTime(32);
      });
      expect(
        getByText(root, formatCurrency(1800, "USD", { sign: "neutral" })),
      ).toBeTruthy();
    });
  });

  describe("AA over glass surface (AC5)", () => {
    for (const themeId of THEMES) {
      for (const colorScheme of SCHEMES) {
        it(`rendered inks clear AA over the glass fill — ${themeId}/${colorScheme}`, () => {
          // Reduced-motion snaps the count-up to its target so the balance
          // figure renders without advancing timers.
          vi.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
          const theme = getThemeTokens(themeId, colorScheme);
          const fill = resolveOpaqueGlassFill(
            theme.glass,
            theme.colors.surface,
            glassInkRequirements(theme.colors),
          );
          const root = renderWithTheme(
            <BalanceHero balance={1800} income={3000} expense={1200} />,
            themeId,
            colorScheme,
          );
          // Read the color each Text actually renders with — NOT inks
          // re-derived from theme tokens — so an ink-source mismatch (e.g.
          // pulling colors from a theme-agnostic hook) is caught here.
          const inks: Array<[string | undefined, number]> = [
            [colorOf(getByText(root, "This Month")), 4.5],
            [
              colorOf(
                getByText(root, formatCurrency(1800, "USD", { sign: "neutral" })),
              ),
              4.5,
            ],
            [
              colorOf(
                getByText(
                  root,
                  formatCurrency(3000, "USD", { sign: "positive" }),
                ),
              ),
              3,
            ],
            [
              colorOf(
                getByText(
                  root,
                  formatCurrency(1200, "USD", { sign: "negative" }),
                ),
              ),
              3,
            ],
          ];
          for (const [ink, minRatio] of inks) {
            expect(ink).toBeTruthy();
            expect(contrastRatio(fill, ink as string)).toBeGreaterThanOrEqual(
              minRatio,
            );
          }
        });
      }
    }
  });

  describe("accessibility (AC6)", () => {
    it("exposes accessibilityRole='text' and accessible=true as a single group", () => {
      const root = render(
        <BalanceHero balance={1800} income={3000} expense={1200} />,
      );
      const hero = getHeroNode(root);
      expect(hero.props.accessibilityRole).toBe("text");
      expect(hero.props.accessible).toBe(true);
    });

    it("announces sign + currency for balance, income, and expense", () => {
      const root = render(
        <BalanceHero balance={1800} income={3000} expense={1200} />,
      );
      const label = getHeroNode(root).props.accessibilityLabel as string;
      expect(label).toContain(
        formatCurrencyAccessibilityLabel(1800, "USD", "positive"),
      );
      expect(label).toContain(
        formatCurrencyAccessibilityLabel(3000, "USD", "positive"),
      );
      expect(label).toContain(
        formatCurrencyAccessibilityLabel(1200, "USD", "negative"),
      );
    });

    it("announces 'minus' for a negative net balance", () => {
      const root = render(
        <BalanceHero balance={-500} income={200} expense={700} />,
      );
      const label = getHeroNode(root).props.accessibilityLabel as string;
      expect(label).toContain(
        formatCurrencyAccessibilityLabel(-500, "USD", "negative"),
      );
    });
  });

  describe("loading state (AC7)", () => {
    it("renders skeleton placeholders instead of figures while loading", () => {
      const root = render(
        <BalanceHero balance={1800} income={3000} expense={1200} loading />,
      );
      expect(
        queryText(root, formatCurrency(1800, "USD", { sign: "neutral" })),
      ).toHaveLength(0);
      expect(root.findAll((n) => n.props.testID === "skeleton")).not.toHaveLength(
        0,
      );
    });

    it("shows skeleton while the currency preference is loading", () => {
      currencyMock.isReady = false;
      const root = render(
        <BalanceHero balance={1800} income={3000} expense={1200} />,
      );
      expect(
        queryText(root, formatCurrency(1800, "USD", { sign: "neutral" })),
      ).toHaveLength(0);
    });
  });
});

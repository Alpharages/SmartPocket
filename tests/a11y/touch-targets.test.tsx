import React from "react";
import { describe, it, expect, vi } from "vitest";
import TestRenderer, { act } from "react-test-renderer";

import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { TransactionRow } from "@/components/ui/TransactionRow";
import { CategoryToken } from "@/components/ui/CategoryToken";
import { Sheet } from "@/components/ui/Sheet";
import { Toast } from "@/components/ui/Toast";
import { ThemeContext } from "@/lib/theme-provider";
import { THEME_IDS, getThemeTokens, type ThemeId } from "@/lib/_core/theme";

vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({
    primary: "#4F46E5",
    background: "#F8FAFC",
    surface: "#FFFFFF",
    foreground: "#111827",
    muted: "#6B7280",
    border: "#E5E7EB",
    success: "#047857",
    warning: "#B45309",
    error: "#DC2626",
    accent: "#BE185D",
    secondary: "#7C3AED",
    overlay: "rgba(0,0,0,0.4)",
    text: "#111827",
    tint: "#4F46E5",
    icon: "#6B7280",
    tabIconDefault: "#6B7280",
    tabIconSelected: "#4F46E5",
  }),
}));

vi.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

vi.mock("@/lib/currency-provider", () => ({
  useCurrency: () => ({
    currency: "USD",
    setCurrency: vi.fn(),
    isReady: true,
  }),
}));

vi.mock("@expo/vector-icons", () => {
  const Ionicons = ({ name, testID }: { name: string; testID?: string }) =>
    React.createElement("Ionicons", { name, testID });
  (Ionicons as any).glyphMap = {
    "pricetag-outline": 1,
    "cash-outline": 1,
    "arrow-down": 1,
    "arrow-up": 1,
    close: 1,
    checkmark: 1,
  };
  return { Ionicons };
});

vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: "light" },
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

/**
 * Story 12.10 — regression guard proving touch-target sizing (Story 1.19's
 * 44pt baseline) holds across every theme × scheme combination, not just the
 * default Aurora/light render every other component test uses. These
 * primitives size themselves from static style literals rather than theme
 * tokens, so this suite exists to catch a FUTURE regression where a theme
 * conditional accidentally shrinks a target — not because today's sizing
 * varies by theme.
 */
function renderUnderTheme(
  element: React.ReactElement,
  themeId: ThemeId,
  colorScheme: "light" | "dark",
) {
  const theme = getThemeTokens(themeId, colorScheme);
  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
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
        {element}
      </ThemeContext.Provider>,
    );
  });
  return renderer!.root;
}

function findByProp(
  root: TestRenderer.ReactTestInstance,
  prop: string,
  value: unknown,
) {
  return root.find((n) => (n.props as Record<string, unknown>)[prop] === value);
}

function flattenStyle(style: unknown): Record<string, unknown> {
  return Array.isArray(style)
    ? Object.assign({}, ...style.filter(Boolean))
    : ((style as Record<string, unknown>) ?? {});
}

function hasMinHeight(style: unknown, min: number): boolean {
  const s = flattenStyle(style);
  return Number(s.minHeight ?? s.height ?? Infinity) >= min;
}

function hasMinWidth(style: unknown, min: number): boolean {
  const s = flattenStyle(style);
  return Number(s.minWidth ?? s.width ?? Infinity) >= min;
}

const SCHEMES: ("light" | "dark")[] = ["light", "dark"];

describe("Story 12.10 — AC2 touch targets (>=44pt) hold across every theme × variant", () => {
  for (const themeId of THEME_IDS) {
    for (const scheme of SCHEMES) {
      describe(`${themeId} · ${scheme}`, () => {
        it("Button has minHeight >=44", () => {
          const root = renderUnderTheme(
            <Button label="Save" onPress={() => {}} />,
            themeId,
            scheme,
          );
          const btn = findByProp(root, "accessibilityRole", "button");
          expect(hasMinHeight(btn.props.style, 44)).toBe(true);
        });

        it("Button icon-only has minHeight and minWidth >=44", () => {
          const root = renderUnderTheme(
            <Button
              variant="icon-only"
              leftIcon={<React.Fragment />}
              onPress={() => {}}
              accessibilityLabel="Star"
            />,
            themeId,
            scheme,
          );
          const btn = findByProp(root, "accessibilityRole", "button");
          expect(hasMinHeight(btn.props.style, 44)).toBe(true);
          expect(hasMinWidth(btn.props.style, 44)).toBe(true);
        });

        it("Pill has minHeight >=44", () => {
          const root = renderUnderTheme(
            <Pill label="Filter" onPress={() => {}} />,
            themeId,
            scheme,
          );
          const pill = findByProp(root, "accessibilityRole", "button");
          expect(hasMinHeight(pill.props.style, 44)).toBe(true);
        });

        it("TransactionRow has minHeight >=44", () => {
          const root = renderUnderTheme(
            <TransactionRow
              title="Test"
              date="2026-06-01"
              amount="10"
              type="expense"
              categoryColor="#DC2626"
              categoryIcon="pricetag-outline"
            />,
            themeId,
            scheme,
          );
          const row = findByProp(root, "accessibilityRole", "button");
          expect(hasMinHeight(row.props.style, 44)).toBe(true);
        });

        it("CategoryToken interactive has minHeight and minWidth >=44", () => {
          const root = renderUnderTheme(
            <CategoryToken
              name="Food"
              color="#DC2626"
              icon="pricetag-outline"
              onPress={() => {}}
            />,
            themeId,
            scheme,
          );
          const token = findByProp(root, "accessibilityRole", "button");
          expect(hasMinHeight(token.props.style, 44)).toBe(true);
          expect(hasMinWidth(token.props.style, 44)).toBe(true);
        });

        it("Sheet close button has minHeight >=44", () => {
          const root = renderUnderTheme(
            <Sheet visible onClose={() => {}} title="Test">
              <React.Fragment />
            </Sheet>,
            themeId,
            scheme,
          );
          const closeBtn = findByProp(root, "accessibilityLabel", "Close");
          expect(hasMinHeight(closeBtn.props.style, 44)).toBe(true);
        });

        it("Toast dismiss button has minHeight and minWidth >=44", () => {
          const root = renderUnderTheme(
            <Toast
              id="t1"
              type="success"
              message="Saved"
              onDismiss={() => {}}
            />,
            themeId,
            scheme,
          );
          const dismiss = findByProp(root, "accessibilityLabel", "Dismiss");
          expect(hasMinHeight(dismiss.props.style, 44)).toBe(true);
          expect(hasMinWidth(dismiss.props.style, 44)).toBe(true);
        });
      });
    }
  }
});

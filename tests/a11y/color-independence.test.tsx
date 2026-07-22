import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";

import { BalanceHero } from "@/components/ui/BalanceHero";
import { ThemeContext } from "@/lib/theme-provider";
import { getThemeTokens, THEME_IDS, type ColorScheme } from "@/lib/_core/theme";
import { formatCurrency } from "@/lib/currency";

/**
 * Story 12.10 (RDR-9), AC5 — "distinguished by sign (+/-) and icon, never
 * color alone." `docs/accessibility-checklist.md` claimed this "Verified"
 * without a backing assertion (Lore lesson `faac8523`); this suite is that
 * assertion. It renders `BalanceHero` — the income/expense surface migrated
 * to the theme registry (Story 12.7) — across every theme x variant and
 * proves the income/expense distinction survives with color stripped out:
 * a fixed icon shape (arrow-down vs arrow-up) and an explicit sign character
 * are both present and differ between income and expense, independent of
 * which theme/scheme supplies the color.
 */

const currencyMock = vi.hoisted(() => ({
  currency: "USD" as const,
  setCurrency: vi.fn(),
  isReady: true,
}));

vi.mock("@/lib/currency-provider", () => ({
  useCurrency: () => currencyMock,
}));

vi.mock("@expo/vector-icons", () => {
  const Ionicons = ({ name, testID }: { name: string; testID?: string }) =>
    React.createElement("Ionicons", { name, testID });
  (Ionicons as { glyphMap?: Record<string, number> }).glyphMap = {
    "arrow-down": 1,
    "arrow-up": 1,
  };
  return { Ionicons };
});

let renderer: ReactTestRenderer | null = null;

function render(ui: React.ReactElement): ReactTestInstance {
  act(() => {
    renderer = TestRenderer.create(ui);
  });
  return renderer!.root;
}

function renderWithTheme(
  ui: React.ReactElement,
  themeId: (typeof THEME_IDS)[number],
  colorScheme: ColorScheme,
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
});

/** Concatenate the visible text under a node (mirrors BalanceHero.test.tsx). */
function textOf(node: ReactTestInstance | string): string {
  if (typeof node === "string") return node;
  return (node.children ?? [])
    .map((c) => (typeof c === "string" ? c : textOf(c)))
    .join("");
}

function findByTestId(
  root: ReactTestInstance,
  testID: string,
): ReactTestInstance {
  return root.find((n) => n.props.testID === testID);
}

/** The Ionicons `name` rendered under a node, ignoring color/size. */
function iconNameOf(node: ReactTestInstance): string {
  const icon = node.find((n) => String(n.type) === "Ionicons");
  return icon.props.name as string;
}

const SCHEMES: ColorScheme[] = ["light", "dark"];

describe("Color-independent income/expense (AC5) — all 6 theme x variant combinations", () => {
  for (const themeId of THEME_IDS) {
    for (const scheme of SCHEMES) {
      it(`${themeId} · ${scheme}: income/expense differ by icon + sign, not just color`, () => {
        const root = renderWithTheme(
          <BalanceHero balance={1800} income={3000} expense={1200} />,
          themeId,
          scheme,
        );

        const incomeRow = findByTestId(root, "balance-hero-income");
        const expenseRow = findByTestId(root, "balance-hero-expense");

        // Icon shape differs by direction (arrow-down for income, arrow-up
        // for expense) — a shape difference a colorblind or grayscale-screen
        // user can perceive without relying on the success/error hue.
        const incomeIcon = iconNameOf(incomeRow);
        const expenseIcon = iconNameOf(expenseRow);
        expect(incomeIcon).toBe("arrow-down");
        expect(expenseIcon).toBe("arrow-up");
        expect(incomeIcon).not.toBe(expenseIcon);

        // Sign character differs too (+/-), independent of the icon.
        const incomeText = textOf(incomeRow);
        const expenseText = textOf(expenseRow);
        expect(incomeText).toBe(formatCurrency(3000, "USD", { sign: "positive" }));
        expect(expenseText).toBe(formatCurrency(1200, "USD", { sign: "negative" }));
        expect(incomeText.startsWith("+")).toBe(true);
        expect(expenseText.startsWith("-")).toBe(true);
      });
    }
  }
});

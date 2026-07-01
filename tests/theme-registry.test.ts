import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_THEME_ID,
  THEMES,
  THEME_IDS,
  getThemeTokens,
} from "@/lib/_core/theme";
import {
  DEFAULT_THEME_ID as PREFERENCE_DEFAULT_THEME_ID,
  THEME_ID_OPTIONS,
  THEME_ID_STORAGE_KEY,
  isSupportedThemeId,
} from "@/lib/theme-preference";

const storage = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      storage.delete(key);
    }),
  },
}));

vi.mock("nativewind", () => ({
  colorScheme: { set: vi.fn() },
  vars: (value: unknown) => value,
}));

describe("Theme registry (Story 12.1)", () => {
  it("exposes exactly the three named themes", () => {
    expect(THEME_IDS.sort()).toEqual(["aurora", "obsidian", "spectrum"]);
  });

  it("gives every theme a complete token surface (incl. per-variant gradient/glass + category)", () => {
    for (const id of THEME_IDS) {
      const theme = THEMES[id];
      expect(theme.color).toBeDefined();
      // gradient/glass carry a light AND dark variant as of Story 12.2
      expect(theme.gradient.light).toBeDefined();
      expect(theme.gradient.dark).toBeDefined();
      expect(theme.glass.light.blur).toBeGreaterThan(0);
      expect(theme.glass.dark.tint).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(theme.elevation).toBeDefined();
      expect(theme.motion).toBeDefined();
      expect(theme.category).toHaveLength(10);
    }
  });

  it("defaults to aurora as the first-run theme", () => {
    expect(DEFAULT_THEME_ID).toBe("aurora");
    expect(PREFERENCE_DEFAULT_THEME_ID).toBe("aurora");
  });

  it("seeds aurora with the existing Refined Indigo palette", () => {
    expect(THEMES.aurora.color.primary).toEqual({
      light: "#4F46E5",
      dark: "#818CF8",
    });
  });

  it("authors obsidian and spectrum as distinct token sets (Story 12.2 — no theme is a clone)", () => {
    expect(THEMES.obsidian.color).not.toEqual(THEMES.aurora.color);
    expect(THEMES.spectrum.color).not.toEqual(THEMES.aurora.color);
    expect(THEMES.obsidian.color).not.toEqual(THEMES.spectrum.color);
    // signature identities: obsidian navy bg, spectrum purple-black bg
    expect(THEMES.obsidian.color.background.dark).toBe("#0F172A");
    expect(THEMES.spectrum.color.background.dark).toBe("#120A24");
  });
});

describe("getThemeTokens resolver", () => {
  it("resolves the requested theme × scheme to flat color values", () => {
    const resolved = getThemeTokens("aurora", "dark");
    expect(resolved.themeId).toBe("aurora");
    expect(resolved.colorScheme).toBe("dark");
    expect(resolved.colors.primary).toBe("#818CF8");
    expect(resolved.colors.background).toBe("#0B0F19");
  });

  it("resolves the light variant independently from dark", () => {
    const resolved = getThemeTokens("aurora", "light");
    expect(resolved.colors.primary).toBe("#4F46E5");
  });

  it("falls back to the default theme for an unknown themeId", () => {
    const resolved = getThemeTokens(
      "not-a-real-theme" as unknown as "aurora",
      "light",
    );
    expect(resolved.colors).toEqual(getThemeTokens("aurora", "light").colors);
  });
});

describe("isSupportedThemeId guard", () => {
  it("accepts every registered theme id", () => {
    for (const { value } of THEME_ID_OPTIONS) {
      expect(isSupportedThemeId(value)).toBe(true);
    }
  });

  it("rejects unknown or legacy values", () => {
    expect(isSupportedThemeId("refined-indigo")).toBe(false);
    expect(isSupportedThemeId("")).toBe(false);
  });
});

describe("loadThemeId persistence", () => {
  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();
  });

  it("returns the stored themeId when present", async () => {
    storage.set(THEME_ID_STORAGE_KEY, "obsidian");
    const { loadThemeId } = await import("@/lib/theme-provider");
    await expect(loadThemeId()).resolves.toBe("obsidian");
  });

  it("defaults to aurora when storage is empty", async () => {
    const { loadThemeId } = await import("@/lib/theme-provider");
    await expect(loadThemeId()).resolves.toBe("aurora");
  });

  it("falls back to aurora for a corrupt/legacy stored value", async () => {
    storage.set(THEME_ID_STORAGE_KEY, "refined-indigo");
    const { loadThemeId } = await import("@/lib/theme-provider");
    await expect(loadThemeId()).resolves.toBe("aurora");
  });
});

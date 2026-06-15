import { describe, expect, it } from "vitest";

import {
  DEFAULT_THEME_PREFERENCE,
  isSupportedThemePreference,
  resolveColorScheme,
} from "@/lib/theme-preference";

describe("resolveColorScheme", () => {
  it("returns system scheme when preference is system", () => {
    expect(resolveColorScheme("system", "light")).toBe("light");
    expect(resolveColorScheme("system", "dark")).toBe("dark");
  });

  it("returns explicit preference when not system", () => {
    expect(resolveColorScheme("light", "dark")).toBe("light");
    expect(resolveColorScheme("dark", "light")).toBe("dark");
  });
});

describe("isSupportedThemePreference", () => {
  it("accepts light, dark, and system", () => {
    expect(isSupportedThemePreference("light")).toBe(true);
    expect(isSupportedThemePreference("dark")).toBe(true);
    expect(isSupportedThemePreference("system")).toBe(true);
  });

  it("rejects unknown values", () => {
    expect(isSupportedThemePreference("blue")).toBe(false);
    expect(isSupportedThemePreference("")).toBe(false);
  });
});

describe("DEFAULT_THEME_PREFERENCE", () => {
  it("defaults to system", () => {
    expect(DEFAULT_THEME_PREFERENCE).toBe("system");
  });
});

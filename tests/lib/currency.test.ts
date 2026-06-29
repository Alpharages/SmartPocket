import { describe, expect, it, vi } from "vitest";
import { getLocales } from "expo-localization";

import {
  CURRENCIES,
  formatCurrency,
  formatCurrencyAccessibilityLabel,
  getCurrencyLabel,
  getDefaultCurrencyFromLocale,
  isSupportedCurrency,
  type CurrencyCode,
} from "@/lib/currency";

describe("formatCurrency", () => {
  it("formats USD with two decimal places", () => {
    expect(formatCurrency(1234.5, "USD")).toMatch(/\$1,234\.50|US\$1,234\.50/);
  });

  it("formats GBP", () => {
    const result = formatCurrency(99.99, "GBP");
    expect(result).toContain("99.99");
    expect(result).toMatch(/£|GBP/);
  });

  it("respects JPY zero decimal places", () => {
    const result = formatCurrency(1500, "JPY");
    expect(result).not.toMatch(/\.00$/);
    expect(result).toMatch(/1,500|1500/);
  });

  it("applies positive sign prefix", () => {
    expect(formatCurrency(50, "USD", { sign: "positive" })).toMatch(/^\+/);
  });

  it("applies negative sign prefix", () => {
    expect(formatCurrency(50, "USD", { sign: "negative" })).toMatch(/^-/);
  });

  it("uses absolute value for hero-style display", () => {
    expect(formatCurrency(-1800, "USD", { sign: "absolute" })).not.toMatch(
      /^-/,
    );
    expect(formatCurrency(-1800, "USD", { sign: "absolute" })).toMatch(
      /1,800\.00|1800\.00/,
    );
  });

  it("falls back to symbol + fixed decimals when Intl rejects the code", () => {
    const original = Intl.NumberFormat;
    vi.spyOn(Intl, "NumberFormat").mockImplementation(() => {
      throw new Error("unsupported");
    });

    expect(formatCurrency(10.5, "USD")).toBe("$10.50");

    Intl.NumberFormat = original;
    vi.restoreAllMocks();
  });

  it("guards short/invalid amounts as zero", () => {
    expect(formatCurrency(Number.NaN, "USD")).toMatch(/0\.00|0/);
  });
});

describe("getDefaultCurrencyFromLocale", () => {
  it("returns USD when locale currency is unsupported", () => {
    vi.mocked(getLocales).mockReturnValueOnce([
      {
        currencyCode: "XYZ",
        languageTag: "en-US",
        languageCode: "en",
        regionCode: "US",
      },
    ] as ReturnType<typeof getLocales>);

    const spy = vi
      .spyOn(Intl.NumberFormat.prototype, "resolvedOptions")
      .mockReturnValue({
        locale: "en-US",
        currency: "XYZ",
      } as Intl.ResolvedNumberFormatOptions);

    expect(getDefaultCurrencyFromLocale()).toBe("USD");
    spy.mockRestore();
  });

  it("returns supported locale currency from expo-localization", () => {
    vi.mocked(getLocales).mockReturnValueOnce([
      {
        currencyCode: "GBP",
        languageTag: "en-GB",
        languageCode: "en",
        regionCode: "GB",
      },
    ] as ReturnType<typeof getLocales>);

    expect(getDefaultCurrencyFromLocale()).toBe("GBP");
  });

  it("returns supported locale currency from Intl when expo has no code", () => {
    vi.mocked(getLocales).mockReturnValueOnce([
      { languageTag: "en-GB", languageCode: "en", regionCode: "GB" },
    ] as ReturnType<typeof getLocales>);

    const spy = vi
      .spyOn(Intl.NumberFormat.prototype, "resolvedOptions")
      .mockReturnValue({
        locale: "en-GB",
        currency: "GBP",
      } as Intl.ResolvedNumberFormatOptions);

    expect(getDefaultCurrencyFromLocale()).toBe("GBP");
    spy.mockRestore();
  });
});

describe("formatCurrencyAccessibilityLabel", () => {
  it("uses currency name instead of hardcoded dollars", () => {
    const label = formatCurrencyAccessibilityLabel(1240.5, "USD", "positive");
    expect(label).toMatch(/^plus,/);
    expect(label.toLowerCase()).toContain("dollar");
    expect(label).not.toMatch(/\bcents\b/);
  });

  it("announces euros for EUR", () => {
    const label = formatCurrencyAccessibilityLabel(99.99, "EUR", "negative");
    expect(label).toMatch(/^minus,/);
    expect(label.toLowerCase()).toContain("euro");
  });

  it("respects JPY zero decimals in spoken label", () => {
    const label = formatCurrencyAccessibilityLabel(1500, "JPY");
    expect(label.toLowerCase()).toContain("yen");
    expect(label).not.toMatch(/\.00/);
  });
});

describe("currency catalog", () => {
  it("includes expected major currencies", () => {
    const codes = CURRENCIES.map((c) => c.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        "USD",
        "EUR",
        "GBP",
        "JPY",
        "PKR",
      ] satisfies CurrencyCode[]),
    );
  });

  it("isSupportedCurrency narrows codes", () => {
    expect(isSupportedCurrency("EUR")).toBe(true);
    expect(isSupportedCurrency("XYZ")).toBe(false);
  });

  it("getCurrencyLabel returns name and code", () => {
    expect(getCurrencyLabel("EUR")).toBe("Euro (EUR)");
  });
});

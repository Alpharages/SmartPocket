import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLocales } from "expo-localization";

import { CURRENCY_STORAGE_KEY } from "@/lib/currency";
import { loadCurrencyPreference } from "@/lib/currency-provider";

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

describe("loadCurrencyPreference", () => {
  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();
  });

  it("returns stored currency when present", async () => {
    storage.set(CURRENCY_STORAGE_KEY, "EUR");
    await expect(loadCurrencyPreference()).resolves.toBe("EUR");
  });

  it("seeds default locale currency when storage is empty", async () => {
    vi.mocked(getLocales).mockReturnValueOnce([
      {
        currencyCode: "GBP",
        languageTag: "en-GB",
        languageCode: "en",
        regionCode: "GB",
      },
    ] as ReturnType<typeof getLocales>);

    await expect(loadCurrencyPreference()).resolves.toBe("GBP");
    expect(storage.get(CURRENCY_STORAGE_KEY)).toBe("GBP");
  });

  it("falls back to USD when storage read fails", async () => {
    const AsyncStorage = (
      await import("@react-native-async-storage/async-storage")
    ).default;
    vi.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error("offline"));

    await expect(loadCurrencyPreference()).resolves.toBe("USD");
  });
});

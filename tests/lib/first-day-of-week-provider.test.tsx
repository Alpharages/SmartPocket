import { beforeEach, describe, expect, it, vi } from "vitest";

import { FIRST_DAY_OF_WEEK_STORAGE_KEY } from "@/lib/first-day-of-week";
import { loadFirstDayOfWeekPreference } from "@/lib/first-day-of-week-provider";

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

describe("loadFirstDayOfWeekPreference", () => {
  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();
  });

  it("returns stored value when present", async () => {
    storage.set(FIRST_DAY_OF_WEEK_STORAGE_KEY, "1");
    await expect(loadFirstDayOfWeekPreference()).resolves.toBe(1);
  });

  it("defaults to Sunday when storage is empty", async () => {
    await expect(loadFirstDayOfWeekPreference()).resolves.toBe(0);
  });

  it("defaults to Sunday when storage read fails", async () => {
    const AsyncStorage = (
      await import("@react-native-async-storage/async-storage")
    ).default;
    vi.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error("offline"));

    await expect(loadFirstDayOfWeekPreference()).resolves.toBe(0);
  });

  it("defaults to Sunday when stored value is invalid", async () => {
    storage.set(FIRST_DAY_OF_WEEK_STORAGE_KEY, "3");
    await expect(loadFirstDayOfWeekPreference()).resolves.toBe(0);
  });
});

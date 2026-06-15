import { vi } from "vitest";

export const getLocales = vi.fn(() => [
  { currencyCode: "USD", languageTag: "en-US", languageCode: "en", regionCode: "US" },
]);

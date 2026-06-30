import { vi } from "vitest";

export const EncodingType = { UTF8: "utf8", Base64: "base64" };
export const cacheDirectory = "/tmp/cache/";
export const writeAsStringAsync = vi.fn().mockResolvedValue(undefined);
export const deleteAsync = vi.fn().mockResolvedValue(undefined);

export default {
  EncodingType,
  cacheDirectory,
  writeAsStringAsync,
  deleteAsync,
};

import { vi } from "vitest";

export const isAvailableAsync = vi.fn().mockResolvedValue(true);
export const shareAsync = vi.fn().mockResolvedValue(undefined);

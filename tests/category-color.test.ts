import { describe, it, expect } from "vitest";
import {
  getCategoryColorByIndex,
  getCategoryColorForName,
  hashToPaletteIndex,
  resolveCategoryColor,
  CATEGORY_COLOR_LIGHT_VALUES,
  CATEGORY_COLOR_DARK_VALUES,
} from "@/lib/_core/theme";

describe("Category Color Assignment", () => {
  describe("getCategoryColorByIndex", () => {
    it("should return a valid hex color for index 0", () => {
      const color = getCategoryColorByIndex(0);
      expect(color).toMatch(/^#[0-9A-F]{6}$/i);
      expect(color).toBe(CATEGORY_COLOR_LIGHT_VALUES[0]);
    });

    it("should wrap around when index exceeds palette length", () => {
      const len = CATEGORY_COLOR_LIGHT_VALUES.length;
      expect(getCategoryColorByIndex(len)).toBe(getCategoryColorByIndex(0));
      expect(getCategoryColorByIndex(len + 1)).toBe(getCategoryColorByIndex(1));
      expect(getCategoryColorByIndex(len * 3 + 5)).toBe(
        getCategoryColorByIndex(5),
      );
    });

    it("should be deterministic for the same index", () => {
      const c1 = getCategoryColorByIndex(3);
      const c2 = getCategoryColorByIndex(3);
      expect(c1).toBe(c2);
    });

    it("should distribute colors across the palette", () => {
      const colors = Array.from({ length: 20 }, (_, i) =>
        getCategoryColorByIndex(i),
      );
      const unique = new Set(colors);
      // With 10 palette colors and 20 indices, we should see all 10 colors
      expect(unique.size).toBe(10);
    });
  });

  describe("hashToPaletteIndex", () => {
    it("should return a number within palette bounds", () => {
      const idx = hashToPaletteIndex("Groceries");
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(CATEGORY_COLOR_LIGHT_VALUES.length);
    });

    it("should be deterministic for the same input", () => {
      const idx1 = hashToPaletteIndex("Utilities");
      const idx2 = hashToPaletteIndex("Utilities");
      expect(idx1).toBe(idx2);
    });

    it("should produce different indices for different names", () => {
      const names = ["Food", "Transport", "Housing", "Entertainment", "Health"];
      const indices = names.map((n) => hashToPaletteIndex(n));
      const unique = new Set(indices);
      // Not a strict requirement, but with 5 names and 10 slots we expect variety
      expect(unique.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe("getCategoryColorForName", () => {
    it("should return a valid hex color for any name", () => {
      const color = getCategoryColorForName("Random Category");
      expect(color).toMatch(/^#[0-9A-F]{6}$/i);
    });

    it("should be deterministic for the same name", () => {
      const c1 = getCategoryColorForName("Salary");
      const c2 = getCategoryColorForName("Salary");
      expect(c1).toBe(c2);
    });

    it("should never return the retired teal", () => {
      for (let i = 0; i < 100; i++) {
        const color = getCategoryColorForName(`Category ${i}`);
        expect(color.toLowerCase()).not.toBe("#0a7ea4");
      }
    });
  });

  describe("theme-aware resolution", () => {
    it("getCategoryColorByIndex returns the dark variant for the dark scheme", () => {
      expect(getCategoryColorByIndex(0, "dark")).toBe(
        CATEGORY_COLOR_DARK_VALUES[0],
      );
      expect(getCategoryColorByIndex(0, "light")).toBe(
        CATEGORY_COLOR_LIGHT_VALUES[0],
      );
    });

    it("resolveCategoryColor maps a stored light token to its dark variant in dark mode", () => {
      const light = CATEGORY_COLOR_LIGHT_VALUES[2];
      expect(resolveCategoryColor(light, "dark")).toBe(
        CATEGORY_COLOR_DARK_VALUES[2],
      );
    });

    it("resolveCategoryColor leaves the stored value unchanged in light mode", () => {
      const light = CATEGORY_COLOR_LIGHT_VALUES[2];
      expect(resolveCategoryColor(light, "light")).toBe(light);
    });

    it("resolveCategoryColor returns unknown/legacy colors unchanged", () => {
      expect(resolveCategoryColor("#0a7ea4", "dark")).toBe("#0a7ea4");
      expect(resolveCategoryColor("#123456", "dark")).toBe("#123456");
    });
  });
});

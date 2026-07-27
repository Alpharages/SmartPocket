import { describe, expect, it } from "vitest";

import { meetsAA } from "@/lib/_core/contrast";

describe("meetsAA", () => {
  it("requires >=4.5:1 for normal text by default", () => {
    // #767676 on white is ~4.54:1 — the canonical "just clears 4.5" example.
    expect(meetsAA("#767676", "#FFFFFF")).toBe(true);
    // #777777 on white is ~4.48:1 — just under.
    expect(meetsAA("#777777", "#FFFFFF")).toBe(false);
  });

  it("requires only >=3:1 when large is true", () => {
    // ~3.0:1 lightened gray against white passes the large-text/UI bar
    // but fails the normal-text bar.
    expect(meetsAA("#949494", "#FFFFFF", true)).toBe(true);
    expect(meetsAA("#949494", "#FFFFFF", false)).toBe(false);
  });

  it("passes for maximal contrast (black on white)", () => {
    expect(meetsAA("#000000", "#FFFFFF")).toBe(true);
  });

  it("fails for identical colors", () => {
    expect(meetsAA("#4F46E5", "#4F46E5")).toBe(false);
  });
});

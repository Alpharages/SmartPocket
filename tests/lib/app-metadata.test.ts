import { describe, expect, it } from "vitest";

import { getAppMetadata } from "@/lib/app-metadata";

describe("getAppMetadata", () => {
  it("reads name and version from expo-constants", () => {
    expect(getAppMetadata()).toEqual({
      name: "Expense Tracker",
      version: "1.0.0",
    });
  });
});

import { describe, expect, it } from "vitest";
import { getMutationErrorMessage } from "@/lib/mutation-error";

// SP-083: a duplicate category produced a generic "Failed to add category"
// because every handler caught with `catch {}` and discarded the server's
// message. The fallback must still apply when there is nothing better.
describe("getMutationErrorMessage", () => {
  it("prefers the server's message", () => {
    expect(
      getMutationErrorMessage(
        new Error('An expense category named "Groceries" already exists.'),
        "Failed to add category",
      ),
    ).toBe('An expense category named "Groceries" already exists.');
  });

  it("falls back when the error carries no usable message", () => {
    expect(getMutationErrorMessage(undefined, "Failed to add category")).toBe(
      "Failed to add category",
    );
    expect(getMutationErrorMessage({}, "Failed to add category")).toBe(
      "Failed to add category",
    );
    expect(getMutationErrorMessage("boom", "Failed to add category")).toBe(
      "Failed to add category",
    );
    expect(
      getMutationErrorMessage({ message: 42 }, "Failed to add category"),
    ).toBe("Failed to add category");
  });
});

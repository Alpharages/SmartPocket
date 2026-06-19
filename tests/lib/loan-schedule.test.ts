import { describe, expect, it } from "vitest";
import {
  advanceNextDueDate,
  resolveNextDueDateAfterRepayment,
  shouldAdvanceNextDueDate,
} from "@/lib/loan-schedule";

describe("advanceNextDueDate", () => {
  it("advances weekly by seven days", () => {
    const current = new Date("2026-06-01T12:00:00.000Z");
    const next = advanceNextDueDate("weekly", current);
    expect(next?.toISOString()).toBe("2026-06-08T12:00:00.000Z");
  });

  it("advances monthly across month boundaries", () => {
    const jan31 = new Date("2026-01-31T00:00:00.000Z");
    const next = advanceNextDueDate("monthly", jan31);
    expect(next?.toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });

  it("advances yearly", () => {
    const leap = new Date("2024-02-29T00:00:00.000Z");
    const next = advanceNextDueDate("yearly", leap);
    expect(next?.toISOString()).toBe("2025-02-28T00:00:00.000Z");
  });

  it("returns null for none periodicity", () => {
    expect(
      advanceNextDueDate("none", new Date("2026-06-01T00:00:00.000Z")),
    ).toBeNull();
  });
});

describe("shouldAdvanceNextDueDate", () => {
  it("is false when periodicity is none", () => {
    expect(
      shouldAdvanceNextDueDate("none", new Date("2026-07-01T00:00:00.000Z")),
    ).toBe(false);
  });

  it("is true when schedule and due date exist", () => {
    expect(
      shouldAdvanceNextDueDate("monthly", new Date("2026-07-01T00:00:00.000Z")),
    ).toBe(true);
  });
});

describe("resolveNextDueDateAfterRepayment", () => {
  it("returns null when loan has no schedule", () => {
    expect(resolveNextDueDateAfterRepayment("none", null)).toBeNull();
  });

  it("advances from prior due date", () => {
    const next = resolveNextDueDateAfterRepayment(
      "monthly",
      new Date("2026-07-01T00:00:00.000Z"),
    );
    expect(next?.toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });
});

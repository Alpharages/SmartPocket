import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDefaultLoanForm,
  getLoanFormErrors,
  isLoanFormValid,
  isPositiveMoney,
  isValidLoanSchedule,
  type LoanFormValues,
} from "@/lib/loan-form-validation";

const validBase: LoanFormValues = {
  direction: "lend",
  counterparty: "Alex",
  principal: "250.00",
  rate: "5",
  periodicity: "monthly",
  scheduleMode: "count",
  installmentCount: "10",
  endDate: "",
  nextDueDate: "2026-07-01",
};

describe("isPositiveMoney", () => {
  it("accepts minimum valid principal 0.01", () => {
    expect(isPositiveMoney("0.01")).toBe(true);
  });

  it("rejects zero", () => {
    expect(isPositiveMoney("0")).toBe(false);
  });

  it("rejects negative values", () => {
    expect(isPositiveMoney("-5")).toBe(false);
  });

  it("rejects more than two decimal places", () => {
    expect(isPositiveMoney("1.234")).toBe(false);
  });
});

describe("isValidLoanSchedule", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts periodicity none without count or end date", () => {
    expect(isValidLoanSchedule("none", "count", "", "")).toBe(true);
  });

  it("requires a positive installment count for recurring schedules", () => {
    expect(isValidLoanSchedule("monthly", "count", "0", "")).toBe(false);
    expect(isValidLoanSchedule("monthly", "count", "12", "")).toBe(true);
  });

  it("requires a future end date when schedule mode is endDate", () => {
    expect(isValidLoanSchedule("weekly", "endDate", "", "2026-05-01")).toBe(
      false,
    );
    expect(isValidLoanSchedule("weekly", "endDate", "", "2026-08-01")).toBe(
      true,
    );
  });

  it("rejects invalid end date strings", () => {
    expect(isValidLoanSchedule("yearly", "endDate", "", "not-a-date")).toBe(
      false,
    );
  });
});

describe("isLoanFormValid", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns true when all required fields are valid", () => {
    expect(isLoanFormValid(validBase, "create")).toBe(true);
  });

  it("returns false for invalid principal values", () => {
    expect(isLoanFormValid({ ...validBase, principal: "0" }, "create")).toBe(
      false,
    );
    expect(isLoanFormValid({ ...validBase, principal: "-5" }, "create")).toBe(
      false,
    );
    expect(
      isLoanFormValid({ ...validBase, principal: "1.234" }, "create"),
    ).toBe(false);
  });

  it("allows empty counterparty and optional rate of zero", () => {
    expect(
      isLoanFormValid(
        { ...validBase, counterparty: "", rate: "0", direction: "borrow" },
        "create",
      ),
    ).toBe(true);
  });

  it("returns false for invalid schedule", () => {
    expect(
      isLoanFormValid(
        {
          ...validBase,
          periodicity: "monthly",
          scheduleMode: "count",
          installmentCount: "",
        },
        "create",
      ),
    ).toBe(false);
  });

  it("requires a valid next due date", () => {
    expect(isLoanFormValid({ ...validBase, nextDueDate: "" }, "create")).toBe(
      false,
    );
    expect(
      isLoanFormValid({ ...validBase, nextDueDate: "2026-13-40" }, "create"),
    ).toBe(false);
  });
});

describe("createDefaultLoanForm", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-19T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("prefills direction, schedule, installments, and next due date", () => {
    const defaults = createDefaultLoanForm();
    expect(defaults.direction).toBe("lend");
    expect(defaults.periodicity).toBe("monthly");
    expect(defaults.installmentCount).toBe("12");
    expect(defaults.nextDueDate).toBe("2026-07-19");
    expect(isLoanFormValid(defaults, "create")).toBe(false);
    expect(isLoanFormValid({ ...defaults, principal: "250" }, "create")).toBe(
      true,
    );
  });
});

describe("getLoanFormErrors", () => {
  it("lists missing required fields", () => {
    const errors = getLoanFormErrors(createDefaultLoanForm(), "create");
    expect(errors).toEqual([
      {
        field: "principal",
        message: "Enter a valid principal greater than zero",
      },
    ]);
  });

  it("flags invalid money formats", () => {
    const errors = getLoanFormErrors(
      {
        ...validBase,
        principal: "250.",
        rate: "12.345",
      },
      "create",
    );
    expect(errors.map((e) => e.field)).toEqual(["principal", "rate"]);
  });
});

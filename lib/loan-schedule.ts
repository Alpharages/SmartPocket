type LoanPeriodicity = "weekly" | "monthly" | "yearly" | "none";

function daysInMonthUtc(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Advance a due date by one schedule interval (timezone-aware UTC components). */
export function advanceNextDueDate(
  periodicity: LoanPeriodicity,
  currentDueDate: Date,
): Date | null {
  if (periodicity === "none") {
    return null;
  }

  if (periodicity === "weekly") {
    return new Date(currentDueDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  const year = currentDueDate.getUTCFullYear();
  const month = currentDueDate.getUTCMonth();
  const day = currentDueDate.getUTCDate();
  const hours = currentDueDate.getUTCHours();
  const minutes = currentDueDate.getUTCMinutes();
  const seconds = currentDueDate.getUTCSeconds();
  const ms = currentDueDate.getUTCMilliseconds();

  const monthDelta = periodicity === "monthly" ? 1 : 12;
  const targetMonthIndex = month + monthDelta;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
  const maxDay = daysInMonthUtc(targetYear, normalizedMonth);

  return new Date(
    Date.UTC(
      targetYear,
      normalizedMonth,
      Math.min(day, maxDay),
      hours,
      minutes,
      seconds,
      ms,
    ),
  );
}

/** Whether a loan schedule should advance nextDueDate after a repayment. */
export function shouldAdvanceNextDueDate(
  periodicity: LoanPeriodicity,
  nextDueDate: Date | string | null | undefined,
): nextDueDate is Date {
  if (periodicity === "none") return false;
  return toDate(nextDueDate) != null;
}

export function resolveNextDueDateAfterRepayment(
  periodicity: LoanPeriodicity,
  currentNextDueDate: Date | string | null | undefined,
): Date | null {
  const due = toDate(currentNextDueDate);
  if (!due || periodicity === "none") {
    return null;
  }
  return advanceNextDueDate(periodicity, due);
}

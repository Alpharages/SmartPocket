import * as db from "../db";

type Frequency = "daily" | "weekly" | "monthly" | "yearly";
type EndCondition = "count" | "endDate" | "never";

function toDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  return value instanceof Date ? value : new Date(value);
}

function daysInMonthUtc(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function computeNextRunDate(
  date: Date,
  frequency: Frequency,
  interval: number,
): Date {
  if (frequency === "daily") {
    return new Date(date.getTime() + interval * 24 * 60 * 60 * 1000);
  }
  if (frequency === "weekly") {
    return new Date(date.getTime() + interval * 7 * 24 * 60 * 60 * 1000);
  }

  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = date.getUTCSeconds();
  const ms = date.getUTCMilliseconds();

  const monthDelta = frequency === "monthly" ? interval : interval * 12;
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

function shouldDeactivate(
  endCondition: EndCondition,
  generatedCount: number,
  occurrenceCount: number | null,
  nextRunDate: Date,
  endDate: Date | null,
): boolean {
  if (endCondition === "count" && occurrenceCount != null) {
    return generatedCount >= occurrenceCount;
  }
  if (endCondition === "endDate" && endDate != null) {
    return nextRunDate > endDate;
  }
  return false;
}

export async function generateDueTransactions(now = new Date()) {
  const due = await db.getDueRecurringTransactions(now);
  let createdCount = 0;

  for (const rule of due) {
    let nextRunDate = toDate(rule.nextRunDate);
    let lastRunDate = toDate(rule.lastRunDate);
    const endDate = toDate(rule.endDate);
    let generatedCount = Number(rule.generatedCount ?? 0);
    let isActive = Boolean(rule.isActive);

    if (!nextRunDate) {
      continue;
    }

    while (isActive && nextRunDate <= now) {
      await db.createTransaction({
        userId: rule.userId,
        categoryId: rule.categoryId,
        creditCardId: rule.creditCardId ?? undefined,
        type: rule.type,
        amount: String(rule.amount),
        description: rule.description ?? undefined,
        date: nextRunDate,
      });
      createdCount += 1;
      generatedCount += 1;
      lastRunDate = nextRunDate;
      nextRunDate = computeNextRunDate(
        nextRunDate,
        rule.frequency as Frequency,
        Number(rule.interval),
      );
      isActive = !shouldDeactivate(
        rule.endCondition as EndCondition,
        generatedCount,
        rule.occurrenceCount != null ? Number(rule.occurrenceCount) : null,
        nextRunDate,
        endDate,
      );
    }

    await db.advanceRecurringTransaction(rule.id, {
      nextRunDate,
      lastRunDate,
      generatedCount,
      isActive,
    });
  }

  return { processedRules: due.length, createdCount };
}

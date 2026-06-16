import type { FirstDayOfWeek } from "@/lib/first-day-of-week";

export function getMonthBoundaries(now: Date = new Date()): {
  monthStart: Date;
  monthEnd: Date;
} {
  const year = now.getFullYear();
  const month = now.getMonth();
  return {
    monthStart: new Date(year, month, 1),
    monthEnd: new Date(year, month + 1, 0, 23, 59, 59, 999),
  };
}

export function getWeekBoundaries(
  now: Date = new Date(),
  firstDayOfWeek: FirstDayOfWeek = 1,
): { weekStart: Date; weekEnd: Date } {
  const day = now.getDay();
  const diff = (day - firstDayOfWeek + 7) % 7;
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - diff);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return { weekStart, weekEnd };
}

export function computeBudgetPercent(
  spent: string,
  limit: string,
): number | null {
  const limitNum = parseFloat(limit);
  if (!Number.isFinite(limitNum) || limitNum === 0) {
    return null;
  }
  const spentNum = parseFloat(spent);
  if (!Number.isFinite(spentNum)) {
    return 0;
  }
  return Math.max(0, spentNum / limitNum);
}

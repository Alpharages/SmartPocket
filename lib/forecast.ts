export interface MonthEndExpenseForecast {
  projected: number;
  daysElapsed: number;
  daysInMonth: number;
}

export interface ProjectMonthEndExpenseInput {
  totalExpense: number;
  date: Date;
}

export interface MonthEndForecastState {
  visible: boolean;
  forecast: MonthEndExpenseForecast | null;
}

export interface ComputeMonthEndForecastStateInput {
  isCurrentMonth: boolean;
  totalExpense: number;
  /** Today's calendar date — not `currentDate` from month navigation (often the 1st). */
  anchorDate: Date;
}

/** Gate + compute forecast for the Insights screen. */
export function computeMonthEndForecastState({
  isCurrentMonth,
  totalExpense,
  anchorDate,
}: ComputeMonthEndForecastStateInput): MonthEndForecastState {
  if (!isCurrentMonth) {
    return { visible: false, forecast: null };
  }

  return {
    visible: true,
    forecast: projectMonthEndExpense({ totalExpense, date: anchorDate }),
  };
}

/**
 * Linear run-rate projection for month-end expenses.
 * Caller supplies `date` so the function stays pure and testable.
 */
export function projectMonthEndExpense({
  totalExpense,
  date,
}: ProjectMonthEndExpenseInput): MonthEndExpenseForecast {
  const year = date.getFullYear();
  const month = date.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysElapsed = Math.max(date.getDate(), 1);

  const safeTotal = Number.isFinite(totalExpense) ? totalExpense : 0;

  if (daysElapsed >= daysInMonth) {
    return { projected: safeTotal, daysElapsed, daysInMonth };
  }

  const projected = (safeTotal / daysElapsed) * daysInMonth;

  return {
    projected: Number.isFinite(projected) ? projected : 0,
    daysElapsed,
    daysInMonth,
  };
}

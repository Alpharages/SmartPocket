/** 0 = Sunday, 1 = Monday, 6 = Saturday */
export type FirstDayOfWeek = 0 | 1 | 6;

export const FIRST_DAY_OF_WEEK_STORAGE_KEY = "@smartpocket/first-day-of-week";

export const DEFAULT_FIRST_DAY_OF_WEEK: FirstDayOfWeek = 0;

export type FirstDayOfWeekOption = {
  value: FirstDayOfWeek;
  label: string;
};

export const FIRST_DAY_OF_WEEK_OPTIONS: readonly FirstDayOfWeekOption[] = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 6, label: "Saturday" },
] as const;

const SUPPORTED_VALUES = new Set<number>(
  FIRST_DAY_OF_WEEK_OPTIONS.map((o) => o.value),
);

export function isSupportedFirstDayOfWeek(
  value: number,
): value is FirstDayOfWeek {
  return SUPPORTED_VALUES.has(value);
}

export function getFirstDayOfWeekLabel(value: FirstDayOfWeek): string {
  return (
    FIRST_DAY_OF_WEEK_OPTIONS.find((o) => o.value === value)?.label ?? "Sunday"
  );
}

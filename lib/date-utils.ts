/**
 * Timezone-aware week boundary helpers using native Date (local calendar days).
 * No UTC conversion — operate on local Y/M/D with time zeroed.
 */

/** Returns the local calendar date of `date` as an ISO `YYYY-MM-DD` string. */
export function formatIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Returns local midnight at the start of the week containing `date`. */
export function getStartOfWeek(date: Date, firstDay: number): Date {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayOfWeek = local.getDay();
  const daysSinceStart = (dayOfWeek - firstDay + 7) % 7;
  local.setDate(local.getDate() - daysSinceStart);
  local.setHours(0, 0, 0, 0);
  return local;
}

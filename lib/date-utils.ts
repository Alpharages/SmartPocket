/**
 * Timezone-aware week boundary helpers using native Date (local calendar days).
 * No UTC conversion — operate on local Y/M/D with time zeroed.
 */

/** Returns local midnight at the start of the week containing `date`. */
export function getStartOfWeek(date: Date, firstDay: number): Date {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayOfWeek = local.getDay();
  const daysSinceStart = (dayOfWeek - firstDay + 7) % 7;
  local.setDate(local.getDate() - daysSinceStart);
  local.setHours(0, 0, 0, 0);
  return local;
}

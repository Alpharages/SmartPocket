export type RecurringFrequency = "daily" | "weekly" | "monthly" | "yearly";

export function formatRecurrenceFrequency(
  frequency: RecurringFrequency,
  interval: number,
): string {
  const unit =
    frequency === "daily"
      ? "day"
      : frequency === "weekly"
        ? "week"
        : frequency === "monthly"
          ? "month"
          : "year";

  if (interval === 1) {
    const labels: Record<RecurringFrequency, string> = {
      daily: "Daily",
      weekly: "Weekly",
      monthly: "Monthly",
      yearly: "Yearly",
    };
    return labels[frequency];
  }

  return `Every ${interval} ${unit}${interval === 1 ? "" : "s"}`;
}

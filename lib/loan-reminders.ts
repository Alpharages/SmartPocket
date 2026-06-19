import type { Loan } from "./expense-context";
import { isLoanOverdue } from "./loan-detail";
import { LOAN_REMINDER_DATA_TYPE } from "./notification-routing";
import {
  cancelScheduledNotification,
  scheduleLocalNotification,
} from "./notifications";

export { LOAN_REMINDER_DATA_TYPE };

export function loanDueReminderIdentifier(loanId: number): string {
  return `loan-due-${loanId}`;
}

export function loanOverdueReminderIdentifier(loanId: number): string {
  return `loan-overdue-${loanId}`;
}

export function buildLoanReminderNotificationData(loanId: number) {
  return {
    type: LOAN_REMINDER_DATA_TYPE,
    loanId,
    route: `/loan/${loanId}`,
  };
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDueDateLabel(dueDate: Date): string {
  return dueDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function buildDueReminderContent(
  dueDate: Date,
  now: Date = new Date(),
): { title: string; body: string } {
  const dueDay = startOfLocalDay(dueDate);
  const today = startOfLocalDay(now);

  if (dueDay.getTime() === today.getTime()) {
    return {
      title: "Loan repayment due",
      body: "You have a loan repayment due today.",
    };
  }

  return {
    title: "Loan repayment due",
    body: `You have a loan repayment due on ${formatDueDateLabel(dueDate)}.`,
  };
}

export function buildOverdueReminderContent(): { title: string; body: string } {
  return {
    title: "Loan repayment overdue",
    body: "A loan repayment is overdue. Open SmartPocket to review.",
  };
}

/** 9:00 local on the due date, or one minute from now when that time has passed. */
export function dueReminderTriggerAt(
  dueDate: Date,
  now: Date = new Date(),
): Date {
  const trigger = startOfLocalDay(dueDate);
  trigger.setHours(9, 0, 0, 0);
  if (trigger.getTime() <= now.getTime()) {
    return new Date(now.getTime() + 60_000);
  }
  return trigger;
}

/** Next local 9:00 while overdue — today if before 9am, otherwise tomorrow. */
export function overdueReminderTriggerAt(now: Date = new Date()): Date {
  const todayNine = startOfLocalDay(now);
  todayNine.setHours(9, 0, 0, 0);
  if (now.getTime() < todayNine.getTime()) {
    return todayNine;
  }
  const tomorrowNine = new Date(todayNine);
  tomorrowNine.setDate(tomorrowNine.getDate() + 1);
  return tomorrowNine;
}

/** @deprecated Use dueReminderTriggerAt */
export function reminderTriggerAt(
  dueDate: Date,
  now: Date = new Date(),
): Date {
  return dueReminderTriggerAt(dueDate, now);
}

export function shouldScheduleLoanReminder(loan: Loan): boolean {
  if (loan.status === "settled") {
    return false;
  }
  if (!loan.nextDueDate) {
    return false;
  }
  const due =
    loan.nextDueDate instanceof Date
      ? loan.nextDueDate
      : new Date(loan.nextDueDate);
  return !Number.isNaN(due.getTime());
}

export type LoanReminderScheduleResult =
  | "due"
  | "overdue"
  | "cleared"
  | "skipped";

export type LoanReminderDeps = {
  scheduleLocalNotification: typeof scheduleLocalNotification;
  cancelScheduledNotification: typeof cancelScheduledNotification;
};

const defaultDeps: LoanReminderDeps = {
  scheduleLocalNotification,
  cancelScheduledNotification,
};

let previouslySyncedLoanIds = new Set<number>();

/** Resets in-memory sync tracking — for tests only. */
export function resetLoanReminderSyncState(): void {
  previouslySyncedLoanIds = new Set();
}

export async function clearLoanReminders(
  loanId: number,
  deps: LoanReminderDeps = defaultDeps,
): Promise<void> {
  await deps.cancelScheduledNotification(loanDueReminderIdentifier(loanId));
  await deps.cancelScheduledNotification(loanOverdueReminderIdentifier(loanId));
}

export async function scheduleLoanReminder(
  loan: Loan,
  options: { remindersEnabled: boolean; now?: Date },
  deps: LoanReminderDeps = defaultDeps,
): Promise<{ scheduled: LoanReminderScheduleResult }> {
  if (!options.remindersEnabled) {
    return { scheduled: "skipped" };
  }

  if (!shouldScheduleLoanReminder(loan)) {
    await clearLoanReminders(loan.id, deps);
    return { scheduled: "cleared" };
  }

  const now = options.now ?? new Date();
  const due =
    loan.nextDueDate instanceof Date
      ? loan.nextDueDate
      : new Date(loan.nextDueDate!);
  const overdue = isLoanOverdue(loan.nextDueDate, loan.status);
  const data = buildLoanReminderNotificationData(loan.id);

  if (overdue) {
    await deps.cancelScheduledNotification(loanDueReminderIdentifier(loan.id));
    const triggerAt = overdueReminderTriggerAt(now);
    const content = buildOverdueReminderContent();
    await deps.scheduleLocalNotification({
      identifier: loanOverdueReminderIdentifier(loan.id),
      ...content,
      triggerAt,
      data,
    });
    return { scheduled: "overdue" };
  }

  await deps.cancelScheduledNotification(
    loanOverdueReminderIdentifier(loan.id),
  );
  const triggerAt = dueReminderTriggerAt(due, now);
  const content = buildDueReminderContent(due, now);
  await deps.scheduleLocalNotification({
    identifier: loanDueReminderIdentifier(loan.id),
    ...content,
    triggerAt,
    data,
  });
  return { scheduled: "due" };
}

export async function syncLoanReminderState(
  loans: Loan[],
  options: { remindersEnabled: boolean; now?: Date },
  deps: LoanReminderDeps = defaultDeps,
): Promise<void> {
  const currentIds = new Set(loans.map((loan) => loan.id));

  for (const id of previouslySyncedLoanIds) {
    if (!currentIds.has(id)) {
      await clearLoanReminders(id, deps);
    }
  }

  if (!options.remindersEnabled) {
    const toClear = new Set([...previouslySyncedLoanIds, ...currentIds]);
    await Promise.all([...toClear].map((id) => clearLoanReminders(id, deps)));
    previouslySyncedLoanIds = new Set();
    return;
  }

  await Promise.all(
    loans.map((loan) => scheduleLoanReminder(loan, options, deps)),
  );
  previouslySyncedLoanIds = currentIds;
}

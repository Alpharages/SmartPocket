import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-notifications", () => ({
  setNotificationHandler: vi.fn(),
  getPermissionsAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn(),
  cancelScheduledNotificationAsync: vi.fn(),
  SchedulableTriggerInputTypes: { DATE: "date" },
  IosAuthorizationStatus: {
    AUTHORIZED: 2,
    PROVISIONAL: 3,
    EPHEMERAL: 4,
    NOT_DETERMINED: 0,
  },
}));

vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

import type { Loan } from "@/lib/expense-context";
import {
  buildDueReminderContent,
  buildLoanReminderNotificationData,
  buildOverdueReminderContent,
  clearLoanReminders,
  dueReminderTriggerAt,
  loanDueReminderIdentifier,
  loanOverdueReminderIdentifier,
  overdueReminderTriggerAt,
  resetLoanReminderSyncState,
  scheduleLoanReminder,
  syncLoanReminderState,
} from "@/lib/loan-reminders";

const baseLoan: Loan = {
  id: 42,
  userId: 1,
  direction: "lend",
  counterparty: "Alex",
  principal: "500.00",
  rate: null,
  periodicity: "monthly",
  installmentCount: null,
  endDate: null,
  nextDueDate: new Date("2026-07-15T00:00:00.000Z"),
  status: "active",
  note: null,
  createdAt: new Date("2026-06-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-01T00:00:00.000Z"),
};

function createDeps() {
  return {
    scheduleLocalNotification: vi.fn().mockResolvedValue("scheduled-id"),
    cancelScheduledNotification: vi.fn().mockResolvedValue(undefined),
  };
}

describe("loan-reminders", () => {
  beforeEach(() => {
    resetLoanReminderSyncState();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses respectful copy without counterparty or amounts", () => {
    expect(buildDueReminderContent(new Date("2026-06-10")).body).not.toMatch(
      /Alex|500/,
    );
    expect(buildOverdueReminderContent().body).not.toMatch(/Alex|500/);
  });

  it("uses due-today copy only when the due date is today", () => {
    const now = new Date("2026-06-10T12:00:00");
    expect(buildDueReminderContent(new Date("2026-06-10"), now).body).toContain(
      "due today",
    );
    expect(buildDueReminderContent(new Date("2026-07-15"), now).body).toContain(
      "due on",
    );
  });

  it("schedules a due reminder for an active loan with a future due date", async () => {
    const deps = createDeps();
    const result = await scheduleLoanReminder(
      baseLoan,
      { remindersEnabled: true },
      deps,
    );

    expect(result.scheduled).toBe("due");
    expect(deps.cancelScheduledNotification).toHaveBeenCalledWith(
      loanOverdueReminderIdentifier(42),
    );
    expect(deps.scheduleLocalNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: loanDueReminderIdentifier(42),
        title: "Loan repayment due",
        body: expect.stringContaining("due on"),
        triggerAt: dueReminderTriggerAt(baseLoan.nextDueDate as Date),
        data: buildLoanReminderNotificationData(42),
      }),
    );
  });

  it("schedules an overdue reminder at the next local 9am boundary", async () => {
    vi.setSystemTime(new Date("2026-06-10T15:00:00"));
    const deps = createDeps();
    const overdueLoan: Loan = {
      ...baseLoan,
      nextDueDate: new Date("2026-06-01T00:00:00.000Z"),
    };

    const result = await scheduleLoanReminder(
      overdueLoan,
      { remindersEnabled: true },
      deps,
    );

    expect(result.scheduled).toBe("overdue");
    expect(deps.cancelScheduledNotification).toHaveBeenCalledWith(
      loanDueReminderIdentifier(42),
    );
    expect(deps.scheduleLocalNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: loanOverdueReminderIdentifier(42),
        title: "Loan repayment overdue",
        triggerAt: overdueReminderTriggerAt(new Date("2026-06-10T15:00:00")),
      }),
    );
    const trigger = deps.scheduleLocalNotification.mock.calls[0][0].triggerAt;
    expect(trigger.getHours()).toBe(9);
    expect(trigger.getDate()).toBe(11);
  });

  it("clears reminders for settled loans", async () => {
    const deps = createDeps();
    const settledLoan: Loan = { ...baseLoan, status: "settled" };

    const result = await scheduleLoanReminder(
      settledLoan,
      { remindersEnabled: true },
      deps,
    );

    expect(result.scheduled).toBe("cleared");
    expect(deps.scheduleLocalNotification).not.toHaveBeenCalled();
    expect(deps.cancelScheduledNotification).toHaveBeenCalledWith(
      loanDueReminderIdentifier(42),
    );
    expect(deps.cancelScheduledNotification).toHaveBeenCalledWith(
      loanOverdueReminderIdentifier(42),
    );
  });

  it("skips scheduling when reminders are disabled", async () => {
    const deps = createDeps();

    const result = await scheduleLoanReminder(
      baseLoan,
      { remindersEnabled: false },
      deps,
    );

    expect(result.scheduled).toBe("skipped");
    expect(deps.scheduleLocalNotification).not.toHaveBeenCalled();
    expect(deps.cancelScheduledNotification).not.toHaveBeenCalled();
  });

  it("overdue sync keeps a once-per-day trigger across repeated syncs", async () => {
    vi.setSystemTime(new Date("2026-06-10T15:00:00"));
    const deps = createDeps();
    const overdueLoan: Loan = {
      ...baseLoan,
      nextDueDate: new Date("2026-06-01T00:00:00.000Z"),
    };

    await scheduleLoanReminder(overdueLoan, { remindersEnabled: true }, deps);
    const firstTrigger = deps.scheduleLocalNotification.mock.calls[0][0].triggerAt;
    deps.scheduleLocalNotification.mockClear();

    await scheduleLoanReminder(overdueLoan, { remindersEnabled: true }, deps);
    const secondTrigger = deps.scheduleLocalNotification.mock.calls[0][0].triggerAt;

    expect(firstTrigger.getTime()).toBe(secondTrigger.getTime());
  });

  it("syncLoanReminderState clears all loans when reminders are disabled", async () => {
    const deps = createDeps();
    await syncLoanReminderState([baseLoan, { ...baseLoan, id: 99 }], {
      remindersEnabled: false,
    }, deps);

    expect(deps.scheduleLocalNotification).not.toHaveBeenCalled();
    expect(deps.cancelScheduledNotification).toHaveBeenCalledWith(
      loanDueReminderIdentifier(42),
    );
    expect(deps.cancelScheduledNotification).toHaveBeenCalledWith(
      loanOverdueReminderIdentifier(99),
    );
  });

  it("clears reminders for loans removed from the synced list", async () => {
    const deps = createDeps();
    await syncLoanReminderState(
      [baseLoan, { ...baseLoan, id: 99 }],
      { remindersEnabled: true },
      deps,
    );
    vi.clearAllMocks();

    await syncLoanReminderState([baseLoan], { remindersEnabled: true }, deps);

    expect(deps.cancelScheduledNotification).toHaveBeenCalledWith(
      loanDueReminderIdentifier(99),
    );
    expect(deps.cancelScheduledNotification).toHaveBeenCalledWith(
      loanOverdueReminderIdentifier(99),
    );
  });

  it("clears previously tracked loans when the list becomes empty", async () => {
    const deps = createDeps();
    await syncLoanReminderState([baseLoan], { remindersEnabled: true }, deps);
    vi.clearAllMocks();

    await syncLoanReminderState([], { remindersEnabled: true }, deps);

    expect(deps.cancelScheduledNotification).toHaveBeenCalledWith(
      loanDueReminderIdentifier(42),
    );
    expect(deps.cancelScheduledNotification).toHaveBeenCalledWith(
      loanOverdueReminderIdentifier(42),
    );
  });

  it("returns null scheduling gracefully when permission is denied", async () => {
    const deps = createDeps();
    deps.scheduleLocalNotification.mockResolvedValue(null);

    await expect(
      scheduleLoanReminder(baseLoan, { remindersEnabled: true }, deps),
    ).resolves.toEqual({ scheduled: "due" });
  });

  it("schedules soon when due date is today after 9am local", () => {
    vi.setSystemTime(new Date("2026-06-15T15:00:00"));
    const dueToday = new Date("2026-06-15T00:00:00");
    const trigger = dueReminderTriggerAt(dueToday);
    expect(trigger.getTime()).toBe(new Date("2026-06-15T15:01:00").getTime());
  });
});

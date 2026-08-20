/**
 * QA report SP-003 regression guard.
 *
 * `refreshMonthlyStats(year, month)` used to accept both arguments and ignore
 * them, calling `.refetch()` on a query whose key was frozen to the current
 * month. Navigating to any other month on Insights therefore re-displayed the
 * *current* month's totals next to the *selected* month's category breakdown.
 *
 * These tests assert the period actually reaches the server call.
 */
import React from "react";
import { act, create } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const monthlyStatsFetch = vi
    .fn()
    .mockResolvedValue({ totalIncome: 0, totalExpense: 0, netBalance: 0 });
  const emptyRefetch = vi.fn().mockResolvedValue({ data: [] });
  return { monthlyStatsFetch, emptyRefetch };
});

vi.mock("@/lib/trpc", () => {
  const query = () => ({ refetch: mocks.emptyRefetch, data: [] });
  const mutation = () => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
  });
  const slice = {
    list: { useQuery: query },
    create: { useMutation: mutation },
    update: { useMutation: mutation },
    delete: { useMutation: mutation },
  };
  return {
    trpc: {
      categories: slice,
      creditCards: slice,
      accounts: {
        ...slice,
        balances: { useQuery: query },
        transfers: { useQuery: query },
        transfer: { useMutation: mutation },
        reassignAndDelete: { useMutation: mutation },
      },
      transactions: { ...slice, createMany: { useMutation: mutation } },
      recurringTransactions: slice,
      budgets: { ...slice, progress: { useQuery: query } },
      loans: {
        ...slice,
        recordRepayment: { useMutation: mutation },
      },
      settings: { get: { useQuery: () => ({ data: null, isSuccess: false }) } },
      data: { clearAll: { useMutation: mutation } },
      summary: {
        monthlyStats: { useQuery: () => ({ refetch: vi.fn(), data: null }) },
      },
      useUtils: () => ({
        summary: { monthlyStats: { fetch: mocks.monthlyStatsFetch } },
        accounts: {
          transactionCount: { fetch: vi.fn().mockResolvedValue(0) },
          transferCount: { fetch: vi.fn().mockResolvedValue(0) },
        },
      }),
    },
  };
});

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ show: vi.fn() }),
}));

vi.mock("@/lib/first-day-of-week-provider", () => ({
  useFirstDayOfWeek: () => ({ firstDayOfWeek: 0 }),
}));

vi.mock("@/lib/loan-reminders", () => ({
  syncLoanReminderState: vi.fn().mockResolvedValue(undefined),
}));

const { ExpenseProvider, useExpense } = await import("@/lib/expense-context");

let api: ReturnType<typeof useExpense>;

function Probe() {
  api = useExpense();
  return null;
}

async function mount() {
  await act(async () => {
    create(
      <ExpenseProvider>
        <Probe />
      </ExpenseProvider>,
    );
  });
}

describe("refreshMonthlyStats honours the requested period (SP-003)", () => {
  beforeEach(() => {
    mocks.monthlyStatsFetch.mockClear();
  });

  it("fetches the exact year and month it is given", async () => {
    await mount();
    mocks.monthlyStatsFetch.mockClear();

    await act(async () => {
      await api.refreshMonthlyStats(2025, 3);
    });

    expect(mocks.monthlyStatsFetch).toHaveBeenCalledWith({
      year: 2025,
      month: 3,
    });
  });

  it("does not silently substitute the current month", async () => {
    await mount();
    mocks.monthlyStatsFetch.mockClear();

    const now = new Date();
    await act(async () => {
      await api.refreshMonthlyStats(2024, 11);
    });

    const [arg] = mocks.monthlyStatsFetch.mock.calls.at(-1) ?? [];
    expect(arg).toEqual({ year: 2024, month: 11 });
    // The whole point of the bug: it used to come back as "now".
    expect(arg).not.toEqual({
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    });
  });

  it("re-fetches the displayed period when called with no arguments", async () => {
    await mount();

    await act(async () => {
      await api.refreshMonthlyStats(2023, 7);
    });
    mocks.monthlyStatsFetch.mockClear();

    // A mutation refreshing stats must not snap the view back to today.
    await act(async () => {
      await api.refreshMonthlyStats();
    });

    expect(mocks.monthlyStatsFetch).toHaveBeenCalledWith({
      year: 2023,
      month: 7,
    });
  });
});

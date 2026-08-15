import React, { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TestRenderer, { act, type ReactTestRenderer } from "react-test-renderer";

const mocks = vi.hoisted(() => {
  const syncLoanReminderState = vi.fn().mockResolvedValue(undefined);
  const refetch = vi.fn().mockResolvedValue({ data: [] });
  const settingsData = { aiEnabled: false, remindersEnabled: true };
  const sampleLoan = {
    id: "00000000000000000000000005",
    userId: "00000000000000000000000001",
    direction: "borrow" as const,
    counterparty: null,
    principal: "100.00",
    rate: null,
    periodicity: "none" as const,
    installmentCount: null,
    endDate: null,
    nextDueDate: new Date("2026-07-01T00:00:00.000Z"),
    status: "active" as const,
    note: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const useQuery = () => ({ refetch, data: [] });
  const useMutation = () => ({ mutateAsync: vi.fn() });

  return {
    syncLoanReminderState,
    refetch,
    settingsData,
    sampleLoan,
    useQuery,
    useMutation,
  };
});

vi.mock("@/lib/loan-reminders", () => ({
  syncLoanReminderState: mocks.syncLoanReminderState,
}));

vi.mock("@/lib/first-day-of-week-provider", () => ({
  useFirstDayOfWeek: () => ({
    firstDayOfWeek: 0,
    setFirstDayOfWeek: vi.fn(),
    isReady: true,
  }),
}));

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ show: vi.fn() }),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    categories: {
      list: { useQuery: mocks.useQuery },
      create: { useMutation: mocks.useMutation },
      update: { useMutation: mocks.useMutation },
      delete: { useMutation: mocks.useMutation },
    },
    creditCards: {
      list: { useQuery: mocks.useQuery },
      create: { useMutation: mocks.useMutation },
      update: { useMutation: mocks.useMutation },
      delete: { useMutation: mocks.useMutation },
    },
    transactions: {
      list: { useQuery: mocks.useQuery },
      create: { useMutation: mocks.useMutation },
      createMany: { useMutation: mocks.useMutation },
      update: { useMutation: mocks.useMutation },
      delete: { useMutation: mocks.useMutation },
    },
    budgets: {
      list: { useQuery: mocks.useQuery },
      create: { useMutation: mocks.useMutation },
      update: { useMutation: mocks.useMutation },
      delete: { useMutation: mocks.useMutation },
      progress: {
        useQuery: () => ({
          refetch: mocks.refetch,
          data: [],
          isLoading: false,
        }),
      },
    },
    recurringTransactions: {
      list: { useQuery: mocks.useQuery },
      create: { useMutation: mocks.useMutation },
      update: { useMutation: mocks.useMutation },
    },
    loans: {
      list: {
        useQuery: () => ({
          refetch: vi.fn().mockResolvedValue({ data: [mocks.sampleLoan] }),
          data: [mocks.sampleLoan],
        }),
      },
      create: { useMutation: mocks.useMutation },
      recordRepayment: { useMutation: mocks.useMutation },
      // SP-018: loans can now be edited and deleted from the UI.
      update: { useMutation: mocks.useMutation },
      delete: { useMutation: mocks.useMutation },
    },
    summary: {
      monthlyStats: {
        useQuery: () => ({
          refetch: vi.fn().mockResolvedValue({
            data: { totalIncome: 0, totalExpense: 0, netBalance: 0 },
          }),
          data: null,
        }),
      },
    },
    settings: {
      get: {
        useQuery: () => ({
          data: mocks.settingsData,
          isSuccess: true,
        }),
      },
    },
    data: {
      clearAll: { useMutation: mocks.useMutation },
    },
    useUtils: () => ({
      summary: {
        monthlyStats: {
          fetch: vi.fn().mockResolvedValue({
            totalIncome: 0,
            totalExpense: 0,
            netBalance: 0,
          }),
        },
      },
      accounts: {
        transactionCount: {
          fetch: vi.fn().mockResolvedValue(0),
        },
        transferCount: {
          fetch: vi.fn().mockResolvedValue(0),
        },
      },
    }),
    accounts: {
      list: { useQuery: mocks.useQuery },
      create: { useMutation: mocks.useMutation },
      update: { useMutation: mocks.useMutation },
      delete: { useMutation: mocks.useMutation },
      reassignAndDelete: { useMutation: mocks.useMutation },
      balances: { useQuery: mocks.useQuery },
      transfers: { useQuery: mocks.useQuery },
      transfer: { useMutation: mocks.useMutation },
      transactionCount: { useQuery: mocks.useQuery },
      transferCount: { useQuery: mocks.useQuery },
    },
  },
}));

import { ExpenseProvider, useExpense } from "@/lib/expense-context";
import { testId, syncColumns } from "../helpers/ids";

function SyncProbe({
  onLoansLoaded,
}: {
  onLoansLoaded: (count: number) => void;
}) {
  const { loans } = useExpense();

  useEffect(() => {
    onLoansLoaded(loans.length);
  }, [loans.length, onLoansLoaded]);

  return null;
}

describe("loan reminder sync in ExpenseProvider", () => {
  afterEach(() => {
    vi.clearAllMocks();
    mocks.settingsData.remindersEnabled = true;
  });

  it("syncs loan reminders after loans load and settings are ready", async () => {
    let renderer: ReactTestRenderer | undefined;
    let loadedCount = 0;

    await act(async () => {
      renderer = TestRenderer.create(
        <ExpenseProvider>
          <SyncProbe
            onLoansLoaded={(count) => {
              loadedCount = count;
            }}
          />
        </ExpenseProvider>,
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(loadedCount).toBe(1);
    expect(mocks.syncLoanReminderState).toHaveBeenCalled();
    const [loans, options] = mocks.syncLoanReminderState.mock.calls.at(-1)!;
    expect(loans).toHaveLength(1);
    expect(options).toEqual({ remindersEnabled: true });

    renderer?.unmount();
  });

  it("clears reminders when notification preference is disabled", async () => {
    mocks.settingsData.remindersEnabled = false;
    let renderer: ReactTestRenderer | undefined;

    await act(async () => {
      renderer = TestRenderer.create(
        <ExpenseProvider>
          <SyncProbe onLoansLoaded={() => {}} />
        </ExpenseProvider>,
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mocks.syncLoanReminderState).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ remindersEnabled: false }),
    );

    renderer?.unmount();
  });
});

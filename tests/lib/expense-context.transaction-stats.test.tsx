import React, { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TestRenderer, { act, type ReactTestRenderer } from "react-test-renderer";
import type { CreateTransactionInput } from "@/lib/expense-context";

const mocks = vi.hoisted(() => {
  const createTransactionMutateAsync = vi.fn().mockResolvedValue(undefined);
  const updateTransactionMutateAsync = vi.fn().mockResolvedValue(undefined);
  const deleteTransactionMutateAsync = vi.fn().mockResolvedValue(undefined);
  const categoriesRefetch = vi.fn().mockResolvedValue({ data: [] });
  const creditCardsRefetch = vi.fn().mockResolvedValue({ data: [] });
  const transactionsRefetch = vi.fn().mockResolvedValue({ data: [] });
  // Resolves the payload directly: this now stands in for
  // `utils.summary.monthlyStats.fetch()`, not a query `.refetch()` (SP-003).
  const monthlyStatsRefetch = vi
    .fn()
    .mockResolvedValue({ totalIncome: 0, totalExpense: 0, netBalance: 0 });
  const budgetsRefetch = vi.fn().mockResolvedValue({ data: [] });
  const budgetProgressRefetch = vi.fn().mockResolvedValue({ data: [] });
  const loansRefetch = vi.fn().mockResolvedValue({ data: [] });
  const accountsRefetch = vi.fn().mockResolvedValue({ data: [] });
  const accountBalancesRefetch = vi.fn().mockResolvedValue({ data: [] });
  const transfersRefetch = vi.fn().mockResolvedValue({ data: [] });
  const recurringTransactionsRefetch = vi.fn().mockResolvedValue({ data: [] });
  const toastShow = vi.fn();

  const useQuery = () => ({
    refetch: categoriesRefetch,
    data: [],
  });

  const useMutation = () => ({
    mutateAsync: vi.fn(),
  });

  return {
    createTransactionMutateAsync,
    updateTransactionMutateAsync,
    deleteTransactionMutateAsync,
    categoriesRefetch,
    creditCardsRefetch,
    transactionsRefetch,
    monthlyStatsRefetch,
    budgetsRefetch,
    budgetProgressRefetch,
    loansRefetch,
    accountsRefetch,
    accountBalancesRefetch,
    transfersRefetch,
    recurringTransactionsRefetch,
    toastShow,
    useQuery,
    useMutation,
  };
});

vi.mock("@/lib/first-day-of-week-provider", () => ({
  useFirstDayOfWeek: () => ({
    firstDayOfWeek: 0,
    setFirstDayOfWeek: vi.fn(),
    isReady: true,
  }),
}));

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ show: mocks.toastShow }),
}));

vi.mock("@/lib/loan-reminders", () => ({
  syncLoanReminderState: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      summary: {
        // SP-003: monthly stats are fetched for an explicit period via utils,
        // not refetched from a query whose key is frozen to the current month.
        monthlyStats: { fetch: mocks.monthlyStatsRefetch },
      },
      accounts: {
        transactionCount: { fetch: vi.fn().mockResolvedValue(0) },
        transferCount: { fetch: vi.fn().mockResolvedValue(0) },
      },
    }),
    categories: {
      list: { useQuery: () => ({ refetch: mocks.categoriesRefetch, data: [] }) },
      create: { useMutation: mocks.useMutation },
      update: { useMutation: mocks.useMutation },
      delete: { useMutation: mocks.useMutation },
    },
    creditCards: {
      list: { useQuery: () => ({ refetch: mocks.creditCardsRefetch, data: [] }) },
      create: { useMutation: mocks.useMutation },
      update: { useMutation: mocks.useMutation },
      delete: { useMutation: mocks.useMutation },
    },
    transactions: {
      list: { useQuery: () => ({ refetch: mocks.transactionsRefetch, data: [] }) },
      create: {
        useMutation: () => ({ mutateAsync: mocks.createTransactionMutateAsync }),
      },
      createMany: { useMutation: mocks.useMutation },
      update: {
        useMutation: () => ({ mutateAsync: mocks.updateTransactionMutateAsync }),
      },
      delete: {
        useMutation: () => ({ mutateAsync: mocks.deleteTransactionMutateAsync }),
      },
    },
    data: {
      clearAll: { useMutation: mocks.useMutation },
    },
    summary: {
      monthlyStats: {
        useQuery: () => ({ refetch: vi.fn(), data: null }),
      },
    },
    budgets: {
      list: { useQuery: () => ({ refetch: mocks.budgetsRefetch, data: [] }) },
      create: { useMutation: mocks.useMutation },
      update: { useMutation: mocks.useMutation },
      delete: { useMutation: mocks.useMutation },
      progress: {
        useQuery: () => ({
          refetch: mocks.budgetProgressRefetch,
          data: [],
          isLoading: false,
        }),
      },
    },
    loans: {
      list: { useQuery: () => ({ refetch: mocks.loansRefetch, data: [] }) },
      create: { useMutation: mocks.useMutation },
      recordRepayment: { useMutation: mocks.useMutation },
    },
    accounts: {
      list: { useQuery: () => ({ refetch: mocks.accountsRefetch, data: [] }) },
      create: { useMutation: mocks.useMutation },
      update: { useMutation: mocks.useMutation },
      delete: { useMutation: mocks.useMutation },
      reassignAndDelete: { useMutation: mocks.useMutation },
      balances: {
        useQuery: () => ({ refetch: mocks.accountBalancesRefetch, data: [] }),
      },
      transfers: {
        useQuery: () => ({ refetch: mocks.transfersRefetch, data: [] }),
      },
      transfer: { useMutation: mocks.useMutation },
      transactionCount: { useQuery: mocks.useQuery },
      transferCount: { useQuery: mocks.useQuery },
    },
    recurringTransactions: {
      list: {
        useQuery: () => ({ refetch: mocks.recurringTransactionsRefetch, data: [] }),
      },
      create: { useMutation: mocks.useMutation },
      update: { useMutation: mocks.useMutation },
    },
    settings: {
      get: {
        useQuery: () => ({
          data: { aiEnabled: false, remindersEnabled: false },
          isSuccess: true,
        }),
      },
    },
  },
}));

import { ExpenseProvider, useExpense } from "@/lib/expense-context";

interface Handlers {
  addTransaction: (data: CreateTransactionInput) => Promise<void>;
  updateTransaction: (
    id: number,
    data: Partial<CreateTransactionInput>,
  ) => Promise<void>;
  deleteTransaction: (id: number) => Promise<void>;
}

function TransactionHarness({
  onReady,
}: {
  onReady: (handlers: Handlers) => void;
}) {
  const { addTransaction, updateTransaction, deleteTransaction } = useExpense();
  useEffect(() => {
    onReady({ addTransaction, updateTransaction, deleteTransaction });
  }, [addTransaction, updateTransaction, deleteTransaction, onReady]);
  return null;
}

let renderer: ReactTestRenderer | null = null;

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = null;
  vi.clearAllMocks();
});

async function render(): Promise<Handlers> {
  const handlers = await new Promise<Handlers>((resolve) => {
    act(() => {
      renderer = TestRenderer.create(
        <ExpenseProvider>
          <TransactionHarness onReady={resolve} />
        </ExpenseProvider>,
      );
    });
  });
  // Mount-time refreshAll already called monthlyStatsRefetch once; reset so
  // assertions below only see the mutation-triggered call.
  mocks.monthlyStatsRefetch.mockClear();
  return handlers;
}

const sampleInput: CreateTransactionInput = {
  categoryId: 1,
  type: "income",
  amount: "250.00",
  date: new Date("2026-07-01"),
};

describe("ExpenseProvider monthlyStats refresh on transaction mutations", () => {
  it("refreshes monthlyStats after addTransaction", async () => {
    const { addTransaction } = await render();

    await act(async () => {
      await addTransaction(sampleInput);
    });

    expect(mocks.monthlyStatsRefetch).toHaveBeenCalled();
  });

  it("refreshes monthlyStats after updateTransaction", async () => {
    const { updateTransaction } = await render();

    await act(async () => {
      await updateTransaction(1, { amount: "300.00" });
    });

    expect(mocks.monthlyStatsRefetch).toHaveBeenCalled();
  });

  it("refreshes monthlyStats after deleteTransaction", async () => {
    const { deleteTransaction } = await render();

    await act(async () => {
      await deleteTransaction(1);
    });

    expect(mocks.monthlyStatsRefetch).toHaveBeenCalled();
  });
});

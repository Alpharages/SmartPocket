import React, { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TestRenderer, { act } from "react-test-renderer";

const mocks = vi.hoisted(() => {
  const accountsRefetch = vi.fn().mockResolvedValue({
    data: [
      {
        id: 1,
        userId: 1,
        name: "Cash",
        type: "cash",
        currency: "USD",
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  });
  const accountBalancesRefetch = vi.fn().mockResolvedValue({ data: [] });
  const transfersRefetch = vi.fn().mockResolvedValue({ data: [] });
  const createTransferMutateAsync = vi.fn().mockResolvedValue(undefined);
  const createAccountMutateAsync = vi.fn().mockResolvedValue({
    id: 2,
    userId: 1,
    name: "Bank",
    type: "bank",
    currency: "USD",
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const updateAccountMutateAsync = vi.fn().mockResolvedValue(undefined);
  const deleteAccountMutateAsync = vi.fn().mockResolvedValue(undefined);
  const reassignAndDeleteMutateAsync = vi.fn().mockResolvedValue(undefined);
  const transactionCountFetch = vi.fn().mockResolvedValue(0);
  const transferCountFetch = vi.fn().mockResolvedValue(0);
  const toastShow = vi.fn();

  const useQuery = () => ({
    refetch: accountsRefetch,
    data: [],
  });

  const useMutation = () => ({
    mutateAsync: vi.fn(),
  });

  return {
    accountsRefetch,
    accountBalancesRefetch,
    transfersRefetch,
    createTransferMutateAsync,
    createAccountMutateAsync,
    updateAccountMutateAsync,
    deleteAccountMutateAsync,
    reassignAndDeleteMutateAsync,
    transactionCountFetch,
    transferCountFetch,
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
      accounts: {
        transactionCount: {
          fetch: mocks.transactionCountFetch,
        },
        transferCount: {
          fetch: mocks.transferCountFetch,
        },
      },
    }),
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
    accounts: {
      list: { useQuery: mocks.useQuery },
      create: {
        useMutation: () => ({ mutateAsync: mocks.createAccountMutateAsync }),
      },
      update: {
        useMutation: () => ({ mutateAsync: mocks.updateAccountMutateAsync }),
      },
      delete: {
        useMutation: () => ({ mutateAsync: mocks.deleteAccountMutateAsync }),
      },
      reassignAndDelete: {
        useMutation: () => ({ mutateAsync: mocks.reassignAndDeleteMutateAsync }),
      },
      balances: {
        useQuery: () => ({ refetch: mocks.accountBalancesRefetch, data: [] }),
      },
      transfers: {
        useQuery: () => ({ refetch: mocks.transfersRefetch, data: [] }),
      },
      transfer: {
        useMutation: () => ({ mutateAsync: mocks.createTransferMutateAsync }),
      },
      transactionCount: { useQuery: mocks.useQuery },
      transferCount: { useQuery: mocks.useQuery },
    },
    transactions: {
      list: { useQuery: mocks.useQuery },
      create: { useMutation: mocks.useMutation },
      update: { useMutation: mocks.useMutation },
      delete: { useMutation: mocks.useMutation },
    },
    data: {
      clearAll: {
        useMutation: () => ({ mutateAsync: vi.fn().mockResolvedValue(undefined) }),
      },
    },
    summary: {
      monthlyStats: {
        useQuery: () => ({ refetch: vi.fn().mockResolvedValue({ data: null }), data: null }),
      },
    },
    budgets: {
      list: { useQuery: mocks.useQuery },
      create: { useMutation: mocks.useMutation },
      update: { useMutation: mocks.useMutation },
      delete: { useMutation: mocks.useMutation },
      progress: {
        useQuery: () => ({
          refetch: vi.fn().mockResolvedValue({ data: [] }),
          data: [],
          isLoading: false,
        }),
      },
    },
    recurringTransactions: {
      list: { useQuery: mocks.useQuery },
      create: { useMutation: mocks.useMutation },
      update: { useMutation: mocks.useMutation },
      cancel: { useMutation: mocks.useMutation },
    },
    loans: {
      list: { useQuery: mocks.useQuery },
      create: { useMutation: mocks.useMutation },
      recordRepayment: { useMutation: mocks.useMutation },
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

function Probe({
  onReady,
}: {
  onReady: (api: ReturnType<typeof useExpense>) => void;
}) {
  const api = useExpense();
  useEffect(() => {
    onReady(api);
  }, [api, onReady]);
  return null;
}

describe("expense context accounts", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("optimistically adds an account and rolls back on failure", async () => {
    mocks.createAccountMutateAsync.mockRejectedValueOnce(new Error("fail"));
    let api: ReturnType<typeof useExpense> | null = null;

    await act(async () => {
      TestRenderer.create(
        <ExpenseProvider>
          <Probe onReady={(value) => (api = value)} />
        </ExpenseProvider>,
      );
    });

    await act(async () => {
      await expect(
        api!.addAccount({ name: "Savings", type: "bank", currency: "USD" }),
      ).rejects.toThrow("addAccount failed");
    });

    expect(mocks.toastShow).toHaveBeenCalledWith({
      type: "error",
      message: "Failed to add account",
    });
    expect(api).not.toBeNull();
  });

  it("reassigns and deletes with rollback on failure", async () => {
    mocks.reassignAndDeleteMutateAsync.mockRejectedValueOnce(new Error("fail"));
    let api: ReturnType<typeof useExpense> | null = null;

    await act(async () => {
      TestRenderer.create(
        <ExpenseProvider>
          <Probe onReady={(value) => (api = value)} />
        </ExpenseProvider>,
      );
    });

    await act(async () => {
      await expect(api!.reassignAndDeleteAccount(1, 2)).rejects.toThrow(
        "reassignAndDeleteAccount failed",
      );
    });

    expect(mocks.toastShow).toHaveBeenCalledWith({
      type: "error",
      message: "Failed to reassign and delete account",
    });
  });

  it("updates an account and shows success toast", async () => {
    let api: ReturnType<typeof useExpense> | null = null;

    await act(async () => {
      TestRenderer.create(
        <ExpenseProvider>
          <Probe onReady={(value) => (api = value)} />
        </ExpenseProvider>,
      );
    });

    await act(async () => {
      await api!.updateAccount(1, { name: "Updated Cash" });
    });

    expect(mocks.updateAccountMutateAsync).toHaveBeenCalledWith({
      id: 1,
      name: "Updated Cash",
    });
    expect(mocks.toastShow).toHaveBeenCalledWith({
      type: "success",
      message: "Account updated",
    });
  });

  it("deletes an account and shows success toast", async () => {
    let api: ReturnType<typeof useExpense> | null = null;

    await act(async () => {
      TestRenderer.create(
        <ExpenseProvider>
          <Probe onReady={(value) => (api = value)} />
        </ExpenseProvider>,
      );
    });

    await act(async () => {
      await api!.deleteAccount(1);
    });

    expect(mocks.deleteAccountMutateAsync).toHaveBeenCalledWith({ id: 1 });
    expect(mocks.toastShow).toHaveBeenCalledWith({
      type: "success",
      message: "Account deleted",
    });
  });
});

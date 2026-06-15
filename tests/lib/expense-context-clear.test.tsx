import React, { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TestRenderer, { act, type ReactTestRenderer } from "react-test-renderer";

const mocks = vi.hoisted(() => {
  const clearAllMutateAsync = vi.fn().mockResolvedValue(undefined);
  const categoriesRefetch = vi.fn().mockResolvedValue({ data: [] });
  const creditCardsRefetch = vi.fn().mockResolvedValue({ data: [] });
  const transactionsRefetch = vi.fn().mockResolvedValue({ data: [] });
  const monthlyStatsRefetch = vi.fn().mockResolvedValue({
    data: { totalIncome: 0, totalExpense: 0, netBalance: 0 },
  });
  const toastShow = vi.fn();

  const useQuery = () => ({
    refetch: categoriesRefetch,
    data: [],
  });

  const useMutation = () => ({
    mutateAsync: vi.fn(),
  });

  return {
    clearAllMutateAsync,
    categoriesRefetch,
    creditCardsRefetch,
    transactionsRefetch,
    monthlyStatsRefetch,
    toastShow,
    useQuery,
    useMutation,
  };
});

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ show: mocks.toastShow }),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
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
      create: { useMutation: mocks.useMutation },
      update: { useMutation: mocks.useMutation },
      delete: { useMutation: mocks.useMutation },
    },
    data: {
      clearAll: {
        useMutation: () => ({ mutateAsync: mocks.clearAllMutateAsync }),
      },
    },
    summary: {
      monthlyStats: {
        useQuery: () => ({ refetch: mocks.monthlyStatsRefetch, data: null }),
      },
    },
  },
}));

import { ExpenseProvider, useExpense } from "@/lib/expense-context";

function ClearAllHarness({ onReady }: { onReady: (clear: () => Promise<void>) => void }) {
  const { clearAllData } = useExpense();
  useEffect(() => {
    onReady(clearAllData);
  }, [clearAllData, onReady]);
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

describe("ExpenseProvider clearAllData", () => {
  it("refreshes categories, cards, transactions, and monthly stats after success", async () => {
    let clearAllData: (() => Promise<void>) | null = null;

    act(() => {
      renderer = TestRenderer.create(
        <ExpenseProvider>
          <ClearAllHarness
            onReady={(clear) => {
              clearAllData = clear;
            }}
          />
        </ExpenseProvider>,
      );
    });

    await act(async () => {
      await clearAllData!();
    });

    expect(mocks.clearAllMutateAsync).toHaveBeenCalledTimes(1);
    expect(mocks.categoriesRefetch).toHaveBeenCalled();
    expect(mocks.creditCardsRefetch).toHaveBeenCalled();
    expect(mocks.transactionsRefetch).toHaveBeenCalled();
    expect(mocks.monthlyStatsRefetch).toHaveBeenCalled();
    expect(mocks.toastShow).toHaveBeenCalledWith({
      type: "success",
      message: "All data cleared",
    });
  });

  it("shows error toast and does not refresh slices when mutation fails", async () => {
    mocks.clearAllMutateAsync.mockRejectedValueOnce(new Error("network"));
    let clearAllData: (() => Promise<void>) | null = null;

    act(() => {
      renderer = TestRenderer.create(
        <ExpenseProvider>
          <ClearAllHarness
            onReady={(clear) => {
              clearAllData = clear;
            }}
          />
        </ExpenseProvider>,
      );
    });

    const refetchCallsBefore = mocks.categoriesRefetch.mock.calls.length;

    await act(async () => {
      await expect(clearAllData!()).rejects.toThrow("clearAllData failed");
    });

    expect(mocks.toastShow).toHaveBeenCalledWith({
      type: "error",
      message: "Failed to clear data",
    });
    expect(mocks.monthlyStatsRefetch.mock.calls.length).toBe(refetchCallsBefore);
  });
});

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { trpc } from "./trpc";
import { useToast } from "@/components/ui/ToastProvider";
import { applyOptimistic, snapshotList } from "./optimistic";

export interface Category {
  id: number;
  userId: number;
  name: string;
  type: "income" | "expense";
  color: string;
  icon: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreditCard {
  id: number;
  userId: number;
  name: string;
  cardNumberLast4: string;
  cardholderName: string;
  expiryMonth: number;
  expiryYear: number;
  creditLimit: string;
  currentBalance: string;
  color: string;
  cardType: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateCreditCardInput = Omit<
  CreditCard,
  "id" | "userId" | "createdAt" | "updatedAt" | "cardNumberLast4"
> & { cardNumber: string };

export interface Transaction {
  id: number;
  userId: number;
  categoryId: number;
  creditCardId?: number;
  type: "income" | "expense";
  amount: string;
  description?: string;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface MonthlyStats {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
}

interface ExpenseContextType {
  // Categories
  categories: Category[];
  loadingCategories: boolean;
  refreshCategories: () => Promise<void>;
  addCategory: (data: Omit<Category, "id" | "userId" | "createdAt" | "updatedAt">) => Promise<void>;
  updateCategory: (id: number, data: Partial<Category>) => Promise<void>;
  deleteCategory: (id: number) => Promise<void>;

  // Credit Cards
  creditCards: CreditCard[];
  loadingCards: boolean;
  refreshCreditCards: () => Promise<void>;
  addCreditCard: (data: CreateCreditCardInput) => Promise<void>;
  updateCreditCard: (id: number, data: Partial<CreditCard> & { cardNumber?: string }) => Promise<void>;
  deleteCreditCard: (id: number) => Promise<void>;

  // Transactions
  transactions: Transaction[];
  loadingTransactions: boolean;
  refreshTransactions: () => Promise<void>;
  addTransaction: (data: Omit<Transaction, "id" | "userId" | "createdAt" | "updatedAt">) => Promise<void>;
  updateTransaction: (id: number, data: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: number) => Promise<void>;
  clearAllData: () => Promise<void>;

  // Summary
  monthlyStats: MonthlyStats | null;
  loadingStats: boolean;
  refreshMonthlyStats: (year: number, month: number) => Promise<void>;
}

const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);

export function ExpenseProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Categories
  const categoriesQuery = trpc.categories.list.useQuery();
  const createCategoryMutation = trpc.categories.create.useMutation();
  const updateCategoryMutation = trpc.categories.update.useMutation();
  const deleteCategoryMutation = trpc.categories.delete.useMutation();

  const refreshCategories = useCallback(async () => {
    setLoadingCategories(true);
    try {
      // Use the value refetch() resolves with — reading categoriesQuery.data
      // here would be the stale closure snapshot from render time and miss the
      // just-fetched rows (e.g. an item added via an optimistic mutation).
      const { data } = await categoriesQuery.refetch();
      if (data) {
        setCategories(data);
      }
    } finally {
      setLoadingCategories(false);
    }
  }, [categoriesQuery]);

  const addCategory = useCallback(
    async (data: Omit<Category, "id" | "userId" | "createdAt" | "updatedAt">) => {
      const now = new Date();
      const optimistic: Category = { ...data, id: -Date.now(), userId: 0, createdAt: now, updatedAt: now };
      const snapshot = snapshotList(categories);
      setCategories((prev) => applyOptimistic(prev, { type: "add", item: optimistic, position: "end" }));
      try {
        await createCategoryMutation.mutateAsync(data);
        await refreshCategories();
        toast.show({ type: "success", message: "Category added" });
      } catch {
        setCategories(snapshot);
        toast.show({ type: "error", message: "Failed to add category" });
        throw new Error("addCategory failed");
      }
    },
    [createCategoryMutation, refreshCategories, categories, toast]
  );

  const updateCategory = useCallback(
    async (id: number, data: Partial<Category>) => {
      const snapshot = snapshotList(categories);
      setCategories((prev) => applyOptimistic(prev, { type: "update", id, data }));
      try {
        await updateCategoryMutation.mutateAsync({ id, ...data } as any);
        toast.show({ type: "success", message: "Category updated" });
      } catch {
        setCategories(snapshot);
        toast.show({ type: "error", message: "Failed to update category" });
        throw new Error("updateCategory failed");
      }
    },
    [updateCategoryMutation, categories, toast]
  );

  const deleteCategory = useCallback(
    async (id: number) => {
      const snapshot = snapshotList(categories);
      setCategories((prev) => applyOptimistic(prev, { type: "delete", id }));
      try {
        await deleteCategoryMutation.mutateAsync({ id });
        toast.show({ type: "success", message: "Category deleted" });
      } catch {
        setCategories(snapshot);
        toast.show({ type: "error", message: "Failed to delete category" });
        throw new Error("deleteCategory failed");
      }
    },
    [deleteCategoryMutation, categories, toast]
  );

  // Credit Cards
  const creditCardsQuery = trpc.creditCards.list.useQuery();
  const createCardMutation = trpc.creditCards.create.useMutation();
  const updateCardMutation = trpc.creditCards.update.useMutation();
  const deleteCardMutation = trpc.creditCards.delete.useMutation();

  const refreshCreditCards = useCallback(async () => {
    setLoadingCards(true);
    try {
      // Use refetch()'s resolved value, not the stale-closure query.data.
      const { data } = await creditCardsQuery.refetch();
      if (data) {
        setCreditCards(data);
      }
    } finally {
      setLoadingCards(false);
    }
  }, [creditCardsQuery]);

  const addCreditCard = useCallback(
    async (data: CreateCreditCardInput) => {
      const now = new Date();
      const { cardNumber, ...rest } = data;
      const optimistic: CreditCard = {
        ...rest,
        cardNumberLast4: cardNumber.slice(-4),
        id: -Date.now(),
        userId: 0,
        createdAt: now,
        updatedAt: now,
      };
      const snapshot = snapshotList(creditCards);
      setCreditCards((prev) => applyOptimistic(prev, { type: "add", item: optimistic, position: "end" }));
      try {
        await createCardMutation.mutateAsync({
          name: data.name,
          cardNumber: data.cardNumber,
          cardholderName: data.cardholderName,
          expiryMonth: data.expiryMonth,
          expiryYear: data.expiryYear,
          creditLimit: data.creditLimit,
          color: data.color,
          cardType: data.cardType,
        });
        await refreshCreditCards();
        toast.show({ type: "success", message: "Card added" });
      } catch {
        setCreditCards(snapshot);
        toast.show({ type: "error", message: "Failed to add card" });
        throw new Error("addCreditCard failed");
      }
    },
    [createCardMutation, refreshCreditCards, creditCards, toast]
  );

  const updateCreditCard = useCallback(
    async (id: number, data: Partial<CreditCard> & { cardNumber?: string }) => {
      const snapshot = snapshotList(creditCards);
      const { cardNumber, ...rest } = data;
      setCreditCards((prev) => applyOptimistic(prev, { type: "update", id, data: rest }));
      try {
        await updateCardMutation.mutateAsync({
          id,
          ...rest,
          ...(cardNumber !== undefined ? { cardNumber } : {}),
        } as Parameters<typeof updateCardMutation.mutateAsync>[0]);
        toast.show({ type: "success", message: "Card updated" });
      } catch {
        setCreditCards(snapshot);
        toast.show({ type: "error", message: "Failed to update card" });
        throw new Error("updateCreditCard failed");
      }
    },
    [updateCardMutation, creditCards, toast]
  );

  const deleteCreditCard = useCallback(
    async (id: number) => {
      const snapshot = snapshotList(creditCards);
      setCreditCards((prev) => applyOptimistic(prev, { type: "delete", id }));
      try {
        await deleteCardMutation.mutateAsync({ id });
        toast.show({ type: "success", message: "Card deleted" });
      } catch {
        setCreditCards(snapshot);
        toast.show({ type: "error", message: "Failed to delete card" });
        throw new Error("deleteCreditCard failed");
      }
    },
    [deleteCardMutation, creditCards, toast]
  );

  // Transactions
  const transactionsQuery = trpc.transactions.list.useQuery();
  const createTransactionMutation = trpc.transactions.create.useMutation();
  const updateTransactionMutation = trpc.transactions.update.useMutation();
  const deleteTransactionMutation = trpc.transactions.delete.useMutation();
  const clearAllMutation = trpc.data.clearAll.useMutation();

  const refreshTransactions = useCallback(async () => {
    setLoadingTransactions(true);
    try {
      // Use refetch()'s resolved value, not the stale-closure query.data.
      const { data } = await transactionsQuery.refetch();
      if (data) {
        setTransactions(data);
      }
    } finally {
      setLoadingTransactions(false);
    }
  }, [transactionsQuery]);

  const addTransaction = useCallback(
    async (data: Omit<Transaction, "id" | "userId" | "createdAt" | "updatedAt">) => {
      const now = new Date();
      const optimistic: Transaction = { ...data, id: -Date.now(), userId: 0, createdAt: now, updatedAt: now };
      const snapshot = snapshotList(transactions);
      setTransactions((prev) => applyOptimistic(prev, { type: "add", item: optimistic }));
      try {
        await createTransactionMutation.mutateAsync(data);
        await refreshTransactions();
        toast.show({ type: "success", message: "Transaction added" });
      } catch {
        setTransactions(snapshot);
        toast.show({ type: "error", message: "Failed to add transaction" });
        throw new Error("addTransaction failed");
      }
    },
    [createTransactionMutation, refreshTransactions, transactions, toast]
  );

  const updateTransaction = useCallback(
    async (id: number, data: Partial<Omit<Transaction, "id" | "userId" | "createdAt" | "updatedAt">>) => {
      const snapshot = snapshotList(transactions);
      setTransactions((prev) => applyOptimistic(prev, { type: "update", id, data: data as Partial<Transaction> }));
      try {
        await updateTransactionMutation.mutateAsync({ id, ...data } as any);
        toast.show({ type: "success", message: "Transaction updated" });
      } catch {
        setTransactions(snapshot);
        toast.show({ type: "error", message: "Failed to update transaction" });
        throw new Error("updateTransaction failed");
      }
    },
    [updateTransactionMutation, transactions, toast]
  );

  const deleteTransaction = useCallback(
    async (id: number) => {
      const snapshot = snapshotList(transactions);
      setTransactions((prev) => applyOptimistic(prev, { type: "delete", id }));
      try {
        await deleteTransactionMutation.mutateAsync({ id });
        toast.show({ type: "success", message: "Transaction deleted" });
      } catch {
        setTransactions(snapshot);
        toast.show({ type: "error", message: "Failed to delete transaction" });
        throw new Error("deleteTransaction failed");
      }
    },
    [deleteTransactionMutation, transactions, toast]
  );

  const statsQuery = trpc.summary.monthlyStats.useQuery({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  });

  const refreshMonthlyStats = useCallback(
    async (year: number, month: number) => {
      setLoadingStats(true);
      try {
        const data = await statsQuery.refetch();
        if (data.data) {
          setMonthlyStats(data.data);
        }
      } finally {
        setLoadingStats(false);
      }
    },
    [statsQuery]
  );

  const clearAllData = useCallback(async () => {
    const now = new Date();
    try {
      await clearAllMutation.mutateAsync();
      await Promise.all([
        refreshCategories(),
        refreshCreditCards(),
        refreshTransactions(),
        refreshMonthlyStats(now.getFullYear(), now.getMonth() + 1),
      ]);
      toast.show({ type: "success", message: "All data cleared" });
    } catch {
      toast.show({ type: "error", message: "Failed to clear data" });
      throw new Error("clearAllData failed");
    }
  }, [
    clearAllMutation,
    refreshCategories,
    refreshCreditCards,
    refreshTransactions,
    refreshMonthlyStats,
    toast,
  ]);

  // Initialize data on mount
  useEffect(() => {
    refreshCategories();
    refreshCreditCards();
    refreshTransactions();
    refreshMonthlyStats(new Date().getFullYear(), new Date().getMonth() + 1);
  }, []);

  const value: ExpenseContextType = {
    categories,
    loadingCategories,
    refreshCategories,
    addCategory,
    updateCategory,
    deleteCategory,

    creditCards,
    loadingCards,
    refreshCreditCards,
    addCreditCard,
    updateCreditCard,
    deleteCreditCard,

    transactions,
    loadingTransactions,
    refreshTransactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    clearAllData,

    monthlyStats,
    loadingStats,
    refreshMonthlyStats,
  };

  return <ExpenseContext.Provider value={value}>{children}</ExpenseContext.Provider>;
}

export function useExpense() {
  const context = useContext(ExpenseContext);
  if (!context) {
    throw new Error("useExpense must be used within ExpenseProvider");
  }
  return context;
}

/** User-scoped transactions linked to a single credit card (Story 2.2). */
export function useCardTransactions(creditCardId: number) {
  const enabled = Number.isFinite(creditCardId) && creditCardId > 0;
  const query = trpc.transactions.listByCreditCard.useQuery(
    { creditCardId },
    { enabled },
  );

  const refreshCardTransactions = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    cardTransactions: (query.data ?? []) as Transaction[],
    loadingCardTransactions: enabled && query.isLoading,
    refreshCardTransactions,
  };
}

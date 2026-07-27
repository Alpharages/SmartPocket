import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { trpc } from "./trpc";
import { useToast } from "@/components/ui/ToastProvider";
import { applyOptimistic, snapshotList } from "./optimistic";
import { getMonthBoundaries, getWeekBoundaries } from "./budget-period";
import { useFirstDayOfWeek } from "./first-day-of-week-provider";
import { syncLoanReminderState } from "./loan-reminders";

function toRecurringMutationInput(
  rule: RecurringTransaction,
): CreateRecurringTransactionInput {
  return {
    categoryId: rule.categoryId,
    creditCardId: rule.creditCardId ?? null,
    type: rule.type,
    amount: rule.amount,
    description: rule.description ?? undefined,
    frequency: rule.frequency,
    interval: rule.interval,
    endCondition: rule.endCondition,
    occurrenceCount:
      rule.endCondition === "count"
        ? (rule.occurrenceCount ?? undefined)
        : undefined,
    endDate:
      rule.endCondition === "endDate" ? (rule.endDate ?? undefined) : undefined,
    startDate: new Date(rule.startDate),
  };
}

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

export interface Account {
  id: number;
  userId: number;
  name: string;
  type: "cash" | "bank" | "wallet";
  currency: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateAccountInput = {
  name: string;
  type: "cash" | "bank" | "wallet";
  currency: string;
};

export interface Transfer {
  id: number;
  userId: number;
  fromAccountId: number;
  toAccountId: number;
  amount: string;
  description?: string | null;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateTransferInput = {
  fromAccountId: number;
  toAccountId: number;
  amount: string;
  description?: string;
  date: Date;
};

export type CreateCreditCardInput = Omit<
  CreditCard,
  "id" | "userId" | "createdAt" | "updatedAt" | "cardNumberLast4"
> & { cardNumber: string };

export interface Transaction {
  id: number;
  userId: number;
  categoryId: number;
  creditCardId?: number;
  accountId?: number | null;
  type: "income" | "expense";
  amount: string;
  description?: string;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateTransactionInput = Omit<
  Transaction,
  "id" | "userId" | "createdAt" | "updatedAt"
>;

export interface Budget {
  id: number;
  userId: number;
  categoryId: number;
  period: "monthly" | "weekly";
  amount: string;
  startDate?: Date | null;
  endDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateBudgetInput = {
  categoryId: number;
  period: "monthly" | "weekly";
  amount: string;
  startDate?: Date;
  endDate?: Date;
};

export interface RecurringTransaction {
  id: number;
  userId: number;
  categoryId: number;
  creditCardId?: number | null;
  type: "income" | "expense";
  amount: string;
  description?: string | null;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  endCondition: "count" | "endDate" | "never";
  occurrenceCount?: number | null;
  endDate?: Date | null;
  startDate: Date;
  nextRunDate: Date;
  lastRunDate?: Date | null;
  generatedCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateRecurringTransactionInput = Omit<
  RecurringTransaction,
  | "id"
  | "userId"
  | "createdAt"
  | "updatedAt"
  | "nextRunDate"
  | "lastRunDate"
  | "generatedCount"
  | "isActive"
>;

export interface Loan {
  id: number;
  userId: number;
  direction: "lend" | "borrow";
  counterparty: string | null;
  principal: string;
  rate: string | null;
  periodicity: "weekly" | "monthly" | "yearly" | "none";
  installmentCount: number | null;
  endDate: Date | null;
  nextDueDate: Date | null;
  status: "active" | "settled";
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateLoanInput = {
  direction: "lend" | "borrow";
  counterparty?: string | null;
  principal: string;
  rate?: string | null;
  periodicity: "weekly" | "monthly" | "yearly" | "none";
  installmentCount?: number | null;
  endDate?: Date | null;
  nextDueDate?: Date | null;
  note?: string | null;
};

export type RecordRepaymentInput = {
  loanId: number;
  amount: string;
  date: Date;
  note?: string | null;
};

export interface LoanRepayment {
  id: number;
  loanId: number;
  userId: number;
  amount: string;
  date: Date;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type LoanDetail = Loan & {
  remainingBalance: string;
  repayments: LoanRepayment[];
};

export interface BudgetProgress {
  budgetId: number;
  spent: string;
  limit: string;
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
  addCategory: (
    data: Omit<Category, "id" | "userId" | "createdAt" | "updatedAt">,
  ) => Promise<void>;
  updateCategory: (id: number, data: Partial<Category>) => Promise<void>;
  deleteCategory: (id: number) => Promise<void>;

  // Credit Cards
  creditCards: CreditCard[];
  loadingCards: boolean;
  refreshCreditCards: () => Promise<void>;
  addCreditCard: (data: CreateCreditCardInput) => Promise<void>;
  updateCreditCard: (
    id: number,
    data: Partial<CreditCard> & { cardNumber?: string },
  ) => Promise<void>;
  deleteCreditCard: (id: number) => Promise<void>;

  // Accounts
  accounts: Account[];
  loadingAccounts: boolean;
  refreshAccounts: () => Promise<void>;
  addAccount: (data: CreateAccountInput) => Promise<void>;
  updateAccount: (
    id: number,
    data: Partial<CreateAccountInput>,
  ) => Promise<void>;
  deleteAccount: (id: number) => Promise<void>;
  reassignAndDeleteAccount: (
    id: number,
    targetAccountId: number,
  ) => Promise<void>;
  fetchAccountTransactionCount: (id: number) => Promise<number>;
  fetchAccountTransferCount: (id: number) => Promise<number>;
  getAccountBalance: (accountId: number) => number;
  loadingAccountBalances: boolean;
  refreshAccountBalances: () => Promise<void>;
  transfers: Transfer[];
  loadingTransfers: boolean;
  refreshTransfers: () => Promise<void>;
  addTransfer: (data: CreateTransferInput) => Promise<void>;

  // Transactions
  transactions: Transaction[];
  loadingTransactions: boolean;
  refreshTransactions: () => Promise<void>;
  addTransaction: (data: CreateTransactionInput) => Promise<void>;
  importTransactions: (rows: CreateTransactionInput[]) => Promise<void>;
  updateTransaction: (id: number, data: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: number) => Promise<void>;
  clearAllData: () => Promise<void>;

  // Budgets
  budgets: Budget[];
  loadingBudgets: boolean;
  refreshBudgets: () => Promise<void>;
  addBudget: (data: CreateBudgetInput) => Promise<void>;
  updateBudget: (id: number, data: CreateBudgetInput) => Promise<void>;
  deleteBudget: (id: number) => Promise<void>;
  budgetProgress: BudgetProgress[];
  progressByBudgetId: Map<number, BudgetProgress>;
  loadingBudgetProgress: boolean;
  refreshBudgetProgress: () => Promise<void>;

  // Summary
  monthlyStats: MonthlyStats | null;
  loadingStats: boolean;
  /** Omit the period to re-fetch whichever month is currently displayed. */
  refreshMonthlyStats: (year?: number, month?: number) => Promise<void>;

  // Recurring transactions
  recurringTransactions: RecurringTransaction[];
  loadingRecurringTransactions: boolean;
  refreshRecurringTransactions: () => Promise<void>;
  addRecurringTransaction: (
    data: CreateRecurringTransactionInput,
  ) => Promise<void>;
  updateRecurringTransaction: (
    id: number,
    data: CreateRecurringTransactionInput,
  ) => Promise<void>;
  cancelRecurringTransaction: (id: number) => Promise<void>;

  // Loans
  loans: Loan[];
  loadingLoans: boolean;
  refreshLoans: () => Promise<void>;
  addLoan: (data: CreateLoanInput) => Promise<void>;
  updateLoan: (id: number, data: Partial<CreateLoanInput>) => Promise<void>;
  deleteLoan: (id: number) => Promise<void>;
  recordRepayment: (data: RecordRepaymentInput) => Promise<LoanDetail>;

  /** Refetch all expense-tracker data (categories, cards, transactions, etc.). */
  refreshAll: () => Promise<void>;
}

const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);

function getMutationErrorMessage(err: unknown, fallback: string): string {
  if (
    err &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  ) {
    return (err as { message: string }).message;
  }
  return fallback;
}

export function ExpenseProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  const { firstDayOfWeek } = useFirstDayOfWeek();

  const periodBoundaries = useMemo(() => {
    const now = new Date();
    const { monthStart, monthEnd } = getMonthBoundaries(now);
    const { weekStart, weekEnd } = getWeekBoundaries(now, firstDayOfWeek);
    return { monthStart, monthEnd, weekStart, weekEnd };
  }, [firstDayOfWeek]);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [accountBalances, setAccountBalances] = useState<Map<number, number>>(
    () => new Map(),
  );
  // Starts true: balances are unknown until the on-mount refresh resolves, so
  // the Accounts list shows a loading indicator instead of flashing a stale 0.
  const [loadingAccountBalances, setLoadingAccountBalances] = useState(true);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loadingTransfers, setLoadingTransfers] = useState(false);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loadingBudgets, setLoadingBudgets] = useState(false);

  const [recurringTransactions, setRecurringTransactions] = useState<
    RecurringTransaction[]
  >([]);
  const [loadingRecurringTransactions, setLoadingRecurringTransactions] =
    useState(false);

  const [loans, setLoans] = useState<Loan[]>([]);
  const [loadingLoans, setLoadingLoans] = useState(false);

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
    async (
      data: Omit<Category, "id" | "userId" | "createdAt" | "updatedAt">,
    ) => {
      const now = new Date();
      const optimistic: Category = {
        ...data,
        id: -Date.now(),
        userId: 0,
        createdAt: now,
        updatedAt: now,
      };
      const snapshot = snapshotList(categories);
      setCategories((prev) =>
        applyOptimistic(prev, {
          type: "add",
          item: optimistic,
          position: "end",
        }),
      );
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
    [createCategoryMutation, refreshCategories, categories, toast],
  );

  const updateCategory = useCallback(
    async (id: number, data: Partial<Category>) => {
      const snapshot = snapshotList(categories);
      setCategories((prev) =>
        applyOptimistic(prev, { type: "update", id, data }),
      );
      try {
        await updateCategoryMutation.mutateAsync({ id, ...data } as any);
        toast.show({ type: "success", message: "Category updated" });
      } catch {
        setCategories(snapshot);
        toast.show({ type: "error", message: "Failed to update category" });
        throw new Error("updateCategory failed");
      }
    },
    [updateCategoryMutation, categories, toast],
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
    [deleteCategoryMutation, categories, toast],
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
      setCreditCards((prev) =>
        applyOptimistic(prev, {
          type: "add",
          item: optimistic,
          position: "end",
        }),
      );
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
    [createCardMutation, refreshCreditCards, creditCards, toast],
  );

  const updateCreditCard = useCallback(
    async (id: number, data: Partial<CreditCard> & { cardNumber?: string }) => {
      const snapshot = snapshotList(creditCards);
      const { cardNumber, ...rest } = data;
      setCreditCards((prev) =>
        applyOptimistic(prev, { type: "update", id, data: rest }),
      );
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
    [updateCardMutation, creditCards, toast],
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
    [deleteCardMutation, creditCards, toast],
  );

  // Accounts
  const accountsQuery = trpc.accounts.list.useQuery();
  const createAccountMutation = trpc.accounts.create.useMutation();
  const updateAccountMutation = trpc.accounts.update.useMutation();
  const deleteAccountMutation = trpc.accounts.delete.useMutation();
  const reassignAndDeleteAccountMutation =
    trpc.accounts.reassignAndDelete.useMutation();
  const accountBalancesQuery = trpc.accounts.balances.useQuery();
  const transfersQuery = trpc.accounts.transfers.useQuery();
  const createTransferMutation = trpc.accounts.transfer.useMutation();
  const trpcUtils = trpc.useUtils();

  const refreshAccountBalances = useCallback(async () => {
    setLoadingAccountBalances(true);
    try {
      const { data } = await accountBalancesQuery.refetch();
      if (data) {
        setAccountBalances(
          new Map(data.map((entry) => [entry.accountId, entry.balance])),
        );
      }
    } finally {
      setLoadingAccountBalances(false);
    }
  }, [accountBalancesQuery]);

  const refreshTransfers = useCallback(async () => {
    setLoadingTransfers(true);
    try {
      const { data } = await transfersQuery.refetch();
      if (data) {
        setTransfers(data);
      }
    } finally {
      setLoadingTransfers(false);
    }
  }, [transfersQuery]);

  const getAccountBalance = useCallback(
    (accountId: number) => accountBalances.get(accountId) ?? 0,
    [accountBalances],
  );

  const refreshAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const { data } = await accountsQuery.refetch();
      if (data) {
        setAccounts(data);
      }
    } finally {
      setLoadingAccounts(false);
    }
  }, [accountsQuery]);

  const addAccount = useCallback(
    async (data: CreateAccountInput) => {
      const now = new Date();
      const optimistic: Account = {
        id: -Date.now(),
        userId: 0,
        name: data.name,
        type: data.type,
        currency: data.currency,
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      };
      const snapshot = snapshotList(accounts);
      setAccounts((prev) =>
        applyOptimistic(prev, {
          type: "add",
          item: optimistic,
          position: "end",
        }),
      );
      try {
        await createAccountMutation.mutateAsync(data);
        await refreshAccounts();
        toast.show({ type: "success", message: "Account added" });
      } catch {
        setAccounts(snapshot);
        toast.show({ type: "error", message: "Failed to add account" });
        throw new Error("addAccount failed");
      }
    },
    [createAccountMutation, refreshAccounts, accounts, toast],
  );

  const updateAccount = useCallback(
    async (id: number, data: Partial<CreateAccountInput>) => {
      const snapshot = snapshotList(accounts);
      setAccounts((prev) =>
        applyOptimistic(prev, {
          type: "update",
          id,
          data: data as Partial<Account>,
        }),
      );
      try {
        await updateAccountMutation.mutateAsync({ id, ...data });
        toast.show({ type: "success", message: "Account updated" });
      } catch {
        setAccounts(snapshot);
        toast.show({ type: "error", message: "Failed to update account" });
        throw new Error("updateAccount failed");
      }
    },
    [updateAccountMutation, accounts, toast],
  );

  const deleteAccount = useCallback(
    async (id: number) => {
      const snapshot = snapshotList(accounts);
      setAccounts((prev) => applyOptimistic(prev, { type: "delete", id }));
      try {
        await deleteAccountMutation.mutateAsync({ id });
        setAccountBalances((prev) => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
        toast.show({ type: "success", message: "Account deleted" });
      } catch (err) {
        setAccounts(snapshot);
        toast.show({
          type: "error",
          message: getMutationErrorMessage(err, "Failed to delete account"),
        });
        throw new Error("deleteAccount failed");
      }
    },
    [deleteAccountMutation, accounts, toast],
  );

  const reassignAndDeleteAccount = useCallback(
    async (id: number, targetAccountId: number) => {
      const snapshot = snapshotList(accounts);
      setAccounts((prev) => applyOptimistic(prev, { type: "delete", id }));
      try {
        await reassignAndDeleteAccountMutation.mutateAsync({
          id,
          targetAccountId,
        });
        await refreshAccountBalances();
        toast.show({ type: "success", message: "Account deleted" });
      } catch {
        setAccounts(snapshot);
        toast.show({
          type: "error",
          message: "Failed to reassign and delete account",
        });
        throw new Error("reassignAndDeleteAccount failed");
      }
    },
    [reassignAndDeleteAccountMutation, accounts, refreshAccountBalances, toast],
  );

  const fetchAccountTransactionCount = useCallback(
    async (id: number) => {
      return trpcUtils.accounts.transactionCount.fetch({ id });
    },
    [trpcUtils],
  );

  const fetchAccountTransferCount = useCallback(
    async (id: number) => {
      return trpcUtils.accounts.transferCount.fetch({ id });
    },
    [trpcUtils],
  );

  const addTransfer = useCallback(
    async (data: CreateTransferInput) => {
      try {
        await createTransferMutation.mutateAsync(data);
        await Promise.all([refreshTransfers(), refreshAccountBalances()]);
        toast.show({ type: "success", message: "Transfer recorded" });
      } catch (err) {
        toast.show({
          type: "error",
          message: getMutationErrorMessage(err, "Failed to record transfer"),
        });
        throw new Error("addTransfer failed");
      }
    },
    [createTransferMutation, refreshTransfers, refreshAccountBalances, toast],
  );

  // Loans
  const loansQuery = trpc.loans.list.useQuery();
  const createLoanMutation = trpc.loans.create.useMutation();
  const updateLoanMutation = trpc.loans.update.useMutation();
  const deleteLoanMutation = trpc.loans.delete.useMutation();
  const recordRepaymentMutation = trpc.loans.recordRepayment.useMutation();
  const settingsQuery = trpc.settings.get.useQuery();
  const remindersEnabled = settingsQuery.data?.remindersEnabled ?? false;

  const refreshLoans = useCallback(async () => {
    setLoadingLoans(true);
    try {
      const { data } = await loansQuery.refetch();
      if (data) {
        setLoans(data);
      }
    } finally {
      setLoadingLoans(false);
    }
  }, [loansQuery]);

  const addLoan = useCallback(
    async (data: CreateLoanInput) => {
      const now = new Date();
      const optimistic: Loan = {
        id: -Date.now(),
        userId: 0,
        direction: data.direction,
        counterparty: data.counterparty ?? null,
        principal: data.principal,
        rate: data.rate ?? null,
        periodicity: data.periodicity,
        installmentCount: data.installmentCount ?? null,
        endDate: data.endDate ?? null,
        nextDueDate: data.nextDueDate ?? null,
        status: "active",
        note: data.note ?? null,
        createdAt: now,
        updatedAt: now,
      };
      const snapshot = snapshotList(loans);
      setLoans((prev) =>
        applyOptimistic(prev, {
          type: "add",
          item: optimistic,
          position: "start",
        }),
      );
      try {
        await createLoanMutation.mutateAsync({
          direction: data.direction,
          counterparty: data.counterparty?.trim() || null,
          principal: data.principal,
          rate: data.rate?.trim() ? data.rate.trim() : null,
          periodicity: data.periodicity,
          installmentCount: data.installmentCount ?? null,
          endDate: data.endDate ?? null,
          nextDueDate: data.nextDueDate ?? null,
          note: data.note ?? null,
        });
        await refreshLoans();
        toast.show({ type: "success", message: "Loan added" });
      } catch (err) {
        setLoans(snapshot);
        toast.show({
          type: "error",
          message: getMutationErrorMessage(err, "Failed to add loan"),
        });
        throw new Error("addLoan failed");
      }
    },
    [createLoanMutation, refreshLoans, loans, toast],
  );

  const updateLoan = useCallback(
    async (id: number, data: Partial<CreateLoanInput>) => {
      const snapshot = snapshotList(loans);
      setLoans((prev) =>
        applyOptimistic(prev, {
          type: "update",
          id,
          data: data as Partial<Loan>,
        }),
      );
      try {
        await updateLoanMutation.mutateAsync({ id, ...data });
        await refreshLoans();
        toast.show({ type: "success", message: "Loan updated" });
      } catch (err) {
        setLoans(snapshot);
        toast.show({
          type: "error",
          message: getMutationErrorMessage(err, "Failed to update loan"),
        });
        throw new Error("updateLoan failed");
      }
    },
    [updateLoanMutation, refreshLoans, loans, toast],
  );

  const deleteLoan = useCallback(
    async (id: number) => {
      const snapshot = snapshotList(loans);
      setLoans((prev) => applyOptimistic(prev, { type: "delete", id }));
      try {
        await deleteLoanMutation.mutateAsync({ id });
        toast.show({ type: "success", message: "Loan deleted" });
      } catch (err) {
        setLoans(snapshot);
        toast.show({
          type: "error",
          message: getMutationErrorMessage(err, "Failed to delete loan"),
        });
        throw new Error("deleteLoan failed");
      }
    },
    [deleteLoanMutation, loans, toast],
  );

  const recordRepayment = useCallback(
    async (data: RecordRepaymentInput) => {
      try {
        const updated = await recordRepaymentMutation.mutateAsync({
          loanId: data.loanId,
          amount: data.amount,
          date: data.date,
          note: data.note?.trim() ? data.note.trim() : null,
        });
        await refreshLoans();
        toast.show({ type: "success", message: "Repayment recorded" });
        return updated as LoanDetail;
      } catch (err) {
        toast.show({
          type: "error",
          message: getMutationErrorMessage(err, "Failed to record repayment"),
        });
        throw new Error("recordRepayment failed");
      }
    },
    [recordRepaymentMutation, refreshLoans, toast],
  );

  // Transactions
  const transactionsQuery = trpc.transactions.list.useQuery();
  const createTransactionMutation = trpc.transactions.create.useMutation();
  const createManyTransactionsMutation =
    trpc.transactions.createMany.useMutation();
  const updateTransactionMutation = trpc.transactions.update.useMutation();
  const deleteTransactionMutation = trpc.transactions.delete.useMutation();
  const clearAllMutation = trpc.data.clearAll.useMutation();

  // The period currently reflected in `monthlyStats`. Mutations refresh
  // *this* period, not "now" — a user editing while viewing June must see
  // June's totals update, not July's.
  const statsPeriodRef = React.useRef<{ year: number; month: number }>({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  });

  /**
   * Fetch monthly stats for an explicit period.
   *
   * QA report SP-003: this previously accepted `year`/`month` and ignored
   * both, calling `.refetch()` on a query whose key was frozen to the current
   * month. Every month the user navigated to on Insights re-displayed the
   * current month's totals while the category breakdown below (computed
   * client-side) correctly followed the selection — so the screen showed two
   * contradictory answers. Now the arguments are honoured; omitting them
   * re-fetches whichever period is currently displayed.
   */
  const refreshMonthlyStats = useCallback(
    async (year?: number, month?: number) => {
      const period =
        year != null && month != null
          ? { year, month }
          : statsPeriodRef.current;
      statsPeriodRef.current = period;

      setLoadingStats(true);
      try {
        const data = await trpcUtils.summary.monthlyStats.fetch(period);
        if (data) {
          setMonthlyStats(data);
        }
      } finally {
        setLoadingStats(false);
      }
    },
    [trpcUtils],
  );

  const budgetsQuery = trpc.budgets.list.useQuery();
  const createBudgetMutation = trpc.budgets.create.useMutation();
  const updateBudgetMutation = trpc.budgets.update.useMutation();
  const deleteBudgetMutation = trpc.budgets.delete.useMutation();
  const budgetProgressQuery = trpc.budgets.progress.useQuery(periodBoundaries);

  const recurringTransactionsQuery = trpc.recurringTransactions.list.useQuery();
  const createRecurringMutation =
    trpc.recurringTransactions.create.useMutation();
  const updateRecurringMutation =
    trpc.recurringTransactions.update.useMutation();

  const progressByBudgetId = useMemo(
    () =>
      new Map(
        (budgetProgressQuery.data ?? []).map((row) => [row.budgetId, row]),
      ),
    [budgetProgressQuery.data],
  );

  const refreshBudgetProgress = useCallback(async () => {
    await budgetProgressQuery.refetch();
  }, [budgetProgressQuery]);

  const refreshBudgets = useCallback(async () => {
    setLoadingBudgets(true);
    try {
      const { data } = await budgetsQuery.refetch();
      if (data) {
        setBudgets(data);
      }
    } finally {
      setLoadingBudgets(false);
    }
  }, [budgetsQuery]);

  const addBudget = useCallback(
    async (data: CreateBudgetInput) => {
      const now = new Date();
      const optimistic: Budget = {
        ...data,
        id: -Date.now(),
        userId: 0,
        createdAt: now,
        updatedAt: now,
      };
      const snapshot = snapshotList(budgets);
      setBudgets((prev) =>
        applyOptimistic(prev, {
          type: "add",
          item: optimistic,
          position: "end",
        }),
      );
      try {
        await createBudgetMutation.mutateAsync(data);
        await refreshBudgets();
        await refreshBudgetProgress();
        toast.show({ type: "success", message: "Budget added" });
      } catch (err) {
        setBudgets(snapshot);
        throw new Error(getMutationErrorMessage(err, "Failed to add budget"));
      }
    },
    [
      createBudgetMutation,
      refreshBudgets,
      refreshBudgetProgress,
      budgets,
      toast,
    ],
  );

  const updateBudget = useCallback(
    async (id: number, data: CreateBudgetInput) => {
      const snapshot = snapshotList(budgets);
      setBudgets((prev) => applyOptimistic(prev, { type: "update", id, data }));
      try {
        await updateBudgetMutation.mutateAsync({ id, ...data });
        await refreshBudgets();
        await refreshBudgetProgress();
        toast.show({ type: "success", message: "Budget updated" });
      } catch (err) {
        setBudgets(snapshot);
        throw new Error(
          getMutationErrorMessage(err, "Failed to update budget"),
        );
      }
    },
    [
      updateBudgetMutation,
      refreshBudgets,
      refreshBudgetProgress,
      budgets,
      toast,
    ],
  );

  const deleteBudget = useCallback(
    async (id: number) => {
      const snapshot = snapshotList(budgets);
      setBudgets((prev) => applyOptimistic(prev, { type: "delete", id }));
      try {
        await deleteBudgetMutation.mutateAsync({ id });
        await refreshBudgets();
        await refreshBudgetProgress();
        toast.show({ type: "success", message: "Budget deleted" });
      } catch (err) {
        setBudgets(snapshot);
        throw new Error(
          getMutationErrorMessage(err, "Failed to delete budget"),
        );
      }
    },
    [
      deleteBudgetMutation,
      refreshBudgets,
      refreshBudgetProgress,
      budgets,
      toast,
    ],
  );

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
    async (data: CreateTransactionInput) => {
      const now = new Date();
      const optimistic: Transaction = {
        ...data,
        id: -Date.now(),
        userId: 0,
        createdAt: now,
        updatedAt: now,
      };
      const snapshot = snapshotList(transactions);
      setTransactions((prev) =>
        applyOptimistic(prev, { type: "add", item: optimistic }),
      );
      try {
        await createTransactionMutation.mutateAsync(data);
        await refreshTransactions();
        await refreshBudgetProgress();
        await refreshAccountBalances();
        await refreshMonthlyStats();
        toast.show({ type: "success", message: "Transaction added" });
      } catch {
        setTransactions(snapshot);
        toast.show({ type: "error", message: "Failed to add transaction" });
        throw new Error("addTransaction failed");
      }
    },
    [
      createTransactionMutation,
      refreshTransactions,
      refreshBudgetProgress,
      refreshAccountBalances,
      refreshMonthlyStats,
      transactions,
      toast,
    ],
  );

  const importTransactions = useCallback(
    async (rows: CreateTransactionInput[]) => {
      if (rows.length === 0) return;
      try {
        await createManyTransactionsMutation.mutateAsync(rows);
        await refreshTransactions();
        await refreshBudgetProgress();
        await refreshAccountBalances();
        toast.show({ type: "success", message: "Import complete" });
      } catch {
        toast.show({ type: "error", message: "Import failed" });
        throw new Error("importTransactions failed");
      }
    },
    [
      createManyTransactionsMutation,
      refreshTransactions,
      refreshBudgetProgress,
      refreshAccountBalances,
      toast,
    ],
  );

  const updateTransaction = useCallback(
    async (
      id: number,
      data: Partial<
        Omit<Transaction, "id" | "userId" | "createdAt" | "updatedAt">
      >,
    ) => {
      const snapshot = snapshotList(transactions);
      setTransactions((prev) =>
        applyOptimistic(prev, {
          type: "update",
          id,
          data: data as Partial<Transaction>,
        }),
      );
      try {
        await updateTransactionMutation.mutateAsync({ id, ...data });
        await refreshBudgetProgress();
        await refreshAccountBalances();
        await refreshMonthlyStats();
        toast.show({ type: "success", message: "Transaction updated" });
      } catch {
        setTransactions(snapshot);
        toast.show({ type: "error", message: "Failed to update transaction" });
        throw new Error("updateTransaction failed");
      }
    },
    [
      updateTransactionMutation,
      refreshBudgetProgress,
      refreshAccountBalances,
      refreshMonthlyStats,
      transactions,
      toast,
    ],
  );

  const deleteTransaction = useCallback(
    async (id: number) => {
      const snapshot = snapshotList(transactions);
      setTransactions((prev) => applyOptimistic(prev, { type: "delete", id }));
      try {
        await deleteTransactionMutation.mutateAsync({ id });
        await refreshBudgetProgress();
        await refreshAccountBalances();
        await refreshMonthlyStats();
        toast.show({ type: "success", message: "Transaction deleted" });
      } catch {
        setTransactions(snapshot);
        toast.show({ type: "error", message: "Failed to delete transaction" });
        throw new Error("deleteTransaction failed");
      }
    },
    [
      deleteTransactionMutation,
      refreshBudgetProgress,
      refreshAccountBalances,
      refreshMonthlyStats,
      transactions,
      toast,
    ],
  );

  const refreshRecurringTransactions = useCallback(async () => {
    setLoadingRecurringTransactions(true);
    try {
      const { data } = await recurringTransactionsQuery.refetch();
      if (data) {
        setRecurringTransactions(data as RecurringTransaction[]);
      }
    } finally {
      setLoadingRecurringTransactions(false);
    }
  }, [recurringTransactionsQuery]);

  const addRecurringTransaction = useCallback(
    async (data: CreateRecurringTransactionInput) => {
      const now = new Date();
      const optimistic: RecurringTransaction = {
        ...data,
        id: -Date.now(),
        userId: 0,
        creditCardId: data.creditCardId ?? null,
        description: data.description ?? null,
        occurrenceCount: data.occurrenceCount ?? null,
        endDate: data.endDate ?? null,
        nextRunDate: data.startDate,
        lastRunDate: null,
        generatedCount: 0,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      const snapshot = snapshotList(recurringTransactions);
      setRecurringTransactions((prev) =>
        applyOptimistic(prev, {
          type: "add",
          item: optimistic,
          position: "end",
        }),
      );
      try {
        await createRecurringMutation.mutateAsync(data);
        await refreshRecurringTransactions();
        toast.show({ type: "success", message: "Recurring rule added" });
      } catch (err) {
        setRecurringTransactions(snapshot);
        toast.show({
          type: "error",
          message: getMutationErrorMessage(err, "Failed to add recurring rule"),
        });
        throw new Error("addRecurringTransaction failed");
      }
    },
    [
      createRecurringMutation,
      refreshRecurringTransactions,
      recurringTransactions,
      toast,
    ],
  );

  const updateRecurringTransaction = useCallback(
    async (id: number, data: CreateRecurringTransactionInput) => {
      const snapshot = snapshotList(recurringTransactions);
      setRecurringTransactions((prev) =>
        applyOptimistic(prev, {
          type: "update",
          id,
          data: {
            ...data,
            creditCardId: data.creditCardId ?? null,
            description: data.description ?? null,
            occurrenceCount: data.occurrenceCount ?? null,
            endDate: data.endDate ?? null,
          },
        }),
      );
      try {
        await updateRecurringMutation.mutateAsync({ id, ...data });
        await refreshRecurringTransactions();
        toast.show({ type: "success", message: "Recurring rule updated" });
      } catch (err) {
        setRecurringTransactions(snapshot);
        toast.show({
          type: "error",
          message: getMutationErrorMessage(
            err,
            "Failed to update recurring rule",
          ),
        });
        throw new Error("updateRecurringTransaction failed");
      }
    },
    [
      updateRecurringMutation,
      refreshRecurringTransactions,
      recurringTransactions,
      toast,
    ],
  );

  const cancelRecurringTransaction = useCallback(
    async (id: number) => {
      const rule = recurringTransactions.find((item) => item.id === id);
      if (!rule) {
        throw new Error("cancelRecurringTransaction: rule not found");
      }
      const snapshot = snapshotList(recurringTransactions);
      setRecurringTransactions((prev) =>
        applyOptimistic(prev, {
          type: "update",
          id,
          data: { isActive: false },
        }),
      );
      try {
        await updateRecurringMutation.mutateAsync({
          id,
          ...toRecurringMutationInput(rule),
          isActive: false,
        });
        await refreshRecurringTransactions();
        toast.show({ type: "success", message: "Recurring rule stopped" });
      } catch (err) {
        setRecurringTransactions(snapshot);
        toast.show({
          type: "error",
          message: getMutationErrorMessage(
            err,
            "Failed to stop recurring rule",
          ),
        });
        throw new Error("cancelRecurringTransaction failed");
      }
    },
    [
      updateRecurringMutation,
      refreshRecurringTransactions,
      recurringTransactions,
      toast,
    ],
  );

  const refreshAll = useCallback(async () => {
    await Promise.all([
      refreshCategories(),
      refreshCreditCards(),
      refreshAccounts(),
      refreshAccountBalances(),
      refreshTransfers(),
      refreshTransactions(),
      refreshBudgets(),
      refreshBudgetProgress(),
      refreshRecurringTransactions(),
      refreshLoans(),
      refreshMonthlyStats(),
    ]);
  }, [
    refreshCategories,
    refreshCreditCards,
    refreshAccounts,
    refreshAccountBalances,
    refreshTransfers,
    refreshTransactions,
    refreshBudgets,
    refreshBudgetProgress,
    refreshRecurringTransactions,
    refreshLoans,
    refreshMonthlyStats,
  ]);

  const clearAllData = useCallback(async () => {
    try {
      await clearAllMutation.mutateAsync();
      await Promise.all([
        refreshCategories(),
        refreshCreditCards(),
        refreshAccounts(),
        refreshAccountBalances(),
        refreshTransfers(),
        refreshTransactions(),
        refreshBudgets(),
        refreshBudgetProgress(),
        refreshRecurringTransactions(),
        refreshLoans(),
        refreshMonthlyStats(),
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
    refreshAccounts,
    refreshAccountBalances,
    refreshTransfers,
    refreshTransactions,
    refreshBudgets,
    refreshBudgetProgress,
    refreshRecurringTransactions,
    refreshLoans,
    refreshMonthlyStats,
    toast,
  ]);

  useEffect(() => {
    if (!settingsQuery.isSuccess) {
      return;
    }
    void syncLoanReminderState(loans, { remindersEnabled });
  }, [loans, remindersEnabled, settingsQuery.isSuccess]);

  // Initialize data on mount
  useEffect(() => {
    refreshCategories();
    refreshCreditCards();
    refreshAccounts();
    refreshAccountBalances();
    refreshTransfers();
    refreshTransactions();
    refreshBudgets();
    refreshRecurringTransactions();
    refreshLoans();
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

    accounts,
    loadingAccounts,
    refreshAccounts,
    addAccount,
    updateAccount,
    deleteAccount,
    reassignAndDeleteAccount,
    fetchAccountTransactionCount,
    fetchAccountTransferCount,
    getAccountBalance,
    loadingAccountBalances,
    refreshAccountBalances,
    transfers,
    loadingTransfers,
    refreshTransfers,
    addTransfer,

    transactions,
    loadingTransactions,
    refreshTransactions,
    addTransaction,
    importTransactions,
    updateTransaction,
    deleteTransaction,
    clearAllData,

    budgets,
    loadingBudgets,
    refreshBudgets,
    addBudget,
    updateBudget,
    deleteBudget,
    budgetProgress: budgetProgressQuery.data ?? [],
    progressByBudgetId,
    loadingBudgetProgress: budgetProgressQuery.isLoading,
    refreshBudgetProgress,

    monthlyStats,
    loadingStats,
    refreshMonthlyStats,

    recurringTransactions,
    loadingRecurringTransactions,
    refreshRecurringTransactions,
    addRecurringTransaction,
    updateRecurringTransaction,
    cancelRecurringTransaction,

    loans,
    loadingLoans,
    refreshLoans,
    addLoan,
    updateLoan,
    deleteLoan,
    recordRepayment,

    refreshAll,
  };

  return (
    <ExpenseContext.Provider value={value}>{children}</ExpenseContext.Provider>
  );
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

/** User-scoped loan detail with repayments and remaining balance (Story 8.3). */
export function useLoanDetail(loanId: number) {
  const enabled = Number.isFinite(loanId) && loanId > 0;
  const query = trpc.loans.getById.useQuery({ id: loanId }, { enabled });

  const refreshLoanDetail = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    loanDetail: (query.data ?? null) as LoanDetail | null,
    loadingLoanDetail: enabled && query.isLoading,
    loanDetailError: enabled && query.isError,
    refreshLoanDetail,
  };
}

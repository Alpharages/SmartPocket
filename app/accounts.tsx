import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Animated, FadeInDown } from "@/lib/motion";

import { ResponsiveContent } from "@/components/responsive-content";
import { ScreenContainer } from "@/components/screen-container";
import {
  Button,
  ConfirmSheet,
  EmptyState,
  ScreenHeader,
  Sheet,
} from "@/components/ui";
import { useToast } from "@/components/ui/ToastProvider";
import { useExpense, type Account } from "@/lib/expense-context";
import {
  ACCOUNT_TYPES,
  getAccountTypeLabel,
  isAccountFormValid,
  type AccountFormValues,
  type AccountType,
} from "@/lib/account-form-validation";
import {
  CURRENCIES,
  formatCurrency,
  getCurrencyLabel,
  isSupportedCurrency,
  type CurrencyCode,
} from "@/lib/currency";
import { useCurrency } from "@/lib/currency-provider";
import { useColors } from "@/hooks/use-colors";
import { useConfirm } from "@/hooks/use-confirm";
import { ContentMaxWidth } from "@/lib/_core/theme";
import {
  createDefaultTransferForm,
  isTransferFormValid,
  type TransferFormValues,
} from "@/lib/transfer-form-validation";
import { parseDateInput } from "@/lib/recurring-form-validation";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";

type SheetMode = "add" | "edit" | null;

const EMPTY_FORM: AccountFormValues = {
  name: "",
  type: "cash",
  currency: "USD",
};

function AccountRow({
  account,
  balance,
  loadingBalance,
  index,
  onEdit,
  onDelete,
}: {
  account: Account;
  balance: number;
  loadingBalance: boolean;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const colors = useColors();
  const typeLabel = getAccountTypeLabel(account.type);
  const currencyCode: CurrencyCode = isSupportedCurrency(account.currency)
    ? account.currency
    : "USD";
  const balanceDisplay = formatCurrency(balance, currencyCode);

  return (
    <Animated.View entering={FadeInDown.delay(index * 30).duration(400)}>
      <View
        className="mx-lg mb-md rounded-2xl px-lg py-md flex-row items-center"
        style={{
          backgroundColor: colors.surface,
          borderWidth: 0.5,
          borderColor: colors.border,
          minHeight: 44,
        }}
        accessible
        accessibilityLabel={
          loadingBalance
            ? `${account.name}, ${typeLabel}, ${account.currency}, balance loading`
            : `${account.name}, ${typeLabel}, ${account.currency}, balance ${balanceDisplay}`
        }
      >
        <View className="flex-1">
          <Text className="text-body font-semibold text-foreground">
            {account.name}
          </Text>
          <Text className="text-caption text-muted mt-0.5">
            {typeLabel} · {account.currency}
          </Text>
        </View>
        {loadingBalance ? (
          <ActivityIndicator
            size="small"
            color={colors.muted}
            className="mr-sm"
            testID={`account-balance-loading-${account.id}`}
          />
        ) : (
          <Text
            className="text-body font-semibold text-foreground tabular-nums mr-sm"
            accessibilityRole="text"
          >
            {balanceDisplay}
          </Text>
        )}
        <Pressable
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${account.name}`}
          className="items-center justify-center"
          style={{ minWidth: 44, minHeight: 44 }}
          testID={`edit-account-${account.id}`}
        >
          <Ionicons name="pencil" size={18} color={colors.primary} />
        </Pressable>
        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${account.name}`}
          className="items-center justify-center"
          style={{ minWidth: 44, minHeight: 44 }}
          testID={`delete-account-${account.id}`}
        >
          <Ionicons name="trash-outline" size={18} color={colors.error} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

function AccountFormFields({
  values,
  onChange,
  onOpenCurrencyPicker,
}: {
  values: AccountFormValues;
  onChange: (patch: Partial<AccountFormValues>) => void;
  onOpenCurrencyPicker: () => void;
}) {
  const colors = useColors();

  return (
    <>
      <View>
        <Text className="text-sm font-semibold text-foreground mb-2">
          Account name
        </Text>
        <View
          className="px-4 py-3.5 rounded-xl"
          style={{
            backgroundColor: colors.background,
            borderWidth: 0.5,
            borderColor: colors.border,
          }}
        >
          <TextInput
            placeholder="e.g., Main Checking"
            placeholderTextColor={colors.muted}
            value={values.name}
            onChangeText={(name) => onChange({ name })}
            className="text-foreground"
            style={{ fontSize: 15, minHeight: 44 }}
            accessibilityLabel="Account name"
          />
        </View>
      </View>

      <View>
        <Text className="text-sm font-semibold text-foreground mb-2">Type</Text>
        <View className="flex-row flex-wrap gap-sm">
          {ACCOUNT_TYPES.map((type) => {
            const selected = values.type === type;
            return (
              <Pressable
                key={type}
                onPress={() => onChange({ type })}
                accessibilityRole="button"
                accessibilityLabel={`${getAccountTypeLabel(type)}${selected ? ", selected" : ""}`}
                accessibilityState={{ selected }}
                className="px-md py-sm rounded-full"
                style={{
                  minHeight: 44,
                  justifyContent: "center",
                  backgroundColor: selected
                    ? colors.primary
                    : colors.background,
                  borderWidth: 0.5,
                  borderColor: selected ? colors.primary : colors.border,
                }}
              >
                <Text
                  style={{
                    color: selected ? "#FFFFFF" : colors.foreground,
                    fontWeight: "600",
                  }}
                >
                  {getAccountTypeLabel(type)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View>
        <Text className="text-sm font-semibold text-foreground mb-2">
          Currency
        </Text>
        <Pressable
          onPress={onOpenCurrencyPicker}
          accessibilityRole="button"
          accessibilityLabel={`Currency, ${getCurrencyLabel(values.currency)}`}
          className="px-4 py-3.5 rounded-xl flex-row items-center justify-between"
          style={{
            backgroundColor: colors.background,
            borderWidth: 0.5,
            borderColor: colors.border,
            minHeight: 44,
          }}
        >
          <Text className="text-foreground" style={{ fontSize: 15 }}>
            {getCurrencyLabel(values.currency)}
          </Text>
          <Ionicons name="chevron-down" size={18} color={colors.muted} />
        </Pressable>
      </View>
    </>
  );
}

function CurrencyPickerSheet({
  visible,
  selected,
  onClose,
  onSelect,
}: {
  visible: boolean;
  selected: CurrencyCode;
  onClose: () => void;
  onSelect: (code: CurrencyCode) => void;
}) {
  const colors = useColors();

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Currency"
      testID="account-currency-picker-sheet"
    >
      {CURRENCIES.map((entry) => {
        const isActive = entry.code === selected;
        return (
          <Pressable
            key={entry.code}
            onPress={() => {
              onSelect(entry.code);
              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel={`${getCurrencyLabel(entry.code)}${isActive ? ", selected" : ""}`}
            accessibilityState={{ selected: isActive }}
            className="flex-row items-center px-lg"
            style={{ minHeight: 44 }}
          >
            <Text className="flex-1 text-body font-medium text-foreground">
              {getCurrencyLabel(entry.code)}
            </Text>
            {isActive ? (
              <Ionicons name="checkmark" size={20} color={colors.primary} />
            ) : null}
          </Pressable>
        );
      })}
    </Sheet>
  );
}

function AccountPickerSheet({
  visible,
  title,
  accounts,
  selectedId,
  onClose,
  onSelect,
  testID,
}: {
  visible: boolean;
  title: string;
  accounts: Account[];
  selectedId: number | null;
  onClose: () => void;
  onSelect: (id: number) => void;
  testID: string;
}) {
  const colors = useColors();

  return (
    <Sheet visible={visible} onClose={onClose} title={title} testID={testID}>
      {accounts.length === 0 ? (
        <View className="px-lg pb-lg">
          <Text className="text-body text-muted">No accounts available.</Text>
        </View>
      ) : (
        accounts.map((account) => {
          const selected = account.id === selectedId;
          return (
            <Pressable
              key={account.id}
              onPress={() => {
                onSelect(account.id);
                onClose();
              }}
              accessibilityRole="button"
              accessibilityLabel={`${account.name}${selected ? ", selected" : ""}`}
              accessibilityState={{ selected }}
              className="flex-row items-center px-lg"
              style={{ minHeight: 44 }}
            >
              <Text className="flex-1 text-body font-medium text-foreground">
                {account.name}
              </Text>
              {selected ? (
                <Ionicons name="checkmark" size={20} color={colors.primary} />
              ) : null}
            </Pressable>
          );
        })
      )}
    </Sheet>
  );
}

function TransferFormSheet({
  visible,
  values,
  accounts,
  onChange,
  onClose,
  onSubmit,
  saving,
  onOpenFromPicker,
  onOpenToPicker,
}: {
  visible: boolean;
  values: TransferFormValues;
  accounts: Account[];
  onChange: (patch: Partial<TransferFormValues>) => void;
  onClose: () => void;
  onSubmit: () => void;
  saving: boolean;
  onOpenFromPicker: () => void;
  onOpenToPicker: () => void;
}) {
  const colors = useColors();
  const formValid = isTransferFormValid(values);
  const fromAccount = accounts.find((a) => a.id === values.fromAccountId);
  const destinationCandidates = useMemo(() => {
    if (!fromAccount)
      return accounts.filter((a) => a.id !== values.fromAccountId);
    return accounts.filter(
      (a) =>
        a.id !== values.fromAccountId && a.currency === fromAccount.currency,
    );
  }, [accounts, fromAccount, values.fromAccountId]);
  const toAccount = accounts.find((a) => a.id === values.toAccountId);
  const canPickDestination = values.fromAccountId != null;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Transfer"
      testID="transfer-sheet"
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flexShrink: 1 }}
        contentContainerStyle={{ gap: 16, paddingBottom: 24 }}
      >
        <View className="px-lg gap-lg">
          <View>
            <Text className="text-label text-muted mb-sm">From</Text>
            <Pressable
              onPress={onOpenFromPicker}
              accessibilityRole="button"
              accessibilityLabel={`Source account, ${fromAccount?.name ?? "not selected"}`}
              className="px-4 py-3.5 rounded-xl flex-row items-center justify-between"
              style={{
                backgroundColor: colors.background,
                borderWidth: 0.5,
                borderColor: colors.border,
                minHeight: 44,
              }}
            >
              <Text className="text-foreground" style={{ fontSize: 15 }}>
                {fromAccount?.name ?? "Select source account"}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.muted} />
            </Pressable>
          </View>

          <View>
            <Text className="text-label text-muted mb-sm">To</Text>
            <Pressable
              onPress={canPickDestination ? onOpenToPicker : undefined}
              disabled={!canPickDestination}
              accessibilityRole="button"
              accessibilityLabel={`Destination account, ${toAccount?.name ?? "not selected"}`}
              accessibilityState={{ disabled: !canPickDestination }}
              className="px-4 py-3.5 rounded-xl flex-row items-center justify-between"
              style={{
                backgroundColor: colors.background,
                borderWidth: 0.5,
                borderColor: colors.border,
                minHeight: 44,
                opacity: canPickDestination ? 1 : 0.5,
              }}
            >
              <Text className="text-foreground" style={{ fontSize: 15 }}>
                {toAccount?.name ??
                  (canPickDestination
                    ? "Select destination account"
                    : "Choose source first")}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.muted} />
            </Pressable>
            {fromAccount && destinationCandidates.length === 0 ? (
              <Text className="text-caption text-warning mt-sm">
                No other accounts share {fromAccount.currency}. Add a
                matching-currency account first.
              </Text>
            ) : null}
          </View>

          <View>
            <Text className="text-label text-muted mb-sm">Amount</Text>
            <TextInput
              value={values.amount}
              onChangeText={(amount) => onChange({ amount })}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.muted}
              accessibilityLabel="Transfer amount"
              className="px-4 py-3.5 rounded-xl text-foreground"
              style={{
                backgroundColor: colors.background,
                borderWidth: 0.5,
                borderColor: colors.border,
                fontSize: 15,
                minHeight: 44,
              }}
            />
          </View>

          <View>
            <Text className="text-label text-muted mb-sm">Note (optional)</Text>
            <TextInput
              value={values.description}
              onChangeText={(description) => onChange({ description })}
              placeholder="What is this transfer for?"
              placeholderTextColor={colors.muted}
              accessibilityLabel="Transfer note"
              className="px-4 py-3.5 rounded-xl text-foreground"
              style={{
                backgroundColor: colors.background,
                borderWidth: 0.5,
                borderColor: colors.border,
                fontSize: 15,
                minHeight: 44,
              }}
            />
          </View>

          <View>
            <Text className="text-label text-muted mb-sm">Date</Text>
            <TextInput
              value={values.date}
              onChangeText={(date) => onChange({ date })}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.muted}
              accessibilityLabel="Transfer date"
              className="px-4 py-3.5 rounded-xl text-foreground"
              style={{
                backgroundColor: colors.background,
                borderWidth: 0.5,
                borderColor: colors.border,
                fontSize: 15,
                minHeight: 44,
              }}
            />
          </View>

          <View className="flex-row gap-md">
            <View className="flex-1">
              <Button variant="secondary" label="Cancel" onPress={onClose} />
            </View>
            <View className="flex-1">
              <Button
                variant="primary"
                label="Transfer"
                onPress={onSubmit}
                loading={saving}
                disabled={!formValid || saving}
                accessibilityLabel="Confirm transfer"
                testID="confirm-transfer-button"
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </Sheet>
  );
}

function ReassignAccountSheet({
  visible,
  sourceAccount,
  candidates,
  selectedTargetId,
  onSelectTarget,
  onClose,
  onConfirm,
  confirming,
}: {
  visible: boolean;
  sourceAccount: Account | null;
  candidates: Account[];
  selectedTargetId: number | null;
  onSelectTarget: (id: number) => void;
  onClose: () => void;
  onConfirm: () => void;
  confirming: boolean;
}) {
  const colors = useColors();

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Move activity"
      testID="reassign-account-sheet"
    >
      <View className="px-lg pb-lg">
        <Text className="text-body text-muted mb-lg">
          {sourceAccount
            ? `"${sourceAccount.name}" has linked transactions or transfers. Choose another account to move them to before deleting.`
            : "Choose another account to move linked transactions and transfers to before deleting."}
        </Text>
        {candidates.map((account) => {
          const selected = account.id === selectedTargetId;
          return (
            <Pressable
              key={account.id}
              onPress={() => onSelectTarget(account.id)}
              accessibilityRole="button"
              accessibilityLabel={`Move transactions to ${account.name}${selected ? ", selected" : ""}`}
              accessibilityState={{ selected }}
              className="flex-row items-center rounded-xl px-md mb-sm"
              style={{
                minHeight: 44,
                backgroundColor: selected
                  ? colors.primary + "14"
                  : colors.background,
                borderWidth: 0.5,
                borderColor: selected ? colors.primary : colors.border,
              }}
            >
              <Text className="flex-1 text-body font-medium text-foreground">
                {account.name}
              </Text>
              {selected ? (
                <Ionicons name="checkmark" size={20} color={colors.primary} />
              ) : null}
            </Pressable>
          );
        })}
        <View className="flex-row gap-md mt-lg">
          <View className="flex-1">
            <Button variant="secondary" label="Cancel" onPress={onClose} />
          </View>
          <View className="flex-1">
            <Button
              variant="destructive"
              label="Move and delete"
              onPress={onConfirm}
              loading={confirming}
              disabled={selectedTargetId == null || confirming}
              accessibilityLabel="Confirm move transactions and delete account, destructive action"
            />
          </View>
        </View>
      </View>
    </Sheet>
  );
}

export default function AccountsScreen() {
  const router = useRouter();
  const colors = useColors();
  const toast = useToast();
  const { currency: defaultCurrency } = useCurrency();
  const {
    accounts,
    loadingAccounts,
    refreshAccounts,
    refreshAccountBalances,
    getAccountBalance,
    loadingAccountBalances,
    addAccount,
    updateAccount,
    deleteAccount,
    reassignAndDeleteAccount,
    fetchAccountTransactionCount,
    fetchAccountTransferCount,
    addTransfer,
  } = useExpense();
  const {
    visible: confirmVisible,
    options: confirmOptions,
    confirm,
    onConfirm,
    onCancel,
  } = useConfirm();

  const [sheetMode, setSheetMode] = useState<SheetMode>(null);
  const [formValues, setFormValues] = useState<AccountFormValues>(EMPTY_FORM);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [currencyPickerVisible, setCurrencyPickerVisible] = useState(false);
  const [reassignVisible, setReassignVisible] = useState(false);
  const [reassignSource, setReassignSource] = useState<Account | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState<number | null>(null);
  const [reassigning, setReassigning] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [transferVisible, setTransferVisible] = useState(false);
  const [transferValues, setTransferValues] = useState(
    createDefaultTransferForm,
  );
  const [transferSaving, setTransferSaving] = useState(false);
  const [fromPickerVisible, setFromPickerVisible] = useState(false);
  const [toPickerVisible, setToPickerVisible] = useState(false);
  const transferSavingRef = useRef(false);

  const onRefresh = useCallback(async () => {
    await Promise.all([refreshAccounts(), refreshAccountBalances()]);
  }, [refreshAccounts, refreshAccountBalances]);
  const refreshProps = usePullToRefresh(onRefresh);

  const formValid = useMemo(() => isAccountFormValid(formValues), [formValues]);

  const reassignCandidates = useMemo(
    () =>
      reassignSource
        ? accounts.filter((account) => account.id !== reassignSource.id)
        : [],
    [accounts, reassignSource],
  );

  const transferFromAccount = useMemo(
    () => accounts.find((a) => a.id === transferValues.fromAccountId) ?? null,
    [accounts, transferValues.fromAccountId],
  );

  const transferDestinationAccounts = useMemo(() => {
    if (!transferFromAccount) {
      return accounts.filter((a) => a.id !== transferValues.fromAccountId);
    }
    return accounts.filter(
      (a) =>
        a.id !== transferValues.fromAccountId &&
        a.currency === transferFromAccount.currency,
    );
  }, [accounts, transferFromAccount, transferValues.fromAccountId]);

  const canTransfer = accounts.length >= 2;

  const resetForm = useCallback(() => {
    setSheetMode(null);
    setEditingAccount(null);
    setFormValues({
      ...EMPTY_FORM,
      currency: isSupportedCurrency(defaultCurrency) ? defaultCurrency : "USD",
    });
  }, [defaultCurrency]);

  const openAddSheet = useCallback(() => {
    setEditingAccount(null);
    setFormValues({
      ...EMPTY_FORM,
      currency: isSupportedCurrency(defaultCurrency) ? defaultCurrency : "USD",
    });
    setSheetMode("add");
  }, [defaultCurrency]);

  const openEditSheet = useCallback((account: Account) => {
    setEditingAccount(account);
    setFormValues({
      name: account.name,
      type: account.type,
      currency: isSupportedCurrency(account.currency)
        ? account.currency
        : "USD",
    });
    setSheetMode("edit");
  }, []);

  const closeSheet = useCallback(() => {
    resetForm();
  }, [resetForm]);

  const handleSave = async () => {
    if (savingRef.current) return;
    if (!formValid) {
      toast.show({
        type: "error",
        message: "Please fill in all fields correctly",
      });
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const payload = {
        name: formValues.name.trim(),
        type: formValues.type as AccountType,
        currency: formValues.currency,
      };
      if (sheetMode === "edit" && editingAccount) {
        await updateAccount(editingAccount.id, payload);
      } else {
        await addAccount(payload);
      }
      resetForm();
    } catch {
      return;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleDeletePress = useCallback(
    async (account: Account) => {
      let txCount: number;
      let transferCount: number;
      try {
        [txCount, transferCount] = await Promise.all([
          fetchAccountTransactionCount(account.id),
          fetchAccountTransferCount(account.id),
        ]);
      } catch {
        toast.show({
          type: "error",
          message: "Could not verify linked activity",
        });
        return;
      }

      const linkedCount = txCount + transferCount;

      if (linkedCount === 0) {
        const confirmed = await confirm({
          title: "Delete account",
          message: `Are you sure you want to delete "${account.name}"?`,
          destructive: true,
          confirmLabel: "Delete",
        });
        if (!confirmed) return;
        try {
          await deleteAccount(account.id);
        } catch {
          // deleteAccount rolled back + showed error toast
        }
        return;
      }

      const candidates = accounts.filter((item) => item.id !== account.id);
      if (candidates.length === 0) {
        toast.show({
          type: "error",
          message:
            "Create another account before deleting one with transactions or transfers",
        });
        return;
      }

      setReassignSource(account);
      setReassignTargetId(candidates[0]?.id ?? null);
      setReassignVisible(true);
    },
    [
      accounts,
      confirm,
      deleteAccount,
      fetchAccountTransactionCount,
      fetchAccountTransferCount,
      toast,
    ],
  );

  const handleConfirmReassign = useCallback(async () => {
    if (!reassignSource || reassignTargetId == null || reassigning) return;
    setReassigning(true);
    try {
      await reassignAndDeleteAccount(reassignSource.id, reassignTargetId);
      setReassignVisible(false);
      setReassignSource(null);
      setReassignTargetId(null);
    } catch {
      // reassignAndDeleteAccount rolled back + showed error toast
    } finally {
      setReassigning(false);
    }
  }, [reassignAndDeleteAccount, reassignSource, reassignTargetId, reassigning]);

  const openTransferSheet = useCallback(() => {
    setTransferValues(createDefaultTransferForm());
    setTransferVisible(true);
  }, []);

  const closeTransferSheet = useCallback(() => {
    setTransferVisible(false);
    setTransferValues(createDefaultTransferForm());
  }, []);

  const handleTransferSubmit = useCallback(async () => {
    if (transferSavingRef.current || !isTransferFormValid(transferValues))
      return;

    const date = parseDateInput(transferValues.date);
    if (
      !date ||
      transferValues.fromAccountId == null ||
      transferValues.toAccountId == null
    ) {
      toast.show({
        type: "error",
        message: "Please complete all transfer fields",
      });
      return;
    }

    transferSavingRef.current = true;
    setTransferSaving(true);
    try {
      await addTransfer({
        fromAccountId: transferValues.fromAccountId,
        toAccountId: transferValues.toAccountId,
        amount: transferValues.amount.trim(),
        description: transferValues.description.trim() || undefined,
        date,
      });
      closeTransferSheet();
    } catch {
      return;
    } finally {
      transferSavingRef.current = false;
      setTransferSaving(false);
    }
  }, [addTransfer, closeTransferSheet, toast, transferValues]);

  const sheetTitle = sheetMode === "edit" ? "Edit account" : "New account";

  return (
    <ScreenContainer className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl {...refreshProps} />}
      >
        <ResponsiveContent maxWidth={ContentMaxWidth.screen}>
          <ScreenHeader
            title="Accounts"
            subtitle={`${accounts.length} account${accounts.length !== 1 ? "s" : ""}`}
            accessibilityLabel="Accounts screen"
            leading={
              <Button
                variant="icon-only"
                accessibilityLabel="Go back"
                onPress={() => router.back()}
                leftIcon={
                  <Ionicons
                    name="chevron-back"
                    size={22}
                    color={colors.foreground}
                  />
                }
              />
            }
          />

          <View className="px-lg mt-md gap-md">
            {/* SP-067: the empty state already carries an "Add account" CTA, so
             * showing this one too put the same action on screen twice in two
             * different sizes. Only show it once there is a list to act on. */}
            {accounts.length > 0 ? (
              <Button
                variant="primary"
                label="Add account"
                leftIcon={<Ionicons name="add" size={18} color="white" />}
                onPress={openAddSheet}
                size="lg"
                testID="add-account-button"
              />
            ) : null}
            {canTransfer ? (
              <Button
                variant="secondary"
                label="Transfer"
                leftIcon={
                  <Ionicons
                    name="swap-horizontal"
                    size={18}
                    color={colors.primary}
                  />
                }
                onPress={openTransferSheet}
                size="lg"
                testID="transfer-button"
              />
            ) : null}
          </View>

          <View className="mt-md">
            {loadingAccounts ? (
              <View className="items-center justify-center py-20">
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : accounts.length > 0 ? (
              <FlatList
                data={accounts}
                keyExtractor={(item) => item.id.toString()}
                scrollEnabled={false}
                renderItem={({ item, index }) => (
                  <AccountRow
                    account={item}
                    balance={getAccountBalance(item.id)}
                    loadingBalance={loadingAccountBalances}
                    index={index}
                    onEdit={() => openEditSheet(item)}
                    onDelete={() => void handleDeletePress(item)}
                  />
                )}
              />
            ) : (
              <View className="mx-lg rounded-3xl overflow-hidden">
                <EmptyState
                  variant="no-data"
                  icon={
                    <Ionicons
                      name="wallet-outline"
                      size={28}
                      color={colors.muted}
                    />
                  }
                  title="No accounts yet"
                  description="Add an account to mirror where your money lives"
                  action={{ label: "Add account", onPress: openAddSheet }}
                />
              </View>
            )}
          </View>
        </ResponsiveContent>
      </ScrollView>

      <ConfirmSheet
        visible={confirmVisible}
        onConfirm={onConfirm}
        onCancel={onCancel}
        {...confirmOptions}
      />

      <Sheet
        visible={sheetMode !== null}
        onClose={closeSheet}
        title={sheetTitle}
        testID={
          sheetMode === "edit" ? "edit-account-sheet" : "add-account-sheet"
        }
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ flexShrink: 1 }}
          contentContainerStyle={{ gap: 16, paddingBottom: 24 }}
        >
          <View className="px-lg">
            <AccountFormFields
              values={formValues}
              onChange={(patch) =>
                setFormValues((prev) => ({ ...prev, ...patch }))
              }
              onOpenCurrencyPicker={() => setCurrencyPickerVisible(true)}
            />
          </View>
          <View className="px-lg flex-row gap-md">
            <View className="flex-1">
              <Button variant="secondary" label="Cancel" onPress={closeSheet} />
            </View>
            <View className="flex-1">
              <Button
                variant="primary"
                label="Save"
                onPress={() => void handleSave()}
                loading={saving}
                disabled={!formValid || saving}
                accessibilityLabel="Save account"
              />
            </View>
          </View>
        </ScrollView>
      </Sheet>

      <CurrencyPickerSheet
        visible={currencyPickerVisible}
        selected={formValues.currency}
        onClose={() => setCurrencyPickerVisible(false)}
        onSelect={(code) =>
          setFormValues((prev) => ({ ...prev, currency: code }))
        }
      />

      <ReassignAccountSheet
        visible={reassignVisible}
        sourceAccount={reassignSource}
        candidates={reassignCandidates}
        selectedTargetId={reassignTargetId}
        onSelectTarget={setReassignTargetId}
        onClose={() => {
          setReassignVisible(false);
          setReassignSource(null);
          setReassignTargetId(null);
        }}
        onConfirm={() => void handleConfirmReassign()}
        confirming={reassigning}
      />

      <TransferFormSheet
        visible={transferVisible}
        values={transferValues}
        accounts={accounts}
        onChange={(patch) =>
          setTransferValues((prev) => {
            const next = { ...prev, ...patch };
            if (
              patch.fromAccountId != null &&
              patch.fromAccountId === next.toAccountId
            ) {
              next.toAccountId = null;
            }
            if (patch.fromAccountId != null) {
              const from = accounts.find((a) => a.id === patch.fromAccountId);
              if (
                from &&
                next.toAccountId != null &&
                accounts.find((a) => a.id === next.toAccountId)?.currency !==
                  from.currency
              ) {
                next.toAccountId = null;
              }
            }
            return next;
          })
        }
        onClose={closeTransferSheet}
        onSubmit={() => void handleTransferSubmit()}
        saving={transferSaving}
        onOpenFromPicker={() => setFromPickerVisible(true)}
        onOpenToPicker={() => setToPickerVisible(true)}
      />

      <AccountPickerSheet
        visible={fromPickerVisible}
        title="Source account"
        accounts={accounts}
        selectedId={transferValues.fromAccountId}
        onClose={() => setFromPickerVisible(false)}
        onSelect={(id) =>
          setTransferValues((prev) => ({
            ...prev,
            fromAccountId: id,
            toAccountId: prev.toAccountId === id ? null : prev.toAccountId,
          }))
        }
        testID="transfer-from-picker-sheet"
      />

      <AccountPickerSheet
        visible={toPickerVisible}
        title="Destination account"
        accounts={transferDestinationAccounts}
        selectedId={transferValues.toAccountId}
        onClose={() => setToPickerVisible(false)}
        onSelect={(id) =>
          setTransferValues((prev) => ({ ...prev, toAccountId: id }))
        }
        testID="transfer-to-picker-sheet"
      />
    </ScreenContainer>
  );
}

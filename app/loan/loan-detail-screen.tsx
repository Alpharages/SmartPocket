import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Animated, FadeInDown, FadeInUp } from "@/lib/motion";

import { ScreenContainer } from "@/components/screen-container";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatCard } from "@/components/ui/StatCard";
import { useColors } from "@/hooks/use-colors";
import { useCurrency } from "@/lib/currency-provider";
import { formatCurrency } from "@/lib/currency";
import {
  formatLoanCounterparty,
  formatLoanDirection,
  formatLoanSchedule,
  formatNextDueLabel,
  formatRepaymentDate,
  parseLoanRouteId,
  parseMoneyAmount,
} from "@/lib/loan-detail";
import { useLoanDetail, useExpense } from "@/lib/expense-context";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { confirmDestructive } from "@/lib/confirm-dialog";

function BackHeader({
  title,
  onBack,
  onDelete,
}: {
  title: string;
  onBack: () => void;
  onDelete?: () => void;
}) {
  const colors = useColors();

  return (
    <View className="flex-row items-center px-6 pt-6 pb-2">
      <Pressable
        onPress={onBack}
        hitSlop={8}
        // SP-086: see card-detail-screen — missing role meant no exposed
        // button, and className sizing does not apply to Pressable here.
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={{
          backgroundColor: colors.surface,
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="chevron-back" size={22} color={colors.foreground} />
      </Pressable>
      <Text
        className="flex-1 text-center text-h1 text-foreground"
        numberOfLines={1}
      >
        {title}
      </Text>
      {/* SP-018: loans could be created but never edited or deleted, so an
       * erroneous loan was permanent and kept generating due reminders. */}
      {onDelete ? (
        <Pressable
          onPress={onDelete}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Delete loan"
          testID="delete-loan-button"
          // SP-091: NativeWind className is disabled on Pressable in this app,
          // so `w-10 h-10` never applied and the control rendered at 40x40 —
          // under the 44x44 minimum. Size it in `style`.
          style={{
            backgroundColor: colors.error + "14",
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </Pressable>
      ) : (
        <View className="w-10 h-10" />
      )}
    </View>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const colors = useColors();

  return (
    <View
      className="rounded-3xl p-5 mb-4"
      style={{
        backgroundColor: colors.surface,
        borderWidth: 0.5,
        borderColor: colors.border,
      }}
    >
      <Text className="text-sm font-semibold text-muted mb-3 uppercase tracking-wide">
        {title}
      </Text>
      {children}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between items-start gap-4 mb-3">
      <Text className="text-sm text-muted flex-1">{label}</Text>
      <Text
        className="text-sm font-semibold text-foreground flex-1 text-right"
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

export default function LoanDetailScreen() {
  const router = useRouter();
  const colors = useColors();
  const { currency } = useCurrency();
  const { id } = useLocalSearchParams<{ id: string }>();
  const loanId = parseLoanRouteId(id);
  const { loanDetail, loadingLoanDetail, loanDetailError, refreshLoanDetail } =
    useLoanDetail(loanId);
  const { refreshLoans, deleteLoan } = useExpense();

  const handleDelete = useCallback(async () => {
    if (Number.isNaN(loanId)) return;
    const confirmed = await confirmDestructive({
      title: "Delete loan?",
      message:
        "This removes the loan and its repayment history. This cannot be undone.",
    });
    if (!confirmed) return;
    try {
      await deleteLoan(loanId);
      router.back();
    } catch {
      // context showed the error toast
    }
  }, [deleteLoan, loanId, router]);

  const onRefresh = useCallback(async () => {
    await Promise.all([refreshLoanDetail(), refreshLoans()]);
  }, [refreshLoanDetail, refreshLoans]);
  const refreshProps = usePullToRefresh(onRefresh);

  const title = useMemo(
    () =>
      loanDetail
        ? formatLoanCounterparty(loanDetail.counterparty)
        : "Loan detail",
    [loanDetail],
  );

  const nextDue = useMemo(
    () =>
      loanDetail
        ? formatNextDueLabel(loanDetail.nextDueDate, loanDetail.status)
        : null,
    [loanDetail],
  );

  if (Number.isNaN(loanId)) {
    return (
      <ScreenContainer
        className="flex-1 bg-background"
        edges={["top", "left", "right", "bottom"]}
        testID="loan-detail-invalid"
      >
        <BackHeader title="Loan detail" onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="search-outline" size={32} color={colors.muted} />
          <Text className="mt-3 text-muted font-medium text-sm">
            Loan not found
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  if (loadingLoanDetail) {
    return (
      <ScreenContainer
        className="flex-1 bg-background"
        edges={["top", "left", "right", "bottom"]}
        testID="loan-detail-loading"
      >
        <BackHeader title={title} onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (loanDetailError || !loanDetail) {
    return (
      <ScreenContainer
        className="flex-1 bg-background"
        edges={["top", "left", "right", "bottom"]}
        testID="loan-detail-not-found"
      >
        <BackHeader title="Loan detail" onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="search-outline" size={32} color={colors.muted} />
          <Text className="mt-3 text-muted font-medium text-sm">
            Loan not found
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  const repayments = [...loanDetail.repayments].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return (
    <ScreenContainer
      className="flex-1 bg-background"
      edges={["top", "left", "right", "bottom"]}
      testID="loan-detail-screen"
    >
      <BackHeader
        title={title}
        onBack={() => router.back()}
        onDelete={() => void handleDelete()}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
        refreshControl={<RefreshControl {...refreshProps} />}
      >
        <Animated.View entering={FadeInUp.delay(100).duration(400)}>
          <View className="flex-row items-center gap-2 mb-4">
            <View
              className="px-3 py-1.5 rounded-full"
              style={{
                backgroundColor:
                  loanDetail.direction === "lend"
                    ? colors.success
                    : colors.warning,
              }}
            >
              <Text className="text-xs font-bold text-white">
                {formatLoanDirection(loanDetail.direction)}
              </Text>
            </View>
            <Text className="text-sm text-muted capitalize">
              {loanDetail.status}
            </Text>
          </View>

          <StatCard
            variant="hero"
            label="Remaining balance"
            amount={parseMoneyAmount(loanDetail.remainingBalance)}
            loading={false}
            accessibilityLabel={`Remaining balance ${formatCurrency(parseMoneyAmount(loanDetail.remainingBalance), currency)}`}
          />

          <View className="flex-row gap-3 mt-3">
            <View className="flex-1">
              <StatCard
                variant="compact"
                label="Principal"
                amount={parseMoneyAmount(loanDetail.principal)}
              />
            </View>
            <View className="flex-1">
              <StatCard
                variant="compact"
                label="Repaid"
                amount={
                  parseMoneyAmount(loanDetail.principal) -
                  parseMoneyAmount(loanDetail.remainingBalance)
                }
                sign="neutral"
              />
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(150).duration(400)}>
          <DetailSection title="Schedule">
            <DetailRow
              label="Schedule"
              value={formatLoanSchedule(loanDetail)}
            />
            <DetailRow
              label="Rate"
              value={
                loanDetail.rate != null && loanDetail.rate !== ""
                  ? `${loanDetail.rate}%`
                  : "Not set"
              }
            />
            <View className="flex-row justify-between items-center gap-4">
              <Text className="text-sm text-muted flex-1">Next due</Text>
              <View className="flex-row items-center gap-1.5 flex-1 justify-end">
                {nextDue?.overdue ? (
                  <Ionicons
                    name="alert-circle"
                    size={16}
                    color={colors.error}
                    accessibilityLabel="Overdue"
                  />
                ) : null}
                <Text
                  className="text-sm font-semibold text-right"
                  style={{
                    color: nextDue?.overdue ? colors.error : colors.foreground,
                  }}
                  accessibilityLabel={`Next due ${nextDue?.label ?? "—"}`}
                >
                  {nextDue?.label ?? "—"}
                </Text>
              </View>
            </View>
          </DetailSection>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <Pressable
            onPress={() =>
              router.push(`/loan/record-repayment?id=${loanDetail.id}`)
            }
            disabled={loanDetail.status === "settled"}
            accessibilityRole="button"
            accessibilityLabel="Record repayment"
            testID="record-repayment-button"
            className="mb-4 rounded-2xl py-4 items-center"
            style={{
              // SP-096: className padding is inert on Pressable — size in style.
              paddingVertical: 16,
              minHeight: 44,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor:
                loanDetail.status === "settled" ? colors.muted : colors.primary,
              opacity: loanDetail.status === "settled" ? 0.5 : 1,
            }}
          >
            <Text className="text-base font-semibold text-white">
              Record repayment
            </Text>
          </Pressable>

          <DetailSection title="Repayment history">
            {repayments.length > 0 ? (
              repayments.map((repayment, index) => (
                <View
                  key={repayment.id}
                  testID={`repayment-row-${index}`}
                  className="py-3"
                  style={{
                    borderTopWidth: index === 0 ? 0 : 0.5,
                    borderTopColor: colors.border,
                  }}
                  accessibilityLabel={`Repayment ${formatCurrency(parseMoneyAmount(repayment.amount), currency)} on ${formatRepaymentDate(repayment.date)}`}
                >
                  <View className="flex-row items-center justify-between gap-3">
                    <Text className="text-base font-semibold text-foreground">
                      {formatCurrency(
                        parseMoneyAmount(repayment.amount),
                        currency,
                      )}
                    </Text>
                    <Text className="text-sm text-muted">
                      {formatRepaymentDate(repayment.date)}
                    </Text>
                  </View>
                  {repayment.note?.trim() ? (
                    <Text className="text-sm text-muted mt-1" numberOfLines={2}>
                      {repayment.note.trim()}
                    </Text>
                  ) : null}
                </View>
              ))
            ) : (
              <EmptyState
                variant="no-data"
                icon={
                  <Ionicons
                    name="receipt-outline"
                    size={28}
                    color={colors.muted}
                  />
                }
                title="No repayments yet"
                description="Payments logged against this loan will appear here"
              />
            )}
          </DetailSection>
        </Animated.View>
      </ScrollView>
    </ScreenContainer>
  );
}

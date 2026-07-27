import React, { useCallback, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { Button } from "@/components/ui/Button";
import { FilterChipGroup } from "@/components/ui/FilterChipGroup";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SettingsRow } from "@/components/ui/SettingsRow";
import { Sheet } from "@/components/ui/Sheet";
import { ThemePickerControl } from "@/components/ui/ThemePicker";
import { useToast } from "@/components/ui/ToastProvider";
import { getAppMetadata } from "@/lib/app-metadata";
import { toTransactionCsv, transactionToExportRow } from "@/lib/csv-export";
import {
  toTransactionJson,
  transactionToJsonExportRow,
} from "@/lib/json-export";
import {
  CURRENCIES,
  getCurrencyLabel,
  type CurrencyCode,
} from "@/lib/currency";
import { useCurrency } from "@/lib/currency-provider";
import { formatIsoDate } from "@/lib/date-utils";
import {
  FIRST_DAY_OF_WEEK_OPTIONS,
  getFirstDayOfWeekLabel,
  type FirstDayOfWeek,
} from "@/lib/first-day-of-week";
import { useFirstDayOfWeek } from "@/lib/first-day-of-week-provider";
import { useSettings } from "@/lib/settings-provider";
import { shareFile } from "@/lib/share-file";
import {
  THEME_PREFERENCE_OPTIONS,
  type ThemePreference,
} from "@/lib/theme-preference";
import { useThemeContext } from "@/lib/theme-provider";
import { useExpense } from "@/lib/expense-context";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/lib/_core/theme";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import type { ThemeId } from "@/constants/theme";

const AI_EXPLANATION =
  "Lets SmartPocket suggest categories and answer questions about your spending. Your data is only sent for AI when this is on.";

function SettingsSectionGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const colors = useColors();

  return (
    <View className="mt-xl">
      <Text className="px-lg mb-sm text-caption font-semibold uppercase text-muted">
        {title}
      </Text>
      <View
        className="mx-lg rounded-2xl overflow-hidden"
        style={{
          backgroundColor: colors.surface,
          borderWidth: 0.5,
          borderColor: colors.border,
        }}
      >
        {children}
      </View>
    </View>
  );
}

function SectionDivider() {
  const colors = useColors();
  return (
    <View
      className="mx-lg"
      style={{ height: 0.5, backgroundColor: colors.border }}
    />
  );
}

function FirstDayOfWeekPickerSheet({
  visible,
  onClose,
  selected,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  selected: FirstDayOfWeek;
  onSelect: (day: FirstDayOfWeek) => void;
}) {
  const colors = useColors();

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="First day of week"
      testID="first-day-picker-sheet"
    >
      {FIRST_DAY_OF_WEEK_OPTIONS.map((entry) => {
        const isActive = entry.value === selected;
        return (
          <Pressable
            key={entry.value}
            onPress={() => {
              onSelect(entry.value);
              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel={`${entry.label}${isActive ? ", selected" : ""}`}
            accessibilityState={{ selected: isActive }}
            className="flex-row items-center px-lg"
            style={{ minHeight: 44 }}
          >
            <Text className="flex-1 text-body font-medium text-foreground">
              {entry.label}
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

function ThemePreferenceControl({
  value,
  onChange,
}: {
  value: ThemePreference;
  onChange: (preference: ThemePreference) => void;
}) {
  return (
    <View className="px-lg py-md" accessibilityLabel="Theme options">
      <Text className="mb-sm text-body font-medium text-foreground">
        Appearance mode
      </Text>
      <FilterChipGroup
        mode="single"
        value={value}
        onChange={onChange}
        options={[...THEME_PREFERENCE_OPTIONS]}
        contentContainerStyle={{ paddingHorizontal: 0 }}
      />
    </View>
  );
}

function AiToggleControl({
  enabled,
  disabled,
  onChange,
}: {
  enabled: boolean;
  disabled?: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const colors = useColors();

  return (
    <View
      className="flex-row items-center px-lg py-md"
      style={{ minHeight: 44 }}
    >
      <View className="flex-1 pr-md">
        <Text className="text-body font-medium text-foreground">
          AI features
        </Text>
        <Text className="mt-xs text-caption text-muted">{AI_EXPLANATION}</Text>
      </View>
      <Switch
        value={enabled}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.surface}
        accessibilityRole="switch"
        accessibilityLabel="AI features"
        accessibilityHint={AI_EXPLANATION}
        accessibilityState={{ checked: enabled }}
      />
    </View>
  );
}

type ExportRange = "all" | "thisMonth" | "custom";

function ExportSheet({
  visible,
  onClose,
  format,
  currency,
}: {
  visible: boolean;
  onClose: () => void;
  format: "csv" | "json";
  currency: CurrencyCode;
}) {
  const colors = useColors();
  const toast = useToast();
  const { transactions, categories, creditCards } = useExpense();
  const [range, setRange] = useState<ExportRange>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [exporting, setExporting] = useState(false);
  const isJson = format === "json";
  const label = isJson ? "JSON" : "CSV";

  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const now = new Date();
      let rows = [...transactions];

      if (range === "thisMonth") {
        // Compare ISO date strings to avoid UTC/local boundary issues
        const monthStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        rows = rows.filter((t) => {
          const d = t.date instanceof Date ? t.date : new Date(t.date);
          return formatIsoDate(d) >= monthStartStr;
        });
      } else if (range === "custom") {
        // Parse as local time (no timezone suffix) to avoid UTC midnight offset (B1)
        const startDate = new Date(`${customStart}T00:00:00`);
        const endDate = new Date(`${customEnd}T23:59:59`);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          toast.show({
            type: "error",
            message: "Invalid date — use YYYY-MM-DD",
          });
          return;
        }
        if (startDate > endDate) {
          toast.show({
            type: "error",
            message: "Start date must be before end date",
          });
          return;
        }

        const startStr = formatIsoDate(startDate);
        const endStr = formatIsoDate(endDate);
        rows = rows.filter((t) => {
          const d = t.date instanceof Date ? t.date : new Date(t.date);
          const iso = formatIsoDate(d);
          return iso >= startStr && iso <= endStr;
        });
      }

      if (rows.length === 0) {
        toast.show({ type: "error", message: "Nothing to export" });
        return;
      }

      const today = formatIsoDate(now);
      if (isJson) {
        const exportRows = rows.map((t) =>
          transactionToJsonExportRow(t, categories, creditCards),
        );
        await shareFile(
          `smartpocket-transactions-${today}.json`,
          toTransactionJson(exportRows, { currency }),
          "application/json",
          "public.json",
        );
      } else {
        const exportRows = rows.map((t) =>
          transactionToExportRow(t, categories, creditCards),
        );
        await shareFile(
          `smartpocket-transactions-${today}.csv`,
          toTransactionCsv(exportRows),
          "text/csv",
        );
      }
      toast.show({ type: "success", message: "Export complete" });
      onClose();
    } catch {
      toast.show({ type: "error", message: "Export failed" });
    } finally {
      setExporting(false);
    }
  }, [
    exporting,
    transactions,
    categories,
    creditCards,
    range,
    customStart,
    customEnd,
    toast,
    onClose,
    isJson,
    currency,
  ]);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={`Export to ${label}`}
      testID={`export-${format}-sheet`}
    >
      <View className="px-lg pb-lg">
        <Text className="mb-sm text-body font-medium text-foreground">
          Date range
        </Text>
        <FilterChipGroup
          mode="single"
          value={range}
          onChange={(v) => setRange(v as ExportRange)}
          options={[
            { label: "All", value: "all" },
            { label: "This month", value: "thisMonth" },
            { label: "Custom", value: "custom" },
          ]}
          contentContainerStyle={{ paddingHorizontal: 0 }}
        />

        {range === "custom" ? (
          <View className="mt-md gap-sm">
            <View>
              <Text className="mb-xs text-caption text-muted">
                Start (YYYY-MM-DD)
              </Text>
              <TextInput
                value={customStart}
                onChangeText={setCustomStart}
                placeholder="2026-01-01"
                placeholderTextColor={colors.muted}
                style={{
                  color: colors.foreground,
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  fontSize: 14,
                }}
                accessibilityLabel="Export start date"
              />
            </View>
            <View>
              <Text className="mb-xs text-caption text-muted">
                End (YYYY-MM-DD)
              </Text>
              <TextInput
                value={customEnd}
                onChangeText={setCustomEnd}
                placeholder="2026-12-31"
                placeholderTextColor={colors.muted}
                style={{
                  color: colors.foreground,
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  fontSize: 14,
                }}
                accessibilityLabel="Export end date"
              />
            </View>
          </View>
        ) : null}

        <View className="mt-lg">
          <Button
            label="Export"
            onPress={handleExport}
            loading={exporting}
            disabled={exporting}
            accessibilityLabel={`Export transactions to ${label}`}
          />
        </View>
      </View>
    </Sheet>
  );
}

function ClearDataConfirmationSheet({
  visible,
  onClose,
  onConfirm,
  clearing,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  clearing: boolean;
}) {
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Clear all data?"
      testID="clear-data-confirmation-sheet"
    >
      <View className="px-lg pb-lg">
        <Text className="mb-lg text-body text-muted">
          This permanently deletes all transactions, categories, accounts, and
          credit cards. This action cannot be undone.
        </Text>
        <View className="flex-row gap-md">
          <View className="flex-1">
            <Button
              variant="secondary"
              label="Cancel"
              onPress={onClose}
              disabled={clearing}
            />
          </View>
          <View className="flex-1">
            <Button
              variant="destructive"
              label="Clear all data"
              onPress={onConfirm}
              loading={clearing}
              disabled={clearing}
              accessibilityLabel="Confirm clear all data, destructive action"
            />
          </View>
        </View>
      </View>
    </Sheet>
  );
}

function CurrencyPickerSheet({
  visible,
  onClose,
  selected,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  selected: CurrencyCode;
  onSelect: (code: CurrencyCode) => void;
}) {
  const colors = useColors();

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Currency"
      testID="currency-picker-sheet"
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

export default function SettingsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { currency, setCurrency } = useCurrency();
  const { firstDayOfWeek, setFirstDayOfWeek } = useFirstDayOfWeek();
  const { themePreference, setThemePreference } = useThemeContext();
  const { themeId, setThemeId } = useTheme();
  const { aiEnabled, setAiEnabled, isSavingAi, refreshSettings } =
    useSettings();
  const { clearAllData, refreshAll } = useExpense();
  const { user, logout } = useAuth();
  const [currencySheetVisible, setCurrencySheetVisible] = useState(false);
  const [firstDaySheetVisible, setFirstDaySheetVisible] = useState(false);
  const [clearDataSheetVisible, setClearDataSheetVisible] = useState(false);
  const [clearingData, setClearingData] = useState(false);
  const [exportCsvSheetVisible, setExportCsvSheetVisible] = useState(false);
  const [exportJsonSheetVisible, setExportJsonSheetVisible] = useState(false);
  const [signOutSheetVisible, setSignOutSheetVisible] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const { name: appName, version: appVersion } = getAppMetadata();

  const onRefresh = useCallback(async () => {
    await Promise.all([refreshSettings(), refreshAll()]);
  }, [refreshSettings, refreshAll]);
  const refreshProps = usePullToRefresh(onRefresh);

  const handleSelectCurrency = useCallback(
    (code: CurrencyCode) => {
      void setCurrency(code);
    },
    [setCurrency],
  );

  const handleSelectFirstDay = useCallback(
    (day: FirstDayOfWeek) => {
      void setFirstDayOfWeek(day);
    },
    [setFirstDayOfWeek],
  );

  const handleSelectTheme = useCallback(
    (preference: ThemePreference) => {
      void setThemePreference(preference);
    },
    [setThemePreference],
  );

  const handleSelectThemeId = useCallback(
    (id: ThemeId) => {
      void setThemeId(id);
    },
    [setThemeId],
  );

  const handleToggleAi = useCallback(
    (enabled: boolean) => {
      void setAiEnabled(enabled);
    },
    [setAiEnabled],
  );

  const firstDayLabel = getFirstDayOfWeekLabel(firstDayOfWeek);

  const handleConfirmClearData = useCallback(async () => {
    if (clearingData) return;
    setClearingData(true);
    try {
      await clearAllData();
      setClearDataSheetVisible(false);
    } catch {
      // Toast is shown by expense context; keep the sheet open for retry.
    } finally {
      setClearingData(false);
    }
  }, [clearAllData, clearingData]);

  const handleConfirmSignOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout();
      setSignOutSheetVisible(false);
      router.replace("/login");
    } finally {
      setSigningOut(false);
    }
  }, [logout, router, signingOut]);

  return (
    <ScreenContainer className="flex-1 bg-background">
      <ScreenHeader
        title="Settings"
        accessibilityLabel="Settings screen"
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Spacing["2xl"] }}
        refreshControl={<RefreshControl {...refreshProps} />}
      >
        <SettingsSectionGroup title="Preferences">
          <SettingsRow
            icon="cash-outline"
            label="Currency"
            trailingValue={currency}
            onPress={() => setCurrencySheetVisible(true)}
            accessibilityLabel={`Currency, ${currency}`}
          />
          <SectionDivider />
          <SettingsRow
            icon="calendar-outline"
            label="First day of week"
            trailingValue={firstDayLabel}
            onPress={() => setFirstDaySheetVisible(true)}
            accessibilityLabel={`First day of week, ${firstDayLabel}`}
          />
        </SettingsSectionGroup>

        <SettingsSectionGroup title="Appearance">
          <ThemePickerControl value={themeId} onChange={handleSelectThemeId} />
          <SectionDivider />
          <ThemePreferenceControl
            value={themePreference}
            onChange={handleSelectTheme}
          />
        </SettingsSectionGroup>

        <SettingsSectionGroup title="Manage">
          <SettingsRow
            icon="wallet-outline"
            label="Accounts"
            onPress={() => router.push("/accounts")}
            accessibilityLabel="Accounts"
          />
          <SectionDivider />
          <SettingsRow
            icon="grid-outline"
            label="Categories"
            onPress={() => router.push("/categories")}
            accessibilityLabel="Categories"
          />
          <SectionDivider />
          <SettingsRow
            icon="pie-chart-outline"
            label="Budgets"
            onPress={() => router.push("/budgets")}
            accessibilityLabel="Budgets"
          />
          <SectionDivider />
          <SettingsRow
            icon="repeat-outline"
            label="Recurring transactions"
            onPress={() => router.push("/recurring")}
            accessibilityLabel="Recurring transactions"
          />
        </SettingsSectionGroup>

        <SettingsSectionGroup title="Data Management">
          <SettingsRow
            icon="download-outline"
            label="Export to CSV"
            onPress={() => setExportCsvSheetVisible(true)}
            accessibilityLabel="Export to CSV"
          />
          <SectionDivider />
          <SettingsRow
            icon="cloud-upload-outline"
            label="Import from CSV"
            onPress={() => router.push("/import-csv" as Href)}
            accessibilityLabel="Import from CSV"
          />
          <SectionDivider />
          <SettingsRow
            icon="download-outline"
            label="Export to JSON"
            onPress={() => setExportJsonSheetVisible(true)}
            accessibilityLabel="Export to JSON"
          />

          <SectionDivider />
          <SettingsRow
            icon="trash-outline"
            label="Clear all data"
            destructive
            onPress={() => setClearDataSheetVisible(true)}
            accessibilityLabel="Clear all data, destructive action"
          />
        </SettingsSectionGroup>

        <SettingsSectionGroup title="AI">
          <AiToggleControl
            enabled={aiEnabled}
            disabled={isSavingAi}
            onChange={handleToggleAi}
          />
        </SettingsSectionGroup>

        <SettingsSectionGroup title="Account">
          {user ? (
            <>
              <SettingsRow
                icon="person-circle-outline"
                label={user.name ?? "Signed in"}
                trailingValue={user.email ?? undefined}
                showChevron={false}
                disabled
                accessibilityLabel={`Signed in as ${user.name ?? user.email ?? "user"}`}
              />
              <SectionDivider />
            </>
          ) : null}
          <SettingsRow
            icon="log-out-outline"
            label="Sign out"
            destructive
            onPress={() => setSignOutSheetVisible(true)}
            accessibilityLabel="Sign out"
          />
        </SettingsSectionGroup>

        <SettingsSectionGroup title="About">
          <SettingsRow
            icon="information-circle-outline"
            label={appName}
            trailingValue={appVersion}
            showChevron={false}
            disabled
            accessibilityLabel={`${appName}, version ${appVersion}`}
          />
        </SettingsSectionGroup>
      </ScrollView>

      <CurrencyPickerSheet
        visible={currencySheetVisible}
        onClose={() => setCurrencySheetVisible(false)}
        selected={currency}
        onSelect={handleSelectCurrency}
      />
      <FirstDayOfWeekPickerSheet
        visible={firstDaySheetVisible}
        onClose={() => setFirstDaySheetVisible(false)}
        selected={firstDayOfWeek}
        onSelect={handleSelectFirstDay}
      />
      <ClearDataConfirmationSheet
        visible={clearDataSheetVisible}
        onClose={() => setClearDataSheetVisible(false)}
        onConfirm={handleConfirmClearData}
        clearing={clearingData}
      />
      <ExportSheet
        visible={exportCsvSheetVisible}
        onClose={() => setExportCsvSheetVisible(false)}
        format="csv"
        currency={currency}
      />
      <Sheet
        visible={signOutSheetVisible}
        onClose={() => setSignOutSheetVisible(false)}
        title="Sign out?"
        testID="sign-out-sheet"
      >
        <View className="px-lg pb-lg">
          <Text className="mb-lg text-body text-muted">
            You will need to sign in again to reach your data. Nothing is
            deleted.
          </Text>
          <View className="flex-row gap-md">
            <View className="flex-1">
              <Button
                variant="secondary"
                label="Cancel"
                onPress={() => setSignOutSheetVisible(false)}
                disabled={signingOut}
              />
            </View>
            <View className="flex-1">
              <Button
                variant="destructive"
                label="Sign out"
                onPress={handleConfirmSignOut}
                loading={signingOut}
                disabled={signingOut}
                accessibilityLabel="Confirm sign out"
              />
            </View>
          </View>
        </View>
      </Sheet>

      <ExportSheet
        visible={exportJsonSheetVisible}
        onClose={() => setExportJsonSheetVisible(false)}
        format="json"
        currency={currency}
      />
    </ScreenContainer>
  );
}

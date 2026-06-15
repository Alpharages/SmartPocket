import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { Button } from "@/components/ui/Button";
import { FilterChipGroup } from "@/components/ui/FilterChipGroup";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SettingsRow } from "@/components/ui/SettingsRow";
import { Sheet } from "@/components/ui/Sheet";
import { getAppMetadata } from "@/lib/app-metadata";
import {
  CURRENCIES,
  getCurrencyLabel,
  type CurrencyCode,
} from "@/lib/currency";
import { useCurrency } from "@/lib/currency-provider";
import {
  FIRST_DAY_OF_WEEK_OPTIONS,
  getFirstDayOfWeekLabel,
  type FirstDayOfWeek,
} from "@/lib/first-day-of-week";
import { useFirstDayOfWeek } from "@/lib/first-day-of-week-provider";
import { useSettings } from "@/lib/settings-provider";
import {
  THEME_PREFERENCE_OPTIONS,
  type ThemePreference,
} from "@/lib/theme-preference";
import { useThemeContext } from "@/lib/theme-provider";
import { useExpense } from "@/lib/expense-context";
import { useColors } from "@/hooks/use-colors";
import { Spacing } from "@/lib/_core/theme";

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
      <Text className="mb-sm text-body font-medium text-foreground">Theme</Text>
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
        <Text className="text-body font-medium text-foreground">AI features</Text>
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
          This permanently deletes all transactions, categories, and credit cards. This
          action cannot be undone.
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
    <Sheet visible={visible} onClose={onClose} title="Currency" testID="currency-picker-sheet">
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
  const { aiEnabled, setAiEnabled, isSavingAi } = useSettings();
  const { clearAllData } = useExpense();
  const [currencySheetVisible, setCurrencySheetVisible] = useState(false);
  const [firstDaySheetVisible, setFirstDaySheetVisible] = useState(false);
  const [clearDataSheetVisible, setClearDataSheetVisible] = useState(false);
  const [clearingData, setClearingData] = useState(false);

  const { name: appName, version: appVersion } = getAppMetadata();

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

  return (
    <ScreenContainer className="flex-1 bg-background">
      <ScreenHeader
        title="Settings"
        accessibilityLabel="Settings screen"
        action={
          <Button
            variant="icon-only"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            leftIcon={
              <Ionicons name="chevron-back" size={22} color={colors.foreground} />
            }
          />
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Spacing["2xl"] }}
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
          <SectionDivider />
          <ThemePreferenceControl
            value={themePreference}
            onChange={handleSelectTheme}
          />
        </SettingsSectionGroup>

        <SettingsSectionGroup title="Data Management">
          <SettingsRow
            icon="download-outline"
            label="Export data"
            comingSoon
            accessibilityLabel="Export data, coming soon"
          />
          <SectionDivider />
          <SettingsRow
            icon="cloud-upload-outline"
            label="Backup"
            comingSoon
            accessibilityLabel="Backup, coming soon"
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
    </ScreenContainer>
  );
}

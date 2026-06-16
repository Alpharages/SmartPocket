import React, { useCallback, useMemo } from "react";
import { ScrollView, View, type StyleProp, type ViewStyle } from "react-native";

import { Pill } from "./Pill";

export type ChipOption<T> = {
  value: T;
  label: string;
  disabled?: boolean;
  count?: number;
  leftIcon?: React.ReactNode;
};

type BaseFilterChipGroupProps<T> = {
  options: ChipOption<T>[];
  className?: string;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

type SingleSelectProps<T> = BaseFilterChipGroupProps<T> & {
  mode: "single";
  value: T | undefined;
  onChange: (value: T) => void;
};

type MultiSelectProps<T> = BaseFilterChipGroupProps<T> & {
  mode: "multi";
  value: T[];
  onChange: (value: T[]) => void;
};

export type FilterChipGroupProps<T> =
  | SingleSelectProps<T>
  | MultiSelectProps<T>;

export function FilterChipGroup<T>({
  options,
  mode,
  value,
  onChange,
  className,
  style,
  contentContainerStyle,
}: FilterChipGroupProps<T>) {
  const selectedSet = useMemo(() => {
    if (mode === "multi") {
      return new Set(value);
    }
    return new Set(value !== undefined ? [value] : []);
  }, [mode, value]);

  const handlePress = useCallback(
    (optionValue: T) => {
      if (mode === "single") {
        onChange(optionValue as T);
      } else {
        const next = new Set(selectedSet);
        if (next.has(optionValue)) {
          next.delete(optionValue);
        } else {
          next.add(optionValue);
        }
        onChange(Array.from(next) as T[]);
      }
    },
    [mode, onChange, selectedSet],
  );

  // Match the container role to what its children announce: a single-select
  // group is a `radiogroup` of `radio` options (mutually exclusive); a
  // multi-select group is a `toolbar` of toggle `button`s. Using `menu` here
  // would imply `menuitem` children and misdescribe the controls to AT.
  const accessibilityRole = mode === "single" ? "radiogroup" : "toolbar";
  const accessibilityLabel =
    mode === "single" ? "Filter options" : "Filter options (multi-select)";
  const childRole = mode === "single" ? "radio" : "button";

  return (
    <View
      className={className}
      style={style}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          { paddingHorizontal: 24, gap: 8 },
          contentContainerStyle,
        ]}
      >
        {options.map((option) => {
          const isSelected = selectedSet.has(option.value);
          return (
            <Pill
              key={String(option.value)}
              label={option.label}
              role={childRole}
              selected={isSelected}
              disabled={option.disabled}
              count={option.count}
              leftIcon={option.leftIcon}
              onPress={() => handlePress(option.value)}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

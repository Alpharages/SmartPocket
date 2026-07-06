import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";

import { ThemePickerControl } from "@/components/ui/ThemePicker";
import { getThemeTokens, type ThemeId } from "@/constants/theme";
import { ThemeContext } from "@/lib/theme-provider";
import { THEME_ID_OPTIONS } from "@/lib/theme-preference";

vi.mock("@expo/vector-icons", () => ({
  Ionicons: ({ name }: { name: string }) =>
    React.createElement("Ionicons", { name }),
}));

let renderer: ReactTestRenderer | null = null;

function render(ui: React.ReactElement): ReactTestInstance {
  act(() => {
    renderer = TestRenderer.create(ui);
  });
  return renderer!.root;
}

function renderWithTheme(
  value: ThemeId,
  onChange = vi.fn(),
  colorScheme: "light" | "dark" = "light",
): ReactTestInstance {
  return render(
    <ThemeContext.Provider
      value={{
        colorScheme,
        themePreference: colorScheme,
        setThemePreference: async () => {},
        setColorScheme: () => {},
        themeId: value,
        setThemeId: async () => {},
        theme: getThemeTokens(value, colorScheme),
        isReady: true,
      }}
    >
      <ThemePickerControl value={value} onChange={onChange} />
    </ThemeContext.Provider>,
  );
}

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = null;
});

function findPressableByLabel(
  root: ReactTestInstance,
  label: string,
): ReactTestInstance {
  return root.find(
    (n) =>
      n.props?.accessibilityLabel === label &&
      typeof n.props?.onPress === "function",
  );
}

function textOf(node: ReactTestInstance | string): string {
  if (typeof node === "string") return node;
  return (node.children ?? [])
    .map((c) => (typeof c === "string" ? c : textOf(c)))
    .join("");
}

describe("ThemePickerControl", () => {
  it("renders every theme option from the registry", () => {
    const root = renderWithTheme("aurora");
    const body = textOf(root);

    for (const option of THEME_ID_OPTIONS) {
      expect(body).toContain(option.label);
      expect(
        root.find((n) => n.props?.testID === `theme-preview-${option.value}`),
      ).toBeTruthy();
    }
  });

  it("calls onChange with the selected theme id", () => {
    const onChange = vi.fn();
    const root = renderWithTheme("aurora", onChange);

    act(() => {
      findPressableByLabel(root, "Midnight Spectrum").props.onPress();
    });

    expect(onChange).toHaveBeenCalledWith("spectrum");
  });

  it("exposes the selected theme state without relying on color alone", () => {
    const root = renderWithTheme("obsidian");
    const active = findPressableByLabel(root, "Obsidian & Gold, selected");

    expect(active.props.accessibilityRole).toBe("button");
    expect(active.props.accessibilityState).toEqual({ selected: true });
    expect(
      root.find((n) => n.props?.testID === "theme-picker-obsidian-check"),
    ).toBeTruthy();
  });

  it("renders preview gradients for the current resolved scheme", () => {
    const root = renderWithTheme("aurora", vi.fn(), "dark");

    for (const option of THEME_ID_OPTIONS) {
      const gradient = root.find(
        (n) => n.props?.testID === `theme-preview-${option.value}-gradient`,
      );
      expect(gradient.props.colors).toEqual(
        getThemeTokens(option.value, "dark").gradient.colors,
      );
    }
  });
});

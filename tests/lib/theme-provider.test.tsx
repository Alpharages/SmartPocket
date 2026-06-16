import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TestRenderer, { act } from "react-test-renderer";

import { THEME_STORAGE_KEY } from "@/lib/theme-preference";
import {
  ThemeProvider,
  loadThemePreference,
  useThemeContext,
} from "@/lib/theme-provider";

const storage = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      storage.delete(key);
    }),
  },
}));

vi.mock("nativewind", () => ({
  colorScheme: { set: vi.fn() },
  vars: (value: unknown) => value,
}));

vi.mock("react-native", async () => {
  const actual =
    await vi.importActual<typeof import("react-native")>("react-native");
  return {
    ...actual,
    useColorScheme: vi.fn(() => "light"),
    Appearance: {
      ...actual.Appearance,
      setColorScheme: vi.fn(),
    },
  };
});

function Probe() {
  const ctx = useThemeContext();
  return React.createElement(
    "Text",
    {
      testID: "probe",
      accessibilityLabel: JSON.stringify({
        colorScheme: ctx.colorScheme,
        themePreference: ctx.themePreference,
        isReady: ctx.isReady,
      }),
    },
    ctx.themePreference,
  );
}

describe("loadThemePreference", () => {
  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();
  });

  it("returns stored preference when present", async () => {
    storage.set(THEME_STORAGE_KEY, "dark");
    await expect(loadThemePreference()).resolves.toBe("dark");
  });

  it("defaults to system when storage is empty", async () => {
    await expect(loadThemePreference()).resolves.toBe("system");
  });

  it("defaults to system for corrupt stored values", async () => {
    storage.set(THEME_STORAGE_KEY, "blue");
    await expect(loadThemePreference()).resolves.toBe("system");
  });
});

describe("ThemeProvider", () => {
  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();
  });

  it("loads persisted preference on mount", async () => {
    storage.set(THEME_STORAGE_KEY, "dark");
    let renderer: TestRenderer.ReactTestRenderer | undefined;

    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(ThemeProvider, null, React.createElement(Probe)),
      );
      await Promise.resolve();
    });

    const probe = renderer!.root.findByProps({ testID: "probe" });
    const state = JSON.parse(probe.props.accessibilityLabel);
    expect(state.themePreference).toBe("dark");
    expect(state.colorScheme).toBe("dark");
  });

  it("persists preference when setThemePreference is called", async () => {
    let renderer: TestRenderer.ReactTestRenderer | undefined;
    let setThemePreference:
      | ((preference: "light" | "dark" | "system") => Promise<void>)
      | undefined;

    function SetterProbe() {
      const ctx = useThemeContext();
      setThemePreference = ctx.setThemePreference;
      return React.createElement(Probe);
    }

    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(
          ThemeProvider,
          null,
          React.createElement(SetterProbe),
        ),
      );
      await Promise.resolve();
    });

    await act(async () => {
      await setThemePreference!("light");
    });

    expect(storage.get(THEME_STORAGE_KEY)).toBe("light");
    const probe = renderer!.root.findByProps({ testID: "probe" });
    const state = JSON.parse(probe.props.accessibilityLabel);
    expect(state.themePreference).toBe("light");
    expect(state.colorScheme).toBe("light");
  });
});

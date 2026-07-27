import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";
import * as Reanimated from "react-native-reanimated";

import BudgetFormScreen from "@/app/budget-form";
import { useExpense } from "@/lib/expense-context";
import { Motion } from "@/lib/_core/theme";

// ---------------------------------------------------------------------------
// Module mocks — this suite only cares about BudgetFormScreen's own open/close
// transition wiring (Story 12.9, AC3), so BudgetFormSheet is stubbed out; its
// own behavior is covered by tests/components/budget-form.test.tsx.
// ---------------------------------------------------------------------------

vi.mock("expo-router", () => ({
  useRouter: () => ({ back: vi.fn() }),
  useLocalSearchParams: () => ({ id: undefined }),
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

vi.mock("@/components/budgets/BudgetFormSheet", () => ({
  BudgetFormSheet: () => React.createElement("View", { testID: "stub-sheet" }),
}));

vi.mock("@/lib/expense-context", () => ({
  useExpense: vi.fn(),
}));

vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({
    surface: "#FFFFFF",
    border: "#E5E7EB",
    foreground: "#111827",
  }),
}));

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

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = null;
  vi.restoreAllMocks();
});

describe("BudgetFormScreen (Story 12.9, AC3)", () => {
  it("renders without throwing", () => {
    vi.mocked(useExpense).mockReturnValue({ budgets: [] } as never);
    expect(() => render(<BudgetFormScreen />)).not.toThrow();
  });

  it("drives its open transition with the shared motion.screen token, not an inline literal", () => {
    vi.mocked(useExpense).mockReturnValue({ budgets: [] } as never);
    const withTimingSpy = vi.spyOn(Reanimated, "withTiming");

    render(<BudgetFormScreen />);

    const openCall = withTimingSpy.mock.calls.find(
      (call) => call[0] === 1 && typeof call[1] === "object",
    );
    expect(openCall).toBeTruthy();
    expect((openCall![1] as { duration?: number }).duration).toBe(
      Motion.screen.durationMs,
    );
  });
});

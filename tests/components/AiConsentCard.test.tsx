import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TestRenderer, { act, type ReactTestInstance } from "react-test-renderer";

import { AI_EXPLANATION, AiConsentCard } from "@/components/ui/AiConsentCard";

const mockColors = {
  primary: "#4F46E5",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  foreground: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  success: "#059669",
  warning: "#D97706",
  error: "#DC2626",
  accent: "#DB2777",
  secondary: "#7C3AED",
  text: "#111827",
  tint: "#4F46E5",
  icon: "#6B7280",
  tabIconDefault: "#6B7280",
  tabIconSelected: "#4F46E5",
};

vi.mock("@/hooks/use-colors", () => ({
  useColors: () => mockColors,
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

vi.mock("@expo/vector-icons", () => ({
  Ionicons: ({ name }: { name: string }) =>
    React.createElement("span", { "data-icon": name }),
}));

let renderer: TestRenderer.ReactTestRenderer | null = null;

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
});

function textOf(node: ReactTestInstance | string): string {
  if (typeof node === "string") return node;
  return (node.children ?? [])
    .map((c) => (typeof c === "string" ? c : textOf(c)))
    .join("");
}

function getButtons(root: ReactTestInstance): ReactTestInstance[] {
  return root.findAll(
    (n) => typeof n.type === "string" && n.props.accessibilityRole === "button",
  );
}

describe("AiConsentCard", () => {
  it("does not render when visible is false", () => {
    const root = render(
      <AiConsentCard visible={false} onEnable={vi.fn()} onDismiss={vi.fn()} />,
    );
    expect(
      root.findAll((n) => n.props.testID === "ai-consent-card-panel"),
    ).toHaveLength(0);
  });

  it("explains what is sent, why, and that it is reversible", () => {
    const root = render(
      <AiConsentCard visible={true} onEnable={vi.fn()} onDismiss={vi.fn()} />,
    );
    const body = textOf(root);
    expect(body).toContain(AI_EXPLANATION);
    expect(body.toLowerCase()).toContain("what");
    expect(body.toLowerCase()).toContain("reversible");
  });

  it("calls onEnable when Enable AI is pressed", () => {
    const onEnable = vi.fn();
    const root = render(
      <AiConsentCard visible={true} onEnable={onEnable} onDismiss={vi.fn()} />,
    );
    const enableButton = getButtons(root).find((b) =>
      textOf(b).includes("Enable AI"),
    );
    expect(enableButton).toBeTruthy();

    act(() => {
      enableButton!.props.onPress?.();
    });

    expect(onEnable).toHaveBeenCalledTimes(1);
  });

  it("calls onDismiss when Not now is pressed", () => {
    const onDismiss = vi.fn();
    const root = render(
      <AiConsentCard visible={true} onEnable={vi.fn()} onDismiss={onDismiss} />,
    );
    const notNowButton = getButtons(root).find((b) =>
      textOf(b).includes("Not now"),
    );
    expect(notNowButton).toBeTruthy();

    act(() => {
      notNowButton!.props.onPress?.();
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("disables both actions while enabling to guard against double-tap", () => {
    const root = render(
      <AiConsentCard
        visible={true}
        onEnable={vi.fn()}
        onDismiss={vi.fn()}
        enabling={true}
      />,
    );
    const buttons = getButtons(root);
    const enableButton = buttons.find(
      (b) => b.props.accessibilityLabel === "Enable AI",
    );
    const notNowButton = buttons.find(
      (b) => b.props.accessibilityLabel === "Not now",
    );

    expect(enableButton!.props.disabled).toBe(true);
    expect(notNowButton!.props.disabled).toBe(true);
  });
});

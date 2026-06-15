import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TestRenderer, { act, type ReactTestRenderer } from "react-test-renderer";

import { CategoryAnomalyBadge } from "@/components/ui/CategoryAnomalyBadge";

const mockColors = {
  warning: "#D97706",
  error: "#DC2626",
};

vi.mock("@/hooks/use-colors", () => ({
  useColors: () => mockColors,
}));

let renderer: ReactTestRenderer | null = null;

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = null;
});

function findByAccessibilityLabel(
  root: ReactTestRenderer["root"],
  label: string,
) {
  return root.findAll(
    (node) =>
      node.props.accessibilityLabel === label ||
      node.props["aria-label"] === label,
  );
}

describe("CategoryAnomalyBadge", () => {
  it("renders the warning-token indicator with non-punitive copy (AC2)", () => {
    act(() => {
      renderer = TestRenderer.create(
        <CategoryAnomalyBadge categoryName="Dining" />,
      );
    });

    const tree = renderer!.toJSON();
    const serialized = JSON.stringify(tree);
    expect(serialized).toContain("Above usual");
    expect(serialized).toContain(mockColors.warning);
    expect(serialized).not.toContain(mockColors.error);
  });

  it("includes an accessibilityLabel text equivalent (AC4)", () => {
    act(() => {
      renderer = TestRenderer.create(
        <CategoryAnomalyBadge categoryName="Dining" />,
      );
    });

    const matches = findByAccessibilityLabel(
      renderer!.root,
      "Dining, above usual spending this month",
    );
    expect(matches.length).toBeGreaterThan(0);
  });
});

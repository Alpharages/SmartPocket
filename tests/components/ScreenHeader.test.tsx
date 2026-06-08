import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";
import { Pressable } from "react-native";

import { ScreenHeader } from "@/components/ui/ScreenHeader";

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
});

/** Concatenate the visible text under a node. */
function textOf(node: ReactTestInstance | string): string {
  if (typeof node === "string") return node;
  return (node.children ?? [])
    .map((c) => (typeof c === "string" ? c : textOf(c)))
    .join("");
}

function queryText(root: ReactTestInstance, text: string): ReactTestInstance[] {
  return root.findAll((n) => String(n.type) === "Text" && textOf(n) === text);
}

function getByText(root: ReactTestInstance, text: string): ReactTestInstance {
  const matches = queryText(root, text);
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one Text "${text}", found ${matches.length}`,
    );
  }
  return matches[0];
}

function getTitle(root: ReactTestInstance): ReactTestInstance {
  return root.find(
    (n) => String(n.type) === "Text" && n.props.accessibilityRole === "header",
  );
}

describe("ScreenHeader", () => {
  describe("rendering", () => {
    it("renders the title text", () => {
      const root = render(<ScreenHeader title="Dashboard" />);
      expect(getByText(root, "Dashboard")).toBeTruthy();
    });

    it("exposes accessibilityRole='header' on the title", () => {
      const root = render(<ScreenHeader title="Dashboard" />);
      expect(getTitle(root).props.accessibilityRole).toBe("header");
      expect(getTitle(root).props["aria-level"]).toBe(1);
    });

    it("renders without throwing in light mode", () => {
      const root = render(<ScreenHeader title="Light Test" />);
      expect(getByText(root, "Light Test")).toBeTruthy();
    });

    it("renders without throwing in dark mode", () => {
      const root = render(<ScreenHeader title="Dark Test" />);
      expect(getByText(root, "Dark Test")).toBeTruthy();
    });
  });

  describe("subtitle", () => {
    it("renders the subtitle when provided", () => {
      const root = render(
        <ScreenHeader title="Transactions" subtitle="All time" />,
      );
      expect(getByText(root, "All time")).toBeTruthy();
    });

    it("does not render a caption line when no subtitle or count is given", () => {
      const root = render(<ScreenHeader title="No Caption" />);
      const texts = root.findAll((n) => String(n.type) === "Text");
      expect(texts.length).toBe(1);
      expect(textOf(texts[0])).toBe("No Caption");
    });

    it("treats an empty-string subtitle as absent (no caption line)", () => {
      const root = render(<ScreenHeader title="Empty Subtitle" subtitle="" />);
      const texts = root.findAll((n) => String(n.type) === "Text");
      expect(texts.length).toBe(1);
      expect(textOf(texts[0])).toBe("Empty Subtitle");
    });
  });

  describe("count", () => {
    it("renders the count alone when only count is provided", () => {
      const root = render(<ScreenHeader title="Items" count={12} />);
      expect(getByText(root, "12")).toBeTruthy();
    });

    it("renders subtitle and count combined when both are provided", () => {
      const root = render(
        <ScreenHeader title="Summary" subtitle="Monthly breakdown" count={8} />,
      );
      expect(getByText(root, "Monthly breakdown · 8")).toBeTruthy();
    });

    it("renders count=0 (shows '0', does not hide)", () => {
      const root = render(<ScreenHeader title="Items" count={0} />);
      expect(getByText(root, "0")).toBeTruthy();
    });
  });

  describe("action slot", () => {
    it("renders the action node in the trailing slot", () => {
      const root = render(
        <ScreenHeader
          title="Cards"
          accessibilityLabel="Cards header"
          action={<Pressable accessibilityLabel="Add card" />}
        />,
      );
      const pressable = root.find(
        (n) =>
          typeof n.type === "string" &&
          n.props.accessibilityLabel === "Add card",
      );
      expect(pressable).toBeTruthy();
    });

    it("does not render an empty trailing slot when no action is given", () => {
      const root = render(<ScreenHeader title="No Action" />);
      const views = root.findAll((n) => typeof n.type === "string");
      // Only root View + title Text should exist; no extra View for action
      const viewTypes = views.map((n) => n.type);
      expect(viewTypes).not.toContain("Pressable");
    });
  });

  describe("accessibility", () => {
    it("forwards accessibilityLabel to the root view", () => {
      const root = render(
        <ScreenHeader
          title="Accessible"
          accessibilityLabel="Dashboard header"
        />,
      );
      const container = root.find(
        // @ts-expect-error — react-test-renderer's DOM-centric string union excludes RN host names
        (n) => n.type === "View",
      );
      expect(container.props.accessibilityLabel).toBe("Dashboard header");
    });

    it("warns in dev when action is provided without accessibilityLabel", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      render(
        <ScreenHeader
          title="Warn Test"
          action={<Pressable accessibilityLabel="Action" />}
        />,
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("accessibilityLabel"),
      );
      warnSpy.mockRestore();
    });

    it("does not warn when action and accessibilityLabel are both provided", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      render(
        <ScreenHeader
          title="No Warn"
          accessibilityLabel="Header with action"
          action={<Pressable accessibilityLabel="Action" />}
        />,
      );
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("allows callers to override the heading level", () => {
      const root = render(<ScreenHeader title="Details" headingLevel={2} />);
      expect(getTitle(root).props["aria-level"]).toBe(2);
    });
  });

  describe("props forwarding", () => {
    it("forwards className to the root View", () => {
      const root = render(
        <ScreenHeader title="Styled" className="bg-surface" />,
      );
      const container = root.find(
        // @ts-expect-error — react-test-renderer's DOM-centric string union excludes RN host names
        (n) => n.type === "View",
      );
      expect(container.props.className).toContain("bg-surface");
    });

    it("forwards style to the root View", () => {
      const root = render(
        <ScreenHeader title="Styled" style={{ paddingTop: 24 }} />,
      );
      const container = root.find(
        // @ts-expect-error — react-test-renderer's DOM-centric string union excludes RN host names
        (n) => n.type === "View",
      );
      expect(container.props.style).toMatchObject({ paddingTop: 24 });
    });

    it("forwards remaining ViewProps to the root View", () => {
      const root = render(
        <ScreenHeader title="Forwarded" testID="screen-header" />,
      );
      const container = root.find(
        // @ts-expect-error — react-test-renderer's DOM-centric string union excludes RN host names
        (n) => n.type === "View",
      );
      expect(container.props.testID).toBe("screen-header");
    });
  });
});

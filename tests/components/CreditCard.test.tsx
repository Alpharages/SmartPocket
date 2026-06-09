import React from "react";
import { describe, expect, it, vi } from "vitest";
import TestRenderer, { act } from "react-test-renderer";
import type { ReactTestInstance, ReactTestRenderer } from "react-test-renderer";

import { CreditCard } from "@/components/ui/credit-card";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@expo/vector-icons", () => {
  const Ionicons = ({ name }: { name: string }) =>
    React.createElement("Ionicons", { name });
  (Ionicons as any).glyphMap = { card: 1, checkmark: 1, pencil: 1 };
  return { Ionicons };
});

vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: "light" },
}));

vi.mock("@/hooks/use-press-feedback", () => ({
  usePressFeedback: () => ({
    animatedStyle: {},
    onPressIn: vi.fn(),
    onPressOut: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const baseCard = {
  name: "My Visa",
  cardNumber: "1234567890123456",
  cardholderName: "John Doe",
  expiryMonth: 3,
  expiryYear: 2027,
  color: "#6366F1",
  index: 0,
};

function renderCard(
  props: Partial<typeof baseCard> & {
    onLongPress?: () => void;
    onEdit?: () => void;
    onPress?: () => void;
    index?: number;
  } = {},
): ReactTestInstance {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <CreditCard {...baseCard} {...props} />,
    );
  });
  return renderer.root;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CreditCard", () => {
  describe("Card number masking", () => {
    it("shows only the last 4 digits masked as '•••• •••• •••• XXXX'", () => {
      const root = renderCard();
      const maskedText = root.find(
        (n) =>
          typeof n.props.children === "string" &&
          (n.props.children as string).startsWith("•••• •••• ••••"),
      );
      expect(maskedText.props.children).toBe("•••• •••• •••• 3456");
    });

    it("uses the last 4 chars even if cardNumber is exactly 4 chars", () => {
      const root = renderCard({ cardNumber: "9999" });
      const maskedText = root.find(
        (n) =>
          typeof n.props.children === "string" &&
          (n.props.children as string).startsWith("•••• •••• ••••"),
      );
      expect(maskedText.props.children).toBe("•••• •••• •••• 9999");
    });
  });

  describe("Expiry formatting", () => {
    it("formats expiryMonth and expiryYear as 'MM/YY'", () => {
      const root = renderCard({ expiryMonth: 3, expiryYear: 2027 });
      const expiryText = root.find(
        (n) =>
          typeof n.props.children === "string" &&
          /^\d{2}\/\d{2}$/.test(n.props.children as string),
      );
      expect(expiryText.props.children).toBe("03/27");
    });

    it("pads single-digit expiryMonth with leading zero", () => {
      const root = renderCard({ expiryMonth: 1, expiryYear: 2030 });
      const expiryText = root.find(
        (n) =>
          typeof n.props.children === "string" &&
          /^\d{2}\/\d{2}$/.test(n.props.children as string),
      );
      expect(expiryText.props.children).toBe("01/30");
    });

    it("uses only the last 2 digits of expiryYear (4-digit year)", () => {
      const root = renderCard({ expiryMonth: 12, expiryYear: 2099 });
      const expiryText = root.find(
        (n) =>
          typeof n.props.children === "string" &&
          /^\d{2}\/\d{2}$/.test(n.props.children as string),
      );
      expect(expiryText.props.children).toBe("12/99");
    });
  });

  describe("User-facing signals preserved", () => {
    it("renders the card name", () => {
      const root = renderCard({ name: "My Visa" });
      const nameNode = root.find(
        (n) => n.props.children === "My Visa",
      );
      expect(nameNode).toBeDefined();
    });

    it("renders the cardholder name", () => {
      const root = renderCard({ cardholderName: "Jane Smith" });
      const holderNode = root.find(
        (n) => n.props.children === "Jane Smith",
      );
      expect(holderNode).toBeDefined();
    });
  });

  describe("Long press interaction", () => {
    it("calls onLongPress when the card is long-pressed", () => {
      const onLongPress = vi.fn();
      const root = renderCard({ onLongPress });
      const pressable = root.find(
        (n) => n.props.onLongPress != null,
      );
      act(() => {
        pressable.props.onLongPress();
      });
      expect(onLongPress).toHaveBeenCalledTimes(1);
    });

    it("does not throw when onLongPress is not provided", () => {
      const root = renderCard();
      const pressable = root.find((n) => n.props.accessibilityRole === "button");
      expect(() => {
        act(() => {
          pressable.props.onLongPress?.();
        });
      }).not.toThrow();
    });
  });

  describe("Edit interaction", () => {
    it("calls onEdit when the edit affordance is pressed", () => {
      const onEdit = vi.fn();
      const root = renderCard({ onEdit });
      const editBtn = root.find(
        (n) =>
          n.props.accessibilityRole === "button" &&
          n.props.accessibilityLabel === "Edit My Visa",
      );
      act(() => {
        editBtn.props.onPress?.();
      });
      expect(onEdit).toHaveBeenCalledTimes(1);
    });

    it("does not render edit affordance when onEdit is not provided", () => {
      const root = renderCard();
      const editBtns = root.findAll(
        (n) =>
          n.props.accessibilityRole === "button" &&
          typeof n.props.accessibilityLabel === "string" &&
          (n.props.accessibilityLabel as string).startsWith("Edit "),
      );
      expect(editBtns).toHaveLength(0);
    });
  });

  describe("Accessibility", () => {
    it("has accessibilityLabel naming the card and last 4 digits", () => {
      const root = renderCard({ name: "My Visa", cardNumber: "1234567890123456" });
      const pressable = root.find(
        (n) =>
          n.props.accessibilityRole === "button" &&
          n.props.accessibilityLabel?.includes("My Visa"),
      );
      expect(pressable.props.accessibilityLabel).toContain("3456");
    });

    it("has accessibilityHint about long-press delete", () => {
      const root = renderCard();
      const pressable = root.find(
        (n) => n.props.accessibilityHint === "Long press to delete",
      );
      expect(pressable).toBeDefined();
    });

    it("keeps edit control as a sibling button, not nested inside the card pressable", () => {
      const root = renderCard({ onEdit: vi.fn(), onLongPress: vi.fn() });
      const editBtn = root.find(
        (n) => n.props.accessibilityLabel === "Edit My Visa",
      );
      const cardPressable = root.find(
        (n) =>
          typeof n.props.accessibilityLabel === "string" &&
          n.props.accessibilityLabel.includes("ending in"),
      );
      expect(editBtn.parent).not.toBe(cardPressable);
    });
  });
});

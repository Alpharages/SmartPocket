import React from "react";
import { Platform } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";

import { useExpense } from "@/lib/expense-context";
import CardsScreen from "@/app/(tabs)/cards";

vi.mock("expo-router", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/components/screen-container", () => ({
  ScreenContainer: ({ children }: { children: React.ReactNode }) =>
    React.createElement("View", {}, children),
}));

vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) =>
    React.createElement("SafeAreaView", {}, children),
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

vi.mock("@expo/vector-icons", () => {
  const Ionicons = ({ name, testID }: { name: string; testID?: string }) =>
    React.createElement("Ionicons", { name, testID });
  (Ionicons as any).glyphMap = {
    "card-outline": 1,
    add: 1,
    card: 1,
    checkmark: 1,
    close: 1,
    pencil: 1,
    "chevron-down": 1,
    "chevron-forward": 1,
  };
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
  overlay: "rgba(0,0,0,0.4)",
  text: "#111827",
  tint: "#4F46E5",
  icon: "#6B7280",
  tabIconDefault: "#6B7280",
  tabIconSelected: "#4F46E5",
};

vi.mock("@/hooks/use-colors", () => ({
  useColors: () => mockColors,
}));

vi.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

const TOKENS = vi.hoisted(() => ({
  Radius: { sm: 8, md: 12, lg: 16, full: 9999 },
  Spacing: { sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32 },
  Typography: {
    body: { fontSize: 14, lineHeight: 20, fontWeight: "400" },
    caption: { fontSize: 12, lineHeight: 16, fontWeight: "400" },
    h3: { fontSize: 18, lineHeight: 26, fontWeight: "600" },
    label: { fontSize: 13, lineHeight: 18, fontWeight: "500" },
  },
  ContentMaxWidth: {
    dashboard: 1120,
    screen: 960,
    sheet: 560,
    modal: 640,
    card: 420,
  },
}));

vi.mock("@/constants/theme", () => ({
  resolveCategoryColor: (color: string) => color,
  CATEGORY_COLOR_LIGHT_VALUES: ["#4F46E5", "#047857", "#E11D48"],
  CATEGORY_DEFAULT_COLOR: "#4F46E5",
  ...TOKENS,
}));

vi.mock("@/lib/_core/theme", () => ({
  ...TOKENS,
  Motion: {
    sheet: { durationMs: 300, closeDurationMs: 250 },
    fade: { durationMs: 200 },
  },
  Elevation: { card: { shadowColor: "#000", shadowOpacity: 0.1, elevation: 2 } },
}));

vi.mock("@/lib/expense-context", () => ({
  useExpense: vi.fn(),
}));

const mockConfirm = vi.hoisted(() => vi.fn().mockResolvedValue(true));

vi.mock("@/hooks/use-confirm", () => ({
  useConfirm: () => ({
    visible: false,
    options: {},
    confirm: mockConfirm,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  }),
}));

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ show: vi.fn() }),
}));

const mockCard1 = {
  id: 1,
  userId: 1,
  name: "My Visa",
  cardNumberLast4: "3456",
  cardholderName: "John Doe",
  expiryMonth: 3,
  expiryYear: 2027,
  creditLimit: "5000",
  color: "#6366F1",
  cardType: "credit",
  currentBalance: "0",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockCard2 = {
  id: 2,
  userId: 1,
  name: "Mastercard",
  cardNumberLast4: "7654",
  cardholderName: "Jane Doe",
  expiryMonth: 11,
  expiryYear: 2029,
  creditLimit: "10000",
  color: "#EC4899",
  cardType: "credit",
  currentBalance: "0",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockAddCreditCard = vi.fn().mockResolvedValue(undefined);
const mockUpdateCreditCard = vi.fn().mockResolvedValue(undefined);
const mockDeleteCreditCard = vi.fn().mockResolvedValue(undefined);

const baseContext = {
  creditCards: [mockCard1, mockCard2],
  loadingCards: false,
  addCreditCard: mockAddCreditCard,
  updateCreditCard: mockUpdateCreditCard,
  deleteCreditCard: mockDeleteCreditCard,
  transactions: [],
  loadingTransactions: false,
  addTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  stats: null,
  loadingStats: false,
  monthlyStats: null,
  refreshMonthlyStats: vi.fn(),
  categories: [],
  loadingCategories: false,
  addCategory: vi.fn(),
  deleteCategory: vi.fn(),
  refreshAll: vi.fn(),
};

function renderScreen(
  contextOverride: Partial<typeof baseContext> = {},
): ReactTestInstance {
  (useExpense as ReturnType<typeof vi.fn>).mockReturnValue({
    ...baseContext,
    ...contextOverride,
  });
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<CardsScreen />);
  });
  return renderer.root;
}

function renderWithLiveCards(initialCards = [mockCard1, mockCard2]) {
  let cards = initialCards.map((c) => ({ ...c }));
  const liveUpdate = vi.fn(async (id: number, data: Partial<typeof mockCard1>) => {
    cards = cards.map((c) =>
      c.id === id
        ? {
            ...c,
            ...data,
            name: data.name ?? c.name,
            color: data.color ?? c.color,
            cardType: data.cardType ?? c.cardType,
          }
        : c,
    );
  });
  (useExpense as ReturnType<typeof vi.fn>).mockImplementation(() => ({
    ...baseContext,
    creditCards: cards,
    updateCreditCard: liveUpdate,
  }));
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<CardsScreen />);
  });
  const rerender = () => {
    act(() => {
      renderer.update(<CardsScreen />);
    });
  };
  return { root: renderer.root, liveUpdate, rerender, getCards: () => cards };
}

function findByTestId(root: ReactTestInstance, testID: string): ReactTestInstance {
  return root.find((n) => n.props.testID === testID);
}

function flattenStyle(style: unknown): Record<string, unknown> {
  return Array.isArray(style)
    ? Object.assign({}, ...style.filter(Boolean))
    : ((style as Record<string, unknown>) ?? {});
}

describe("CardsScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Platform.OS = "ios";
  });

  describe("Layout (web)", () => {
    it("AC: add card action renders as Button primitive with testID=add-card-button", () => {
      const root = renderScreen();
      const btn = findByTestId(root, "add-card-button");
      const pressable = btn.find((n) => n.props.accessibilityRole === "button");
      expect(pressable).toBeDefined();
    });

    it("AC: add card button opts out of desktop full-width stretch", () => {
      Platform.OS = "web";
      const root = renderScreen();
      const btn = findByTestId(root, "add-card-button");
      const pressable = btn.find((n) => n.props.accessibilityRole === "button");
      expect(pressable.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ alignSelf: "flex-start" }),
        ]),
      );
    });

    it("AC: credit card preview is capped (not edge-to-edge) on web", () => {
      Platform.OS = "web";
      const root = renderScreen();
      const preview = findByTestId(root, "card-preview-0");
      const style = flattenStyle(preview.props.style);
      expect(style.width).toBe("100%");
      expect(style.maxWidth).toBe(420);
      expect(style.alignSelf).toBe("flex-start");
    });

    it("leaves credit card preview unconstrained on native", () => {
      const root = renderScreen();
      const preview = findByTestId(root, "card-preview-0");
      expect(preview.props.style).toBeUndefined();
    });
  });

  describe("Edit card (FR-8 / Story 2.1)", () => {
    it("renders an edit affordance on each card", () => {
      const root = renderScreen();
      const editBtn = root.find(
        (n) =>
          n.props.accessibilityRole === "button" &&
          n.props.accessibilityLabel === "Edit My Visa",
      );
      expect(editBtn).toBeDefined();
    });

    it("pressing edit opens the edit sheet with pre-filled fields", () => {
      const root = renderScreen();
      const editBtn = root.find(
        (n) =>
          n.props.accessibilityRole === "button" &&
          n.props.accessibilityLabel === "Edit My Visa",
      );
      act(() => {
        editBtn.props.onPress?.();
      });
      const sheet = findByTestId(root, "edit-card-sheet");
      expect(sheet.props.visible).toBe(true);
      const cardNameInput = root.find(
        (n) => n.type === "TextInput" && n.props.value === "My Visa",
      );
      expect(cardNameInput).toBeDefined();
    });

    it("shows masked read-only card number in edit mode", () => {
      const root = renderScreen();
      const editBtn = root.find(
        (n) =>
          n.props.accessibilityRole === "button" &&
          n.props.accessibilityLabel === "Edit My Visa",
      );
      act(() => {
        editBtn.props.onPress?.();
      });
      const maskedNodes = root.findAll(
        (n) =>
          typeof n.props.children === "string" &&
          n.props.children === "•••• •••• •••• 3456",
      );
      expect(maskedNodes.length).toBeGreaterThanOrEqual(1);
    });

    it("calls updateCreditCard without cardNumber when unchanged on save", async () => {
      const root = renderScreen();
      const editBtn = root.find(
        (n) =>
          n.props.accessibilityRole === "button" &&
          n.props.accessibilityLabel === "Edit My Visa",
      );
      act(() => {
        editBtn.props.onPress?.();
      });
      const nameInput = root.find(
        (n) => n.type === "TextInput" && n.props.value === "My Visa",
      );
      act(() => {
        nameInput.props.onChangeText("Updated Visa");
      });
      const saveBtn = root.find(
        (n) =>
          n.props.accessibilityRole === "button" &&
          n.props.accessibilityLabel === "Save",
      );
      await act(async () => {
        await saveBtn.props.onPress?.();
      });
      expect(mockUpdateCreditCard).toHaveBeenCalledWith(
        mockCard1.id,
        expect.objectContaining({
          name: "Updated Visa",
          cardholderName: "John Doe",
          expiryMonth: 3,
          expiryYear: 2027,
          creditLimit: "5000",
          color: "#6366F1",
          cardType: "credit",
        }),
      );
      expect(mockUpdateCreditCard.mock.calls[0][1]).not.toHaveProperty(
        "cardNumber",
      );
    });

    it("Cancel does not call updateCreditCard and closes the sheet", async () => {
      const root = renderScreen();
      const editBtn = root.find(
        (n) =>
          n.props.accessibilityRole === "button" &&
          n.props.accessibilityLabel === "Edit My Visa",
      );
      await act(async () => {
        editBtn.props.onPress?.();
      });
      const cancelBtn = root.find(
        (n) =>
          n.props.accessibilityRole === "button" &&
          n.props.accessibilityLabel === "Cancel",
      );
      await act(async () => {
        cancelBtn.props.onPress?.();
      });
      expect(mockUpdateCreditCard).not.toHaveBeenCalled();
      const sheet = findByTestId(root, "add-card-sheet");
      expect(sheet.props.visible).toBe(false);
    });

    it("Cancel resets form state so a subsequent Add opens empty", async () => {
      const root = renderScreen();
      const editBtn = root.find(
        (n) =>
          n.props.accessibilityRole === "button" &&
          n.props.accessibilityLabel === "Edit My Visa",
      );
      await act(async () => {
        editBtn.props.onPress?.();
      });
      const nameInput = root.find(
        (n) => n.type === "TextInput" && n.props.value === "My Visa",
      );
      await act(async () => {
        nameInput.props.onChangeText("Stale Name");
      });
      const cancelBtn = root.find(
        (n) =>
          n.props.accessibilityRole === "button" &&
          n.props.accessibilityLabel === "Cancel",
      );
      await act(async () => {
        cancelBtn.props.onPress?.();
      });
      const addBtn = root.find(
        (n) =>
          n.props.accessibilityRole === "button" &&
          n.props.accessibilityLabel === "Add New Card",
      );
      await act(async () => {
        addBtn.props.onPress?.();
      });
      const staleInputs = root.findAll(
        (n) => n.type === "TextInput" && n.props.value === "Stale Name",
      );
      expect(staleInputs).toHaveLength(0);
      const submitBtn = root.find(
        (n) =>
          n.props.accessibilityRole === "button" &&
          n.props.accessibilityLabel === "Add Card" &&
          n.props.accessibilityState?.disabled === true,
      );
      expect(submitBtn).toBeDefined();
    });

    it("disables Save when expiry month is invalid after edit", () => {
      const root = renderScreen();
      const editBtn = root.find(
        (n) =>
          n.props.accessibilityRole === "button" &&
          n.props.accessibilityLabel === "Edit My Visa",
      );
      act(() => {
        editBtn.props.onPress?.();
      });
      const monthInput = root.find(
        (n) => n.type === "TextInput" && n.props.value === "3",
      );
      act(() => {
        monthInput.props.onChangeText("13");
      });
      const saveBtn = root.find(
        (n) =>
          n.props.accessibilityRole === "button" &&
          n.props.accessibilityLabel === "Save" &&
          n.props.accessibilityState?.disabled === true,
      );
      expect(saveBtn).toBeDefined();
    });

    it("AC5: closes sheet after save and list reflects updated card name", async () => {
      const { root, liveUpdate, rerender } = renderWithLiveCards();
      const editBtn = root.find(
        (n) =>
          n.props.accessibilityRole === "button" &&
          n.props.accessibilityLabel === "Edit My Visa",
      );
      await act(async () => {
        editBtn.props.onPress?.();
      });
      const nameInput = root.find(
        (n) => n.type === "TextInput" && n.props.value === "My Visa",
      );
      await act(async () => {
        nameInput.props.onChangeText("Updated Visa");
      });
      const saveBtn = root.find(
        (n) =>
          n.props.accessibilityRole === "button" &&
          n.props.accessibilityLabel === "Save",
      );
      await act(async () => {
        await saveBtn.props.onPress?.();
      });
      expect(liveUpdate).toHaveBeenCalledTimes(1);
      rerender();
      const sheet = findByTestId(root, "add-card-sheet");
      expect(sheet.props.visible).toBe(false);
      const updatedLabel = root.find(
        (n) =>
          n.props.accessibilityRole === "button" &&
          n.props.accessibilityLabel === "Edit Updated Visa",
      );
      expect(updatedLabel).toBeDefined();
    });

    it("persists color and card type changes on save", async () => {
      const root = renderScreen();
      const editBtn = root.find(
        (n) =>
          n.props.accessibilityRole === "button" &&
          n.props.accessibilityLabel === "Edit My Visa",
      );
      await act(async () => {
        editBtn.props.onPress?.();
      });
      const debitBtn = root.find(
        (n) =>
          n.props.accessibilityRole === "button" &&
          n.props.accessibilityLabel === "debit card type",
      );
      await act(async () => {
        debitBtn.props.onPress?.();
      });
      const colorBtn = root.find(
        (n) =>
          n.props.accessibilityRole === "button" &&
          n.props.accessibilityLabel === "Select color #10B981",
      );
      await act(async () => {
        colorBtn.props.onPress?.();
      });
      const saveBtn = root.find(
        (n) =>
          n.props.accessibilityRole === "button" &&
          n.props.accessibilityLabel === "Save",
      );
      await act(async () => {
        await saveBtn.props.onPress?.();
      });
      expect(mockUpdateCreditCard).toHaveBeenCalledWith(
        mockCard1.id,
        expect.objectContaining({
          cardType: "debit",
          color: "#10B981",
        }),
      );
    });
  });

  describe("Delete card regression", () => {
    it("long-press delete still calls deleteCreditCard after confirm", async () => {
      mockConfirm.mockResolvedValueOnce(true);
      const root = renderScreen();
      const cardPressable = root.find(
        (n) =>
          n.props.accessibilityRole === "button" &&
          n.props.accessibilityLabel === "My Visa card ending in 3456",
      );
      await act(async () => {
        await cardPressable.props.onLongPress?.();
      });
      expect(mockConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Delete Card", destructive: true }),
      );
      expect(mockDeleteCreditCard).toHaveBeenCalledWith(mockCard1.id);
    });
  });

  describe("Add card regression (FR-7)", () => {
    it("Add Card button is disabled when fields are empty", () => {
      const root = renderScreen();
      const addBtn = root.find(
        (n) =>
          n.props.accessibilityRole === "button" &&
          n.props.accessibilityLabel === "Add New Card",
      );
      act(() => {
        addBtn.props.onPress?.();
      });
      const submitBtn = root.find(
        (n) =>
          n.props.accessibilityRole === "button" &&
          n.props.accessibilityLabel === "Add Card" &&
          n.props.accessibilityState?.disabled === true,
      );
      expect(submitBtn).toBeDefined();
    });

    it("calls addCreditCard with valid form data on submit", async () => {
      const root = renderScreen();
      const addBtn = root.find(
        (n) =>
          n.props.accessibilityRole === "button" &&
          n.props.accessibilityLabel === "Add New Card",
      );
      await act(async () => {
        addBtn.props.onPress?.();
      });
      const setField = (value: string, placeholder: string) => {
        const input = root.find(
          (n) => n.type === "TextInput" && n.props.placeholder === placeholder,
        );
        act(() => {
          input.props.onChangeText(value);
        });
      };
      setField("New Card", "e.g., My Visa");
      setField("4111111111111111", "1234 5678 9012 3456");
      setField("Alex Smith", "John Doe");
      setField("6", "MM");
      setField("2028", "YYYY");
      setField("2500", "5000");
      const submitBtn = root.find(
        (n) =>
          n.props.accessibilityRole === "button" &&
          n.props.accessibilityLabel === "Add Card" &&
          !n.props.accessibilityState?.disabled,
      );
      await act(async () => {
        await submitBtn.props.onPress?.();
      });
      expect(mockAddCreditCard).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "New Card",
          cardNumber: "4111111111111111",
          cardholderName: "Alex Smith",
          expiryMonth: 6,
          expiryYear: 2028,
          creditLimit: "2500",
          cardType: "credit",
        }),
      );
      const sheet = findByTestId(root, "add-card-sheet");
      expect(sheet.props.visible).toBe(false);
    });
  });

  describe("EmptyState", () => {
    it("renders EmptyState when no cards exist and not loading", () => {
      const root = renderScreen({ creditCards: [] });
      const emptyState = findByTestId(root, "empty-state");
      expect(emptyState).toBeDefined();
    });

    it("EmptyState action 'Add Card' opens the sheet", () => {
      const root = renderScreen({ creditCards: [] });
      const sheet = findByTestId(root, "add-card-sheet");
      expect(sheet.props.visible).toBe(false);
      const actionBtn = findByTestId(root, "empty-state-action");
      const pressable = actionBtn.find(
        (n) => n.props.accessibilityRole === "button",
      );
      act(() => {
        pressable.props.onPress?.();
      });
      const sheetAfter = findByTestId(root, "add-card-sheet");
      expect(sheetAfter.props.visible).toBe(true);
    });
  });
});

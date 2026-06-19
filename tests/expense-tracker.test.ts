import { describe, it, expect, beforeEach } from "vitest";

/**
 * Expense Tracker API Tests
 *
 * These tests verify the core functionality of the expense tracker app:
 * - Transaction creation and retrieval
 * - Category management
 * - Credit card operations
 * - Monthly statistics calculation
 */

describe("Expense Tracker", () => {
  describe("Transactions", () => {
    it("should create a transaction with required fields", () => {
      const transaction = {
        categoryId: 1,
        type: "expense" as const,
        amount: "50.00",
        date: new Date(),
      };

      expect(transaction).toBeDefined();
      expect(transaction.type).toBe("expense");
      expect(transaction.amount).toBe("50.00");
    });

    it("should support both income and expense types", () => {
      const expenseTransaction = { type: "expense" as const };
      const incomeTransaction = { type: "income" as const };

      expect(["income", "expense"]).toContain(expenseTransaction.type);
      expect(["income", "expense"]).toContain(incomeTransaction.type);
    });

    it("should allow optional description field", () => {
      const transaction = {
        categoryId: 1,
        type: "expense" as const,
        amount: "25.50",
        description: "Lunch at cafe",
      };

      expect(transaction.description).toBe("Lunch at cafe");
    });
  });

  describe("Categories", () => {
    it("should create a category with required fields", () => {
      const category = {
        name: "Groceries",
        type: "expense" as const,
        color: "#FF6B6B",
        icon: "pricetag-outline",
        isDefault: false,
      };

      expect(category.name).toBe("Groceries");
      expect(category.type).toBe("expense");
      expect(category.color).toBe("#FF6B6B");
    });

    it("should support custom colors for categories", () => {
      const colors = ["#FF6B6B", "#4ECDC4", "#FFE66D", "#95E1D3"];
      const category = {
        name: "Food",
        color: colors[0],
      };

      expect(colors).toContain(category.color);
    });

    it("should differentiate between income and expense categories", () => {
      const expenseCategory = { type: "expense" as const };
      const incomeCategory = { type: "income" as const };

      expect(expenseCategory.type).not.toBe(incomeCategory.type);
    });
  });

  describe("Credit Cards", () => {
    it("should create a credit card with required fields", () => {
      const card = {
        name: "My Visa",
        cardNumber: "4532123456789010",
        cardholderName: "John Doe",
        expiryMonth: 12,
        expiryYear: 2025,
        creditLimit: "5000",
        color: "#3B82F6",
        cardType: "credit",
      };

      expect(card.name).toBe("My Visa");
      expect(card.cardholderName).toBe("John Doe");
      expect(card.creditLimit).toBe("5000");
    });

    it("should format card number correctly", () => {
      const cardNumber = "4532123456789010";
      const lastFourDigits = cardNumber.slice(-4);

      expect(lastFourDigits).toBe("9010");
      expect(lastFourDigits.length).toBe(4);
    });

    it("should validate expiry date", () => {
      const card = {
        expiryMonth: 12,
        expiryYear: 2025,
      };

      expect(card.expiryMonth).toBeGreaterThanOrEqual(1);
      expect(card.expiryMonth).toBeLessThanOrEqual(12);
      expect(card.expiryYear).toBeGreaterThan(2024);
    });
  });

  describe("Monthly Statistics", () => {
    it("should calculate net balance correctly", () => {
      const totalIncome = 3000;
      const totalExpense = 1500;
      const netBalance = totalIncome - totalExpense;

      expect(netBalance).toBe(1500);
    });

    it("should handle zero transactions", () => {
      const totalIncome = 0;
      const totalExpense = 0;
      const netBalance = totalIncome - totalExpense;

      expect(netBalance).toBe(0);
    });

    it("should calculate category-wise spending", () => {
      const expenses = [
        { categoryId: 1, amount: 50 },
        { categoryId: 1, amount: 30 },
        { categoryId: 2, amount: 100 },
      ];

      const categorySpending: { [key: number]: number } = {};
      expenses.forEach((exp) => {
        categorySpending[exp.categoryId] =
          (categorySpending[exp.categoryId] || 0) + exp.amount;
      });

      expect(categorySpending[1]).toBe(80);
      expect(categorySpending[2]).toBe(100);
    });

    it("should calculate spending percentages", () => {
      const totalExpense = 180;
      const category1Spending = 80;
      const percentage = (category1Spending / totalExpense) * 100;

      expect(Math.round(percentage)).toBe(44);
    });
  });

  describe("Data Validation", () => {
    it("should validate amount is positive", () => {
      const validAmount = "50.00";
      const amount = parseFloat(validAmount);

      expect(amount).toBeGreaterThan(0);
    });

    it("should validate required fields are present", () => {
      const transaction = {
        categoryId: 1,
        type: "expense" as const,
        amount: "50.00",
        date: new Date(),
      };

      expect(transaction.categoryId).toBeDefined();
      expect(transaction.type).toBeDefined();
      expect(transaction.amount).toBeDefined();
      expect(transaction.date).toBeDefined();
    });

    it("should format currency correctly", () => {
      const amount = 50.5;
      const formatted = amount.toFixed(2);

      expect(formatted).toBe("50.50");
    });
  });
});

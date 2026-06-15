import { getCategoryColorForName } from "@shared/theme";

export type DefaultCategoryDef = {
  name: string;
  type: "income" | "expense";
  color: string;
  icon: string;
};

/**
 * Predefined categories seeded for brand-new users (FR-6).
 * Colors are resolved from the shared theme palette — never raw hex literals here.
 */
export const DEFAULT_CATEGORIES: readonly DefaultCategoryDef[] = [
  { name: "Groceries", type: "expense", color: getCategoryColorForName("Groceries"), icon: "cart" },
  { name: "Dining", type: "expense", color: getCategoryColorForName("Dining"), icon: "restaurant" },
  { name: "Transport", type: "expense", color: getCategoryColorForName("Transport"), icon: "car" },
  { name: "Housing", type: "expense", color: getCategoryColorForName("Housing"), icon: "home" },
  { name: "Utilities", type: "expense", color: getCategoryColorForName("Utilities"), icon: "flash" },
  { name: "Shopping", type: "expense", color: getCategoryColorForName("Shopping"), icon: "bag" },
  { name: "Health", type: "expense", color: getCategoryColorForName("Health"), icon: "medkit" },
  {
    name: "Entertainment",
    type: "expense",
    color: getCategoryColorForName("Entertainment"),
    icon: "game-controller",
  },
  { name: "Salary", type: "income", color: getCategoryColorForName("Salary"), icon: "cash" },
  {
    name: "Other Income",
    type: "income",
    color: getCategoryColorForName("Other Income"),
    icon: "wallet",
  },
] as const;

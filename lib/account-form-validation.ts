import { isSupportedCurrency, type CurrencyCode } from "@/lib/currency";

export const ACCOUNT_TYPES = ["cash", "bank", "wallet"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export type AccountFormValues = {
  name: string;
  type: AccountType;
  currency: CurrencyCode;
};

export function isAccountFormValid(values: AccountFormValues): boolean {
  if (!values.name.trim()) {
    return false;
  }
  if (!ACCOUNT_TYPES.includes(values.type)) {
    return false;
  }
  if (!isSupportedCurrency(values.currency)) {
    return false;
  }
  return true;
}

export function getAccountTypeLabel(type: AccountType): string {
  switch (type) {
    case "cash":
      return "Cash";
    case "bank":
      return "Bank";
    case "wallet":
      return "Wallet";
    default:
      return type;
  }
}

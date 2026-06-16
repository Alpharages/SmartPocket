import { getLocales } from "expo-localization";

export type CurrencyCode =
  | "USD"
  | "EUR"
  | "GBP"
  | "JPY"
  | "PKR"
  | "CAD"
  | "AUD";

export type CurrencySign = "positive" | "negative" | "neutral" | "absolute";

export type CurrencyDefinition = {
  code: CurrencyCode;
  symbol: string;
  name: string;
};

export const CURRENCY_STORAGE_KEY = "@smartpocket/currency";

export const CURRENCIES: readonly CurrencyDefinition[] = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "PKR", symbol: "₨", name: "Pakistani Rupee" },
  { code: "CAD", symbol: "CA$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
] as const;

const SUPPORTED_CODES = new Set<CurrencyCode>(CURRENCIES.map((c) => c.code));

export function isSupportedCurrency(value: string): value is CurrencyCode {
  return SUPPORTED_CODES.has(value as CurrencyCode);
}

export function getCurrencyDefinition(code: CurrencyCode): CurrencyDefinition {
  return CURRENCIES.find((entry) => entry.code === code) ?? CURRENCIES[0];
}

export function getCurrencyLabel(code: CurrencyCode): string {
  const entry = getCurrencyDefinition(code);
  return `${entry.name} (${entry.code})`;
}

export function getCurrencySymbol(code: CurrencyCode): string {
  return getCurrencyDefinition(code).symbol;
}

function toSafeAmount(amount: number): number {
  return Number.isFinite(amount) ? amount : 0;
}

function fractionDigitsFor(code: CurrencyCode): number {
  try {
    return (
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: code,
      }).resolvedOptions().maximumFractionDigits ?? 2
    );
  } catch {
    return code === "JPY" ? 0 : 2;
  }
}

function formatWithSymbol(amount: number, code: CurrencyCode): string {
  const digits = fractionDigitsFor(code);
  const symbol = getCurrencySymbol(code);
  return `${symbol}${Math.abs(amount).toFixed(digits)}`;
}

function formatCurrencyCore(amount: number, code: CurrencyCode): string {
  const safeAmount = toSafeAmount(amount);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
    }).format(Math.abs(safeAmount));
  } catch {
    return formatWithSymbol(safeAmount, code);
  }
}

export function formatCurrency(
  amount: number,
  code: CurrencyCode,
  opts?: { sign?: CurrencySign },
): string {
  const safeAmount = toSafeAmount(amount);
  const core = formatCurrencyCore(safeAmount, code);
  const sign = opts?.sign ?? "neutral";

  switch (sign) {
    case "positive":
      return `+${core}`;
    case "negative":
      return `-${core}`;
    case "absolute":
      return core;
    case "neutral":
    default:
      if (safeAmount < 0) return `-${core}`;
      return core;
  }
}

export function formatSignedCurrency(
  amount: string | number,
  code: CurrencyCode,
  type: "income" | "expense",
): string {
  const parsed = typeof amount === "string" ? parseFloat(amount) : amount;
  const safeAmount = Number.isFinite(parsed) ? parsed : 0;
  return formatCurrency(safeAmount, code, {
    sign: type === "income" ? "positive" : "negative",
  });
}

/** Screen-reader friendly amount using the currency's spoken name (not hardcoded USD). */
export function formatCurrencyAccessibilityLabel(
  amount: number,
  code: CurrencyCode,
  sign: CurrencySign = "neutral",
): string {
  const safeAmount = toSafeAmount(amount);
  const absAmount = Math.abs(safeAmount);

  let spoken: string;
  try {
    spoken = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      currencyDisplay: "name",
    }).format(absAmount);
  } catch {
    const name = getCurrencyDefinition(code).name;
    const digits = fractionDigitsFor(code);
    spoken = `${absAmount.toFixed(digits)} ${name}`;
  }

  switch (sign) {
    case "positive":
      return `plus, ${spoken}`;
    case "negative":
      return `minus, ${spoken}`;
    case "absolute":
    case "neutral":
    default:
      return spoken;
  }
}

export function getDefaultCurrencyFromLocale(): CurrencyCode {
  try {
    const localeCurrency = getLocales()[0]?.currencyCode;
    if (localeCurrency && isSupportedCurrency(localeCurrency)) {
      return localeCurrency;
    }
  } catch {
    // fall through
  }

  try {
    const intlCurrency = Intl.NumberFormat().resolvedOptions().currency;
    if (intlCurrency && isSupportedCurrency(intlCurrency)) {
      return intlCurrency;
    }
  } catch {
    // fall through to USD
  }
  return "USD";
}

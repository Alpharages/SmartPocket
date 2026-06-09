export type CardFormValues = {
  cardName: string;
  cardNumber: string;
  cardholderName: string;
  expiryMonth: string;
  expiryYear: string;
  creditLimit: string;
  cardType: string;
};

export type CardFormMode = "add" | "edit";

/** Shared validation for add + edit card forms (parity with creditCardSchema). */
export function isCardFormValid(
  values: CardFormValues,
  mode: CardFormMode,
): boolean {
  const {
    cardName,
    cardNumber,
    cardholderName,
    expiryMonth,
    expiryYear,
    creditLimit,
    cardType,
  } = values;

  if (
    !cardName.trim() ||
    !cardholderName.trim() ||
    !expiryMonth ||
    !expiryYear ||
    !creditLimit.trim() ||
    !cardType.trim()
  ) {
    return false;
  }

  if (mode === "add" && !cardNumber.trim()) {
    return false;
  }

  const month = parseInt(expiryMonth, 10);
  if (Number.isNaN(month) || month < 1 || month > 12) {
    return false;
  }

  const year = parseInt(expiryYear, 10);
  if (Number.isNaN(year) || year < 2024 || year > 2099) {
    return false;
  }

  if (!/^\d+(\.\d{1,2})?$/.test(creditLimit.trim())) {
    return false;
  }

  return true;
}

export function maskCardLastFour(cardNumber: string): string {
  const lastFour = cardNumber.slice(-4);
  return `•••• •••• •••• ${lastFour}`;
}

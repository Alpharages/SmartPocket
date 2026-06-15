import React from "react";

import { CurrencyProvider } from "@/lib/currency-provider";

export function withCurrencyProvider(ui: React.ReactElement) {
  return <CurrencyProvider>{ui}</CurrencyProvider>;
}

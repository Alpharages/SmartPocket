export type AccountMoneyRow = {
  accountId: number | null;
  type: string;
  amount: string;
};

export type TransferLeg = {
  fromAccountId: number;
  toAccountId: number;
  amount: string;
};

function parseMoneyAmount(amount: string): number {
  const parsed = parseFloat(amount);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Derive per-account balances from transaction rows in JS (no SQL GROUP BY).
 * Single fold point — extend the switch for Story 9.4 transfer legs.
 */
export function reduceAccountBalances(
  rows: AccountMoneyRow[],
): Record<number, number> {
  const balances = new Map<number, number>();

  for (const row of rows) {
    if (row.accountId == null) continue;

    const accountId = Number(row.accountId);
    if (!Number.isFinite(accountId)) continue;

    const amount = parseMoneyAmount(row.amount);
    const current = balances.get(accountId) ?? 0;

    switch (row.type) {
      case "income":
        balances.set(accountId, current + amount);
        break;
      case "expense":
        balances.set(accountId, current - amount);
        break;
      default:
        break;
    }
  }

  return Object.fromEntries(balances);
}

/**
 * Fold transfer legs into per-account balances (source −amount, destination +amount).
 * Single reduce point for Story 9.4 — called after transaction fold in getAccountBalances.
 */
export function applyTransferLegs(
  balances: Record<number, number>,
  transfers: TransferLeg[],
): Record<number, number> {
  const map = new Map<number, number>(
    Object.entries(balances).map(([id, balance]) => [Number(id), balance]),
  );

  for (const transfer of transfers) {
    const fromId = Number(transfer.fromAccountId);
    const toId = Number(transfer.toAccountId);
    if (!Number.isFinite(fromId) || !Number.isFinite(toId)) continue;

    const amount = parseMoneyAmount(transfer.amount);
    if (amount === 0) continue;
    map.set(fromId, (map.get(fromId) ?? 0) - amount);
    map.set(toId, (map.get(toId) ?? 0) + amount);
  }

  return Object.fromEntries(map);
}

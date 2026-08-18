import type { Id } from "@/drizzle/schema";

export type AccountMoneyRow = {
  accountId: Id | null;
  type: string;
  amount: string;
};

export type TransferLeg = {
  fromAccountId: Id;
  toAccountId: Id;
  amount: string;
};

function parseMoneyAmount(amount: string): number {
  const parsed = parseFloat(amount);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Account ids are ULIDs now, so the "is this a usable key" check is a non-empty
 * string rather than `Number.isFinite`. Rows whose account reference is blank
 * are skipped exactly as unparseable numeric ids used to be.
 */
function isUsableAccountId(value: unknown): value is Id {
  return typeof value === "string" && value.length > 0;
}

/**
 * Derive per-account balances from transaction rows in JS (no SQL GROUP BY).
 * Single fold point — extend the switch for Story 9.4 transfer legs.
 */
export function reduceAccountBalances(
  rows: AccountMoneyRow[],
): Record<Id, number> {
  const balances = new Map<Id, number>();

  for (const row of rows) {
    if (!isUsableAccountId(row.accountId)) continue;

    const accountId = row.accountId;
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
  balances: Record<Id, number>,
  transfers: TransferLeg[],
): Record<Id, number> {
  const map = new Map<Id, number>(Object.entries(balances));

  for (const transfer of transfers) {
    const fromId = transfer.fromAccountId;
    const toId = transfer.toAccountId;
    if (!isUsableAccountId(fromId) || !isUsableAccountId(toId)) continue;

    const amount = parseMoneyAmount(transfer.amount);
    if (amount === 0) continue;
    map.set(fromId, (map.get(fromId) ?? 0) - amount);
    map.set(toId, (map.get(toId) ?? 0) + amount);
  }

  return Object.fromEntries(map);
}

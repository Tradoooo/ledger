/** Balances are a fold on the journal, never stored state. */
import type { Journal } from "./schema.js";
import type { Chart } from "./chart.js";
import type { AccountType } from "./schema.js";

export interface BalanceOptions { asOf?: string; unit?: string }

/** Signed sums per account id. Order of entries never matters: addition commutes. */
export function balances(journal: Journal, options: BalanceOptions = {}): Map<string, number> {
  const totals = new Map<string, number>();
  for (const record of journal.records) {
    if (options.asOf !== undefined && record.date > options.asOf) continue;
    for (const posting of record.postings) {
      if (options.unit !== undefined && posting.unit !== options.unit) continue;
      totals.set(posting.accountId, (totals.get(posting.accountId) ?? 0) + posting.amountMinor);
    }
  }
  return totals;
}

/** Same fold, restricted to one account and its children. */
export function accountBalance(journal: Journal, chart: Chart, accountId: string, options: BalanceOptions = {}): number {
  const ids = new Set<string>([accountId, ...chart.children(accountId).map((a) => a.id)]);
  let total = 0;
  for (const [id, amount] of balances(journal, options)) if (ids.has(id)) total += amount;
  return total;
}

/** Totals per account type, in normal-balance convention (assets and expenses positive). */
export function totalsByType(journal: Journal, chart: Chart, options: BalanceOptions = {}): Record<AccountType, number> {
  const totals: Record<AccountType, number> = { asset: 0, liability: 0, equity: 0, income: 0, expense: 0 };
  for (const [id, amount] of balances(journal, options)) {
    const account = chart.get(id);
    if (!account) continue;
    const sign = account.normalBalance === "debit" ? 1 : -1;
    totals[account.type] += sign * amount;
  }
  return totals;
}

/** The accounting equation, as one number: zero means the books are balanced. */
export function equationResidual(journal: Journal, chart: Chart, options: BalanceOptions = {}): number {
  const totals = totalsByType(journal, chart, options);
  return totals.asset + totals.expense - totals.liability - totals.equity - totals.income;
}

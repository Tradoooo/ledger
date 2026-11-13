/** The chart of accounts: extension point #1. Includes parents, enforces normal sides. */
import { Account, AccountId } from "./schema.js";
import type { AccountType, NormalSide, Unit } from "./schema.js";
import { LedgerError } from "./journal.js";
import { deepFreeze } from "./journal.js";

export type AccountInput = Omit<Account, "parent" | "archived" | "daily" | "normalBalance"> &
  Partial<Pick<Account, "parent" | "archived" | "daily" | "normalBalance">>;

export interface Chart {
  readonly accounts: readonly Account[];
  get(id: string): Account | undefined;
  has(id: string): boolean;
  children(id: string): readonly Account[];
}

const DEFAULT_SIDE: Record<AccountType, NormalSide> = {
  asset: "debit", expense: "debit", liability: "credit", equity: "credit", income: "credit",
};

export function defineChart(inputs: readonly AccountInput[]): Chart {
  const byId = new Map<string, Account>();
  for (const input of inputs) {
    if (!AccountId.safeParse(input.id).success) {
      throw new LedgerError("UnknownAccount", `account id ${input.id} does not match a:b:c`, { accountId: input.id });
    }
    if (byId.has(input.id)) {
      throw new LedgerError("UnknownAccount", `account ${input.id} is declared twice`, { accountId: input.id });
    }
    const account = Account.parse({ ...input, normalBalance: input.normalBalance ?? DEFAULT_SIDE[input.type] });
    byId.set(account.id, account);
  }
  for (const account of byId.values()) {
    if (account.parent !== null && !byId.has(account.parent)) {
      throw new LedgerError("UnknownAccount", `parent ${account.parent} of ${account.id} is missing`, { accountId: account.id });
    }
  }
  const accounts = deepFreeze([...byId.values()]);
  const chart: Chart = {
    accounts,
    get: (id: string) => byId.get(id),
    has: (id: string) => byId.has(id),
    children: (id: string) => accounts.filter((a) => a.parent === id),
  };
  return Object.freeze(chart);
}

/** Unit code used by every account of this chart (the ledger is single-unit per app). */
export function chartUnit(chart: Chart): string {
  const first = chart.accounts[0];
  if (!first) throw new LedgerError("UnknownAccount", "the chart is empty");
  return first.unit.kind === "currency" ? first.unit.code : first.unit.label.toUpperCase().slice(0, 3);
}

export type { Unit, AccountType, NormalSide };

/** The extension points of the mutual aid fund: public by default, no envelope anywhere.
 *
 * A fund does not budget, it renders accounts: `envelopes` is absent on purpose, and the
 * only reports it publishes are the ones a donor can re-derive from the chain.
 */
import { defineLedger } from "@ledger/core";
import type { AccountInput, AccountType, LedgerApp, NormalSide, Unit } from "@ledger/core";

const EUR: Unit = { kind: "currency", code: "EUR" };

const side = (type: AccountType): NormalSide => (type === "asset" || type === "expense" ? "debit" : "credit");

const account = (id: string, type: AccountType, label: string): AccountInput => ({
  id,
  type,
  unit: EUR,
  label,
  normalBalance: side(type),
});

const CHART: readonly AccountInput[] = [
  account("assets:bank:fund", "asset", "Bank — mutual aid fund"),
  account("assets:cash", "asset", "Cash box at the market stall"),
  account("income:donations", "income", "Donations"),
  account("income:grants", "income", "Grants"),
  account("expenses:aid:food", "expense", "Aid — food"),
  account("expenses:aid:rent", "expense", "Aid — rent"),
  account("expenses:aid:school", "expense", "Aid — school canteen"),
  account("expenses:aid:energy", "expense", "Aid — energy"),
  account("expenses:operations", "expense", "Operations"),
  account("equity:opening", "equity", "Opening equity"),
];

/** A rule proposes an account; it never writes a posting (core law). */
const RULES = [
  {
    id: "donation",
    when: { field: "memo", op: "contains", value: "Donation" },
    then: { accountId: "income:donations" },
    frequency: "on-import",
  },
  {
    id: "food-voucher",
    when: { field: "memo", op: "contains", value: "Food voucher" },
    then: { accountId: "expenses:aid:food" },
    frequency: "on-import",
  },
  {
    id: "rent-aid",
    when: { field: "memo", op: "contains", value: "Rent aid" },
    then: { accountId: "expenses:aid:rent" },
    frequency: "on-import",
  },
  {
    id: "canteen",
    when: { field: "memo", op: "contains", value: "Canteen" },
    then: { accountId: "expenses:aid:school" },
    frequency: "on-import",
  },
] as const;

export const mutualAid: LedgerApp = defineLedger({
  name: "Mutual aid fund",
  locale: "en",
  unit: EUR,
  chart: CHART,
  rules: RULES,
  reports: ["trial-balance", "income-statement", "audit-trail"],
  presentation: { theme: "ink-paper", locale: "en", printTitle: "Annual report of the fund" },
});

export const UNIT = "EUR";
export const FUND_START = "2026-01-01";
export const FUND_END = "2026-11-30";
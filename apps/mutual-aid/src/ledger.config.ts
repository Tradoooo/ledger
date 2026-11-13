/** The extension points of the mutual aid fund: public by default, no envelope anywhere.
 *
 * A fund does not budget, it renders accounts: `envelopes` is absent on purpose, and the
 * only reports it publishes are the ones a donor can re-derive from the chain.
 */
import { defineLedger } from "@ledger/core";
import type { AccountInput, AccountType, LedgerApp, NormalSide, Unit } from "@ledger/core";

const EUR: Unit = { kind: "currency", code: "EUR" };
const side = (type: AccountType): NormalSide => (type === "asset" || type === "expense" ? "debit" : "credit");

const CHART: readonly AccountInput[] = ([
  ["assets:bank:fund", "asset", "Bank — mutual aid fund"],
  ["assets:cash", "asset", "Cash box at the market stall"],
  ["income:donations", "income", "Donations"],
  ["income:grants", "income", "Grants"],
  ["expenses:aid:food", "expense", "Aid — food"],
  ["expenses:aid:rent", "expense", "Aid — rent"],
  ["expenses:aid:school", "expense", "Aid — school canteen"],
  ["expenses:aid:energy", "expense", "Aid — energy"],
  ["expenses:operations", "expense", "Operations"],
  ["equity:opening", "equity", "Opening equity"],
] as const).map(([id, type, label]): AccountInput => ({ id, type, unit: EUR, label, normalBalance: side(type) }));

/** A rule proposes an account; it never writes a posting (core law). */
const rule = (id: string, value: string, accountId: string) =>
  ({ id, when: { field: "memo", op: "contains", value }, then: { accountId }, frequency: "on-import" }) as const;

const RULES = [
  rule("donation", "Donation", "income:donations"),
  rule("food-voucher", "Food voucher", "expenses:aid:food"),
  rule("rent-aid", "Rent aid", "expenses:aid:rent"),
  rule("canteen", "Canteen", "expenses:aid:school"),
];

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
export const PERIOD = "2026";
export const FUND_START = "2026-01-01";
export const FUND_END = "2026-11-30";

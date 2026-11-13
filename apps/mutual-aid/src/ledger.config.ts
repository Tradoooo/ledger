/** The extension points of the mutual aid fund: public by default, no envelope anywhere.
 *
 * A fund does not budget, it renders accounts: `envelopes` is absent on purpose, and the
 * only reports it publishes are the ones a donor can re-derive from the chain.
 */
import { defineLedger } from "@ledger/core";
import type { AccountInput, LedgerApp, RuleInput, Unit } from "@ledger/core";

const EUR: Unit = { kind: "currency", code: "EUR" };

const CHART: readonly AccountInput[] = [
  { id: "assets:bank:fund", type: "asset", unit: EUR, label: "Bank — mutual aid fund" },
  { id: "assets:cash", type: "asset", unit: EUR, label: "Cash box at the market stall" },
  { id: "income:donations", type: "income", unit: EUR, label: "Donations" },
  { id: "income:grants", type: "income", unit: EUR, label: "Grants" },
  { id: "expenses:aid:food", type: "expense", unit: EUR, label: "Aid — food" },
  { id: "expenses:aid:rent", type: "expense", unit: EUR, label: "Aid — rent" },
  { id: "expenses:aid:school", type: "expense", unit: EUR, label: "Aid — school canteen" },
  { id: "expenses:aid:energy", type: "expense", unit: EUR, label: "Aid — energy" },
  { id: "expenses:operations", type: "expense", unit: EUR, label: "Operations" },
  { id: "equity:opening", type: "equity", unit: EUR, label: "Opening equity" },
];

/** A rule proposes an account; it never writes a posting (core law). */
const rule = (id: string, value: string, accountId: string): RuleInput => ({
  id,
  when: { field: "memo", op: "contains", value },
  then: { accountId },
  frequency: "on-import",
});

const RULES: readonly RuleInput[] = [
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
export const FUND_START = "2026-01-01";
export const FUND_END = "2026-11-30";
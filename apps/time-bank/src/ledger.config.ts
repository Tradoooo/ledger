/** Extension point file of the « Neighbourhood time bank ».
 *
 * One unit — the hour — and one liability account per member: a member's account
 * holds the hours the bank owes them. The bank *accounts*, it does not budget, so
 * there is no envelope here, on purpose.
 */
import { chartUnit, defineLedger } from "@ledger/core";
import type { AccountInput, LedgerApp, Unit } from "@ledger/core";

/** The unit of the time bank: a quantity, not a currency. */
export const HOUR: Unit = { kind: "quantity", label: "hour" };

const CHART: readonly AccountInput[] = [
  { id: "members:marta", type: "liability", unit: HOUR, label: "Marta", normalBalance: "credit" },
  { id: "members:ali", type: "liability", unit: HOUR, label: "Ali", normalBalance: "credit" },
];

export const timeBank: LedgerApp = defineLedger({
  name: "Neighbourhood time bank",
  locale: "en",
  unit: HOUR,
  chart: CHART,
  rules: [],
  reports: ["trial-balance", "audit-trail"],
  presentation: { theme: "warm-paper", locale: "en", printTitle: "Time bank — monthly report" },
});

/** The code every posting carries: the core derives it from the unit label. */
export const UNIT = chartUnit(timeBank.chart);

export interface Member { readonly accountId: string; readonly label: string }

/** The members are the liability accounts of the chart: one source of truth. */
export const MEMBERS: readonly Member[] = timeBank.chart.accounts
  .filter((account) => account.type === "liability")
  .map((account) => ({ accountId: account.id, label: account.label }));

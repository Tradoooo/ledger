/** The empty application: the smallest thing that runs, and the template of `new-ledger-app`. */
import { defineLedger } from "@ledger/core";

const EUR = { kind: "currency", code: "EUR" } as const;

export const config = defineLedger({
  name: "Ledger skeleton",
  locale: "en",
  unit: EUR,
  chart: [
    { id: "assets:cash", type: "asset", unit: EUR, label: "Cash" },
    { id: "expenses:general", type: "expense", unit: EUR, label: "General expense" },
    { id: "income:general", type: "income", unit: EUR, label: "General income" },
    { id: "equity:opening", type: "equity", unit: EUR, label: "Opening balance" },
  ],
  rules: [],
  envelopes: [],
  reports: ["trial-balance", "audit-trail"],
  presentation: { theme: "plain", locale: "en", printTitle: "Ledger skeleton" },
});

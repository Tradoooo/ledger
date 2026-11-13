/** Extension point file of the « Household envelopes » application.
 *
 * Only declarations here: accounts, rules, envelopes, reports, presentation.
 * No accounting law, no screen, no I/O — `defineLedger` freezes all of it.
 */
import { defineLedger } from "@ledger/core";

const EUR = { kind: "currency", code: "EUR" } as const;

/** The month the envelopes are budgeted for. */
export const PERIOD = "2026-11";
/** The single unit of every amount in this application. */
export const UNIT = EUR.code;
/** Where imported movements land before a rule reclassifies them. */
export const BANK_ACCOUNT = "assets:bank:joint";
export const UNASSIGNED_ACCOUNT = "expenses:unassigned";
export const SALARY_ACCOUNT = "income:salary";

const ledger = defineLedger({
  name: "Household envelopes",
  locale: "fr",
  unit: EUR,
  chart: [
    { id: BANK_ACCOUNT, type: "asset", label: "Compte joint", unit: EUR, normalBalance: "debit", daily: true },
    { id: "expenses:food:groceries", type: "expense", label: "Courses", unit: EUR, normalBalance: "debit", daily: true },
    { id: "expenses:food:bakery", type: "expense", label: "Boulangerie", unit: EUR, normalBalance: "debit", daily: true },
    { id: "expenses:transport", type: "expense", label: "Transport", unit: EUR, normalBalance: "debit", daily: true },
    { id: "expenses:housing:rent", type: "expense", label: "Loyer", unit: EUR, normalBalance: "debit" },
    { id: "expenses:housing:energy", type: "expense", label: "Énergie", unit: EUR, normalBalance: "debit" },
    { id: "expenses:health", type: "expense", label: "Santé", unit: EUR, normalBalance: "debit" },
    { id: "expenses:leisure", type: "expense", label: "Loisirs", unit: EUR, normalBalance: "debit" },
    { id: "expenses:school", type: "expense", label: "École", unit: EUR, normalBalance: "debit" },
    { id: "expenses:other", type: "expense", label: "Autres", unit: EUR, normalBalance: "debit" },
    { id: "income:salary", type: "income", label: "Salaire", unit: EUR, normalBalance: "credit" },
    { id: "income:benefits", type: "income", label: "Prestations", unit: EUR, normalBalance: "credit" },
    { id: "equity:opening", type: "equity", label: "Ouverture", unit: EUR, normalBalance: "credit" },
    { id: UNASSIGNED_ACCOUNT, type: "expense", label: "À classer", unit: EUR, normalBalance: "debit" },
  ],
  rules: [
    rule("r-carrefour", "CARREFOUR", "expenses:food:groceries"),
    rule("r-boulangerie", "BOULANGERIE", "expenses:food:bakery"),
    rule("r-sncf", "SNCF", "expenses:transport"),
    rule("r-loyer", "LOYER", "expenses:housing:rent"),
    rule("r-edf", "EDF", "expenses:housing:energy"),
    rule("r-pharmacie", "PHARMACIE", "expenses:health"),
    rule("r-cafe", "CAFE", "expenses:leisure"),
    rule("r-librairie", "LIBRAIRIE", "expenses:leisure"),
    rule("r-assurance", "ASSURANCE", "expenses:other"),
    rule("r-essence", "ESSENCE", "expenses:transport"),
    rule("r-salaire", "SALAIRE", "income:salary"),
    rule("r-cpam", "CPAM", "income:benefits"),
    rule("r-caf", "CAF", "income:benefits"),
  ],
  envelopes: [
    envelope("env-courses", "Courses", "expenses:food:groceries", 45000, "carry"),
    envelope("env-boulangerie", "Boulangerie", "expenses:food:bakery", 8000, "carry"),
    envelope("env-transport", "Transport", "expenses:transport", 15000, "carry"),
    envelope("env-energie", "Énergie", "expenses:housing:energy", 18000, "carry-deficit"),
    envelope("env-sante", "Santé", "expenses:health", 20000, "none"),
    envelope("env-loisirs", "Loisirs", "expenses:leisure", 12000, "carry"),
  ],
  reports: ["envelopes", "trial-balance", "audit-trail"],
  presentation: { theme: "warm-paper", locale: "fr", printTitle: "Rapport du foyer" },
});

/** One authored rule: a memo pattern proposes an account, it never writes a posting. */
function rule(id: string, pattern: string, accountId: string) {
  return {
    id,
    when: { field: "memo" as const, op: "contains" as const, value: pattern },
    then: { accountId },
    frequency: "on-import" as const,
    origin: "authored" as const,
  };
}

/** One monthly envelope, budget in minor units. */
function envelope(id: string, label: string, accountId: string, budgetMinor: number, rollover: "none" | "carry" | "carry-deficit") {
  return { id, label, accountId, period: PERIOD, budgetMinor, unit: UNIT, rollover };
}

export default ledger;
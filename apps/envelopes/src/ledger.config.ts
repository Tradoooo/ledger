/** Fichier d'extension de « Household envelopes » : comptes, règles, enveloppes, thème. Aucune loi, aucun écran. */
import { defineLedger } from "@ledger/core";

const EUR = { kind: "currency", code: "EUR" } as const;

/** Le mois budgété, et l'unité unique de tous les montants. */
export const PERIOD = "2026-11";
export const UNIT = EUR.code;
/** Où tombent les mouvements importés, et les deux comptes que l'import utilise aussi. */
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
    { id: "expenses:other", type: "expense", label: "Autres", unit: EUR, normalBalance: "debit" },
    { id: "income:salary", type: "income", label: "Salaire", unit: EUR, normalBalance: "credit" },
    { id: "income:benefits", type: "income", label: "Prestations", unit: EUR, normalBalance: "credit" },
    { id: UNASSIGNED_ACCOUNT, type: "expense", label: "À classer", unit: EUR, normalBalance: "debit" },
  ],
  rules: [
    rule("r-carrefour", "CARREFOUR", "expenses:food:groceries"), rule("r-boulangerie", "BOULANGERIE", "expenses:food:bakery"),
    rule("r-sncf", "SNCF", "expenses:transport"), rule("r-loyer", "LOYER", "expenses:housing:rent"),
    rule("r-edf", "EDF", "expenses:housing:energy"), rule("r-pharmacie", "PHARMACIE", "expenses:health"),
    rule("r-cafe", "CAFE", "expenses:leisure"), rule("r-librairie", "LIBRAIRIE", "expenses:leisure"),
    rule("r-assurance", "ASSURANCE", "expenses:other"), rule("r-essence", "ESSENCE", "expenses:transport"),
    rule("r-salaire", "SALAIRE", "income:salary"), rule("r-cpam", "CPAM", "income:benefits"), rule("r-caf", "CAF", "income:benefits"),
  ],
  envelopes: [
    envelope("env-courses", "Courses", "expenses:food:groceries", 45000, "carry"), envelope("env-boulangerie", "Boulangerie", "expenses:food:bakery", 8000, "carry"),
    envelope("env-transport", "Transport", "expenses:transport", 15000, "carry"), envelope("env-energie", "Énergie", "expenses:housing:energy", 18000, "carry-deficit"),
    envelope("env-sante", "Santé", "expenses:health", 20000, "none"), envelope("env-loisirs", "Loisirs", "expenses:leisure", 12000, "carry"),
  ],
  reports: ["envelopes", "trial-balance", "audit-trail"],
  presentation: { theme: "warm-paper", locale: "fr", printTitle: "Rapport du foyer" },
});

/** Une règle écrite : un motif sur le libellé propose un compte, il n'écrit jamais. */
function rule(id: string, pattern: string, accountId: string) {
  return { id, when: { field: "memo" as const, op: "contains" as const, value: pattern }, then: { accountId }, frequency: "on-import" as const, origin: "authored" as const };
}

/** Une enveloppe du mois, budget en unités mineures. */
function envelope(id: string, label: string, accountId: string, budgetMinor: number, rollover: "none" | "carry" | "carry-deficit") {
  return { id, label, accountId, period: PERIOD, budgetMinor, unit: UNIT, rollover };
}

export default ledger;

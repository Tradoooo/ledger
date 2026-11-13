/** Le livre de démonstration : synthétique, déterministe, construit en mémoire (aucun fichier, aucune requête). */
import { ulidFrom } from "@ledger/core";
import type { Entry, Posting } from "@ledger/core";

const SEED = 20261103;
let state = SEED;
/** Générateur congruentiel : la même graine donne le même livre, à chaque chargement. */
const random = (): number => (state = (Math.imul(state, 1103515245) + 12345) & 0x7fffffff) / 0x80000000;

/** Libellé, compte, montant minimum et maximum en unités mineures. */
type Line = readonly [string, string, number, number];
const SPEND: readonly Line[] = [
  ["CARREFOUR MARKET PARIS 12", "expenses:food:groceries", 2500, 14500], ["CB BOULANGERIE", "expenses:food:bakery", 180, 1450],
  ["CB SNCF CONNECT", "expenses:transport", 1200, 9800], ["CB PHARMACIE", "expenses:health", 420, 6800],
  ["PRLV EDF ENERGIE", "expenses:housing:energy", 8500, 18500], ["CB CAFE DU COMMERCE", "expenses:leisure", 350, 3200],
  ["CB LIBRAIRIE", "expenses:leisure", 500, 4500],
];
const INCOME: readonly Line[] = [["VIR SALAIRE ACME", "income:salary", 248000, 248000], ["VIR CPAM", "income:benefits", 1500, 9000]];
const MONTHS = ["2026-09", "2026-10", "2026-11"];
const EPOCH = Date.UTC(2026, 8, 1);

/** Une écriture équilibrée : le mouvement sur le compte, le compte joint en miroir. */
function entry(index: number, date: string, label: string, accountId: string, amountMinor: number): Entry {
  const id = ulidFrom(EPOCH + index * 86_400_000, Array.from({ length: 10 }, (_, b) => (index * 7 + b * 13) % 256));
  const postings: Posting[] = [
    { id: `${id}-a`, accountId, amountMinor, unit: "EUR" },
    { id: `${id}-b`, accountId: "assets:bank:joint", amountMinor: -amountMinor, unit: "EUR" },
  ];
  return { id, date, note: label, unit: "EUR", kind: "transaction", reverses: null, tags: [], postings };
}

/** Trois mois ; une dépense sur quatre reste « à classer », pour l'écran des affectations. */
export function demoEntries(): Entry[] {
  const entries: Entry[] = [];
  let index = 0;
  for (const month of MONTHS) {
    for (let step = 0; step < 34; step++) {
      const date = `${month}-${String(1 + Math.floor(random() * 28)).padStart(2, "0")}`;
      const income = random() < 0.12;
      const pool = income ? INCOME : SPEND;
      const [label, account, min, max] = pool[Math.floor(random() * pool.length)]!;
      const amount = min + Math.floor(random() * (max - min + 1));
      const target = income || random() >= 0.25 ? account : "expenses:unassigned";
      entries.push(entry(index++, date, label, target, income ? -amount : amount));
    }
  }
  return entries;
}

/** The demonstration book: synthetic, deterministic, built in memory (no file, no request).
 *
 * Same seed as `scripts/gen-fixtures.mjs`, so the demo and the published CSV tell the same story.
 * A visitor who imports their own statement replaces it; nothing is uploaded anywhere.
 */
import { ulidFrom } from "@ledger/core";
import type { Entry, Posting } from "@ledger/core";

const SEED = 20261103;
const random = (() => {
  let state = SEED;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();

const SPEND: readonly (readonly [string, string, number, number])[] = [
  ["CARREFOUR MARKET PARIS 12", "expenses:food:groceries", 2500, 14500],
  ["CB BOULANGERIE DU COIN", "expenses:food:bakery", 180, 1450],
  ["CB SNCF CONNECT", "expenses:transport", 1200, 9800],
  ["CB PHARMACIE DE LA PLACE", "expenses:health", 420, 6800],
  ["PRLV SEPA EDF ENERGIE", "expenses:housing:energy", 8500, 18500],
  ["CB CAFE DU COMMERCE", "expenses:leisure", 350, 3200],
  ["CB LIBRAIRIE PAPETERIE", "expenses:leisure", 500, 4500],
];
const INCOME: readonly (readonly [string, string, number, number])[] = [
  ["VIR SALAIRE ACME FRANCE", "income:salary", 248000, 248000],
  ["VIR REMBOURSEMENT CPAM", "income:benefits", 1500, 9000],
];
const MONTHS = ["2026-09", "2026-10", "2026-11"] as const;
const DAY_MS = 86_400_000;
const EPOCH = Date.UTC(2026, 8, 1);

/** A balanced entry: the movement lands on the expense or income account, the bank mirrors it. */
function entry(index: number, date: string, label: string, accountId: string, amountMinor: number): Entry {
  const id = ulidFrom(EPOCH + index * DAY_MS, Array.from({ length: 10 }, (_, byte) => (index * 7 + byte * 13) % 256));
  const postings: Posting[] = [
    { id: `${id}-a`, accountId, amountMinor, unit: "EUR" },
    { id: `${id}-b`, accountId: "assets:bank:joint", amountMinor: -amountMinor, unit: "EUR" },
  ];
  return { id, date, note: label, unit: "EUR", kind: "transaction", reverses: null, tags: [], postings };
}

/** 3 months, ~150 entries, every month balanced as a whole through the income lines. */
export function demoEntries(): Entry[] {
  const entries: Entry[] = [];
  let index = 0;
  for (const month of MONTHS) {
    const count = 34;
    for (let step = 0; step < count; step++) {
      const day = String(1 + Math.floor(random() * 28)).padStart(2, "0");
      const date = `${month}-${day}`;
      const isIncome = random() < 0.12;
      const [label, account, min, max] = isIncome
        ? INCOME[Math.floor(random() * INCOME.length)]!
        : SPEND[Math.floor(random() * SPEND.length)]!;
      const amount = min + Math.floor(random() * (max - min + 1));
      const signed = isIncome ? -amount : amount; // income accounts are credit-normal
      entries.push(entry(index++, date, label, account, signed));
    }
  }
  return entries;
}

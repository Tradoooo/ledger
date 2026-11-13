/** The demo ledger of the fund: 214 synthetic entries, seed 20261103.
 *
 * The CSV in `fixtures/` cannot be read in a static page, so the same shape is generated
 * here: two thirds of donations, one third of aid, between January and November 2026.
 * Determinism comes from mulberry32 and a counter-fed ULID factory: no clock, no
 * `Math.random`, so every browser and every node run builds the very same chain.
 */
import { append, createJournal, totalsByType, ulidFactory } from "@ledger/core";
import type { Chart, Entry, Journal, PartyRef, Posting } from "@ledger/core";

const SEED = 20261103;
const START_MS = Date.UTC(2026, 0, 1);
const DAY_MS = 86_400_000;
const SPAN_DAYS = 334; // 2026-01-01 .. 2026-11-30
const ENTRY_COUNT = 214;
const UNIT = "EUR";

/** mulberry32: 32-bit state, identical numbers everywhere. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** The clock and the bytes are both counters: same ids on every run. */
function idFactory(): () => string {
  const random = seeded(SEED);
  let tick = START_MS;
  return ulidFactory(() => (tick += 1), () => Uint8Array.from({ length: 10 }, () => Math.floor(random() * 256)));
}

const party = (id: string, label: string, publicLabel: string, disclosed: boolean): PartyRef => ({ id, label, publicLabel, disclosed });

const DONORS: readonly PartyRef[] = [
  party("donor-household", "A household", "a household", true),
  party("donor-shop", "A local shop", "a local shop", true),
  party("donor-anonymous", "Anonymous", "anonymous", false),
];

/** Money out: the aid account, the label a donor reads, the memo of the case. */
const AIDS: readonly (readonly [string, string, string])[] = [
  ["expenses:aid:food", "Food voucher", "food voucher for the week"],
  ["expenses:aid:rent", "Rent aid", "one month of rent"],
  ["expenses:aid:school", "Canteen", "school canteen, one term"],
  ["expenses:aid:energy", "Energy bill", "energy arrears"],
];

const HOUSEHOLDS: readonly PartyRef[] = Array.from({ length: 12 }, (_, index) =>
  party(`household-${String(index + 1).padStart(2, "0")}`, `Household ${index + 1}`, "a household", false));

/** One entry, the same shape whether money comes in (a donation) or goes out (an aid). */
function demoEntry(index: number, id: () => string, random: () => number): Entry {
  const aid = index % 3 === 2;
  const donor = DONORS[Math.floor(random() * DONORS.length)] ?? DONORS[2]!;
  const household = HOUSEHOLDS[Math.floor(random() * HOUSEHOLDS.length)] ?? HOUSEHOLDS[0]!;
  const kind = AIDS[Math.floor(random() * AIDS.length)] ?? AIDS[0]!;
  const amountMinor = Math.round((aid ? 15 + random() * 305 : 5 + random() * 245) * 100);
  const fund: Posting = { id: id(), accountId: "assets:bank:fund", amountMinor: aid ? -amountMinor : amountMinor, unit: UNIT };
  const evidence = [`${aid ? "case" : "receipt"}-${String(index).padStart(3, "0")}`];
  const other: Posting = aid
    ? { id: id(), accountId: kind[0], amountMinor, unit: UNIT, memo: kind[2], party: household, evidence }
    : { id: id(), accountId: "income:donations", amountMinor: -amountMinor, unit: UNIT, party: donor, evidence };
  return {
    id: id(),
    date: new Date(START_MS + Math.floor((index * SPAN_DAYS) / ENTRY_COUNT) * DAY_MS).toISOString().slice(0, 10),
    note: aid ? `${kind[1]} — a household` : `Donation — ${donor.publicLabel}`,
    unit: UNIT,
    kind: "transaction",
    postings: aid ? [other, fund] : [fund, other],
    reverses: null,
    tags: [aid ? "aid" : "donation"],
  };
}

export function buildDemoJournal(): Journal {
  const id = idFactory();
  const random = seeded(SEED);
  let journal = createJournal("2026-01-01");
  for (let index = 0; index < ENTRY_COUNT; index++) journal = append(journal, demoEntry(index, id, random));
  return journal;
}

/** Built once, at import: every screen and the public view show the same chain. */
export const demoJournal: Journal = buildDemoJournal();

/** Collected = income credited, granted = aid debited. Two totals, no budget. */
export function fundTotals(journal: Journal, chart: Chart): { collectedMinor: number; grantedMinor: number } {
  const totals = totalsByType(journal, chart, { unit: UNIT });
  return { collectedMinor: totals.income, grantedMinor: totals.expense };
}

/** Index of the last donation: the entry the publish screen puts side by side. */
export function lastDonationIndex(journal: Journal): number {
  for (let index = journal.records.length - 1; index >= 0; index--) {
    const record = journal.records[index];
    if (record !== undefined && record.note.startsWith("Donation")) return index;
  }
  return Math.max(journal.records.length - 1, 0);
}

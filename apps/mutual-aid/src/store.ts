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
export const ENTRY_COUNT = 214;

export const UNIT = "EUR";

/** mulberry32: 32-bit state, identical numbers everywhere. */
export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function pick<T>(items: readonly T[], random: () => number): T {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) throw new Error("pick() needs a non-empty list");
  return item;
}

function moneyMinor(random: () => number, low: number, high: number): number {
  return Math.round((low + random() * (high - low)) * 100);
}

function isoDay(offsetDays: number): string {
  return new Date(START_MS + offsetDays * DAY_MS).toISOString().slice(0, 10);
}

/** Evenly spread over the eleven months; the index alone decides the date. */
function dayOffset(index: number): number {
  return Math.floor((index * SPAN_DAYS) / ENTRY_COUNT);
}

/** The clock and the bytes are both counters: same ids on every run. */
function idFactory(): () => string {
  const random = seeded(SEED);
  let tick = START_MS;
  return ulidFactory(
    () => (tick += 1),
    () => {
      const bytes = new Uint8Array(10);
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(random() * 256);
      return bytes;
    },
  );
}

const DONORS: readonly PartyRef[] = [
  { id: "donor-household", label: "A household", publicLabel: "a household", disclosed: true },
  { id: "donor-shop", label: "A local shop", publicLabel: "a local shop", disclosed: true },
  { id: "donor-anonymous", label: "Anonymous", publicLabel: "anonymous", disclosed: false },
];

const AIDS = [
  { accountId: "expenses:aid:food", note: "Food voucher", memo: "food voucher for the week" },
  { accountId: "expenses:aid:rent", note: "Rent aid", memo: "one month of rent" },
  { accountId: "expenses:aid:school", note: "Canteen", memo: "school canteen, one term" },
  { accountId: "expenses:aid:energy", note: "Energy bill", memo: "energy arrears" },
] as const;

const HOUSEHOLDS: readonly PartyRef[] = Array.from({ length: 12 }, (_, index) => ({
  id: `household-${String(index + 1).padStart(2, "0")}`,
  label: `Household ${index + 1}`,
  publicLabel: "a household",
  disclosed: false,
}));

function entry(index: number, entryId: string, note: string, postings: readonly Posting[], tag: string): Entry {
  return {
    id: entryId,
    date: isoDay(dayOffset(index)),
    note,
    unit: UNIT,
    kind: "transaction",
    postings: [...postings],
    reverses: null,
    tags: [tag],
  };
}

/** Money in: the bank is debited, donations are credited, the receipt is the evidence. */
function donationEntry(index: number, id: () => string, random: () => number): Entry {
  const donor = pick(DONORS, random);
  const amountMinor = moneyMinor(random, 5, 250);
  const postings: Posting[] = [
    {
      id: id(),
      accountId: "assets:bank:fund",
      amountMinor,
      unit: UNIT,
      party: donor,
      evidence: [`receipt-${String(index).padStart(3, "0")}`],
    },
    { id: id(), accountId: "income:donations", amountMinor: -amountMinor, unit: UNIT },
  ];
  return entry(index, id(), `Donation — ${donor.publicLabel}`, postings, "donation");
}

/** Money out: aid is debited, the bank is credited. The household stays pseudonymous. */
function aidEntry(index: number, id: () => string, random: () => number): Entry {
  const kind = pick(AIDS, random);
  const household = pick(HOUSEHOLDS, random);
  const amountMinor = moneyMinor(random, 15, 320);
  const postings: Posting[] = [
    {
      id: id(),
      accountId: kind.accountId,
      amountMinor,
      unit: UNIT,
      memo: kind.memo,
      party: household,
      evidence: [`case-${String(index).padStart(3, "0")}`],
    },
    { id: id(), accountId: "assets:bank:fund", amountMinor: -amountMinor, unit: UNIT },
  ];
  return entry(index, id(), `${kind.note} — a household`, postings, "aid");
}

export function buildDemoJournal(): Journal {
  const id = idFactory();
  const random = seeded(SEED);
  let journal = createJournal("2026-01-01");
  for (let index = 0; index < ENTRY_COUNT; index++) {
    journal = append(journal, index % 3 === 2 ? aidEntry(index, id, random) : donationEntry(index, id, random));
  }
  return journal;
}

/** Built once, at import: every screen and the public view show the same chain. */
export const demoJournal: Journal = buildDemoJournal();

export interface FundTotals {
  collectedMinor: number;
  grantedMinor: number;
}

/** Collected = income credited, granted = aid debited. Two totals, no budget. */
export function fundTotals(journal: Journal, chart: Chart): FundTotals {
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
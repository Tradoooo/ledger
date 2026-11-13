import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { defineChart } from "./chart.js";
import type { Chart } from "./chart.js";
import { append, createJournal } from "./journal.js";
import { GENESIS } from "./hash.js";
import { Report } from "./schema.js";
import type { Entry, Journal, Posting } from "./schema.js";
import { auditTrail, incomeStatement, trialBalance } from "./reports.js";
import { entry, posting, transfer, ulid } from "../tests/helpers.js";

const UNIT = { kind: "currency", code: "EUR" } as const;
const ACCOUNTS = ["assets:bank", "expenses:food", "expenses:rent", "income:donations"] as const;

const chart: Chart = defineChart([
  { id: "assets:bank", type: "asset", normalBalance: "debit", unit: UNIT, label: "Banque" },
  { id: "expenses:food", type: "expense", normalBalance: "debit", unit: UNIT, label: "Alimentation" },
  { id: "expenses:rent", type: "expense", normalBalance: "debit", unit: UNIT, label: "Loyer" },
  { id: "income:donations", type: "income", normalBalance: "credit", unit: UNIT, label: "Dons" },
]);

const shapeOk = (report: unknown): boolean => Report.safeParse(report).success;

/** Don reçu, courses, loyer: three balanced entries over three months. */
function fixture(): Journal {
  let journal = createJournal("2026-01-01");
  journal = append(journal, transfer("income:donations", "assets:bank", 100_000, { id: ulid(1), date: "2026-01-10", note: "don" }));
  journal = append(journal, transfer("assets:bank", "expenses:food", 30_000, { id: ulid(2), date: "2026-02-05", note: "courses" }));
  journal = append(journal, transfer("assets:bank", "expenses:rent", 45_000, { id: ulid(3), date: "2026-03-01", note: "loyer" }));
  return journal;
}

/** A reversal of an entry: same amounts, opposite direction, kind=reversal. */
function reversed(): Journal {
  let journal = createJournal("2026-11-01");
  journal = append(journal, transfer("assets:bank", "expenses:food", 4_820, { id: ulid(7), date: "2026-11-03", note: "erreur" }));
  journal = append(journal, transfer("expenses:food", "assets:bank", 4_820, {
    id: ulid(8), date: "2026-11-04", note: "extourne", kind: "reversal", reverses: ulid(7),
  }));
  return journal;
}

describe("trialBalance", () => {
  it("returns an empty, balanced report on an empty journal", () => {
    const report = trialBalance(createJournal("2026-01-01"), chart, { asOf: "2026-12-31", unit: "EUR" });
    expect(report.rows).toEqual([]);
    expect(report.totals).toEqual({ debit: 0, credit: 0 });
    expect(report).toMatchObject({ kind: "trial-balance", asOf: "2026-12-31", unit: "EUR" });
    expect(shapeOk(report)).toBe(true);
  });

  it("splits every non-zero balance into debit and credit columns", () => {
    const report = trialBalance(fixture(), chart, { asOf: "2026-12-31", unit: "EUR" });
    expect(report.rows.map((r) => r.accountId)).toEqual(["assets:bank", "expenses:food", "expenses:rent", "income:donations"]);
    expect(report.rows.map((r) => r.label)).toEqual(["Banque", "Alimentation", "Loyer", "Dons"]);
    expect(report.rows[0]).toEqual({ accountId: "assets:bank", label: "Banque", debit: 25_000, credit: 0, balance: 25_000 });
    expect(report.rows[3]).toEqual({ accountId: "income:donations", label: "Dons", debit: 0, credit: 100_000, balance: -100_000 });
    expect(report.totals).toEqual({ debit: 100_000, credit: 100_000 });
    for (const row of report.rows) expect(row.balance).toBe(row.debit - row.credit);
    expect(shapeOk(report)).toBe(true);
  });

  it("bounds the exercise at asOf (inclusive) and falls back to the id for unknown accounts", () => {
    let journal = fixture();
    journal = append(journal, transfer("assets:bank", "assets:ghost", 1_000, { id: ulid(4), date: "2027-01-02", note: "hors exercice" }));
    const bounded = trialBalance(journal, chart, { asOf: "2026-12-31", unit: "EUR" });
    expect(bounded.rows.map((r) => r.accountId)).not.toContain("assets:ghost");
    expect(bounded.totals).toEqual({ debit: 100_000, credit: 100_000 });
    const later = trialBalance(journal, chart, { asOf: "2027-01-02", unit: "EUR" });
    const ghost = later.rows.find((r) => r.accountId === "assets:ghost");
    expect(ghost).toEqual({ accountId: "assets:ghost", label: "assets:ghost", debit: 1_000, credit: 0, balance: 1_000 });
    expect(later.rows.find((r) => r.accountId === "assets:bank")?.balance).toBe(24_000);
    expect(later.totals).toEqual({ debit: 100_000, credit: 100_000 });
    expect(shapeOk(later)).toBe(true);
  });

  it("nets a reversal back to nothing", () => {
    const report = trialBalance(reversed(), chart, { asOf: "2026-12-31", unit: "EUR" });
    expect(report.rows).toEqual([]);
    expect(report.totals).toEqual({ debit: 0, credit: 0 });
  });
});

describe("incomeStatement", () => {
  it("computes net = income - expense over the bounded exercise", () => {
    const year = incomeStatement(fixture(), chart, { from: "2026-01-01", to: "2026-12-31", unit: "EUR" });
    expect(year.rows.map((r) => r.accountId)).toEqual(["expenses:food", "expenses:rent", "income:donations"]);
    expect(year.netMinor).toBe(25_000);
    expect(year).toMatchObject({ kind: "income-statement", from: "2026-01-01", to: "2026-12-31", unit: "EUR" });
    expect(shapeOk(year)).toBe(true);
  });

  it("keeps boundaries inclusive and ignores entries outside them", () => {
    const february = incomeStatement(fixture(), chart, { from: "2026-02-01", to: "2026-02-28", unit: "EUR" });
    expect(february.rows.map((r) => r.accountId)).toEqual(["expenses:food"]);
    expect(february.netMinor).toBe(-30_000);
    const day = incomeStatement(fixture(), chart, { from: "2026-02-05", to: "2026-02-05", unit: "EUR" });
    expect(day.netMinor).toBe(-30_000);
    const before = incomeStatement(fixture(), chart, { from: "2026-02-06", to: "2026-02-28", unit: "EUR" });
    expect(before.rows).toEqual([]);
    expect(before.netMinor).toBe(0);
  });

  it("returns zero on an empty journal and never counts asset or liability accounts", () => {
    const empty = incomeStatement(createJournal("2026-01-01"), chart, { from: "2026-01-01", to: "2026-12-31", unit: "EUR" });
    expect(empty.rows).toEqual([]);
    expect(empty.netMinor).toBe(0);
    expect(shapeOk(empty)).toBe(true);
    const withBank = incomeStatement(fixture(), chart, { from: "2026-01-01", to: "2026-12-31", unit: "EUR" });
    expect(withBank.rows.map((r) => r.accountId)).not.toContain("assets:bank");
    const reversedYear = incomeStatement(reversed(), chart, { from: "2026-01-01", to: "2026-12-31", unit: "EUR" });
    expect(reversedYear.netMinor).toBe(0);
  });
});

describe("auditTrail", () => {
  it("returns GENESIS as head hash when nothing is selected", () => {
    const empty = auditTrail(createJournal("2026-01-01"), { from: "2026-01-01", to: "2026-12-31" });
    expect(empty).toEqual({ kind: "audit-trail", from: "2026-01-01", to: "2026-12-31", headHash: GENESIS, rows: [] });
    expect(shapeOk(empty)).toBe(true);
  });

  it("lists the selected records, in order, with the last hash as head", () => {
    const journal = fixture();
    const trail = auditTrail(journal, { from: "2026-02-01", to: "2026-12-31" });
    expect(trail.rows.map((r) => r.seq)).toEqual([1, 2]);
    expect(trail.rows.map((r) => r.note)).toEqual(["courses", "loyer"]);
    expect(trail.rows[0]).toEqual({
      seq: 1, date: "2026-02-05", note: "courses", kind: "transaction", hash: journal.records[1]!.hash, reverses: null,
    });
    expect(trail.headHash).toBe(journal.records[2]!.hash);
    expect(trail.headHash).not.toBe(GENESIS);
    expect(shapeOk(trail)).toBe(true);
  });

  it("names the entry a reversal reverses", () => {
    const journal = reversed();
    const trail = auditTrail(journal, { from: "2026-11-01", to: "2026-11-30" });
    expect(trail.rows).toHaveLength(2);
    expect(trail.rows[0]!.kind).toBe("transaction");
    expect(trail.rows[0]!.reverses).toBeNull();
    expect(trail.rows[1]!.kind).toBe("reversal");
    expect(trail.rows[1]!.reverses).toBe(ulid(7));
  });
});

const deltasArb = fc.array(fc.integer({ min: -90_000, max: 90_000 }), { minLength: 1, maxLength: 4 });
const entriesArb = fc.array(fc.tuple(deltasArb, fc.integer({ min: 1, max: 12 })), { minLength: 0, maxLength: 8 });

const dateOf = (index: number, month: number): string =>
  `2026-${String(month).padStart(2, "0")}-${String((index % 28) + 1).padStart(2, "0")}`;

/** One entry from raw deltas, balanced by a final posting on the first account. */
function randomEntry(index: number, deltas: number[], date: string): Entry {
  const postings: Posting[] = [];
  let sum = 0;
  deltas.forEach((delta, i) => {
    const accountId = ACCOUNTS[(index + i) % ACCOUNTS.length]!;
    postings.push(posting(accountId, delta, { id: `p-${index}-${i}` }));
    sum += delta;
  });
  postings.push(posting(ACCOUNTS[index % ACCOUNTS.length]!, -sum, { id: `p-${index}-bal` }));
  return entry({ id: ulid(1_000 + index), date, note: `alea ${index}`, postings });
}

describe("property", () => {
  it("property: total debits equal total credits on 50 random journals", () => {
    fc.assert(
      fc.property(entriesArb, (rows) => {
        let journal = createJournal("2026-01-01");
        rows.forEach(([deltas, month], index) => {
          journal = append(journal, randomEntry(index, deltas, dateOf(index, month)));
        });
        const report = trialBalance(journal, chart, { asOf: "2026-12-31", unit: "EUR" });
        expect(report.totals.debit).toBe(report.totals.credit);
        let signed = 0;
        for (const row of report.rows) {
          expect(row.balance).not.toBe(0);
          expect(row.balance).toBe(row.debit - row.credit);
          expect(row.debit >= 0 && row.credit >= 0).toBe(true);
          signed += row.balance;
        }
        expect(signed).toBe(0);
        expect(shapeOk(report)).toBe(true);
        const statement = incomeStatement(journal, chart, { from: "2026-01-01", to: "2026-12-31", unit: "EUR" });
        expect(shapeOk(statement)).toBe(true);
        expect(statement.rows.every((r) => r.accountId.startsWith("income:") || r.accountId.startsWith("expenses:"))).toBe(true);
      }),
      { numRuns: 50, seed: 20261113 },
    );
  });
});
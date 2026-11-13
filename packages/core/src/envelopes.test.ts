import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { append, createJournal } from "./journal.js";
import { defineChart } from "./chart.js";
import type { EnvelopeInput } from "./envelopes.js";
import { availableMinor, carriedIn, defineEnvelopes, envelopeReport, leftTodayMinor } from "./envelopes.js";
import type { Journal } from "./schema.js";
import { transfer, ulid } from "../tests/helpers.js";

const eur = { kind: "currency", code: "EUR" } as const;

const chart = defineChart([
  { id: "assets:bank", type: "asset", label: "Bank", unit: eur, normalBalance: "debit" },
  { id: "expenses:food", type: "expense", label: "Food", unit: eur, normalBalance: "debit", daily: true },
  { id: "expenses:food:grocery", type: "expense", label: "Grocery", unit: eur, normalBalance: "debit", parent: "expenses:food" },
  { id: "expenses:food:resto", type: "expense", label: "Resto", unit: eur, normalBalance: "debit", parent: "expenses:food" },
  { id: "expenses:fun", type: "expense", label: "Fun", unit: eur, normalBalance: "debit" },
]);

let counter = 0;

/** One real spend: money leaves the bank and lands on `accountId`, on `date`. */
const spend = (journal: Journal, accountId: string, amountMinor: number, date: string): Journal => {
  counter += 1;
  return append(journal, transfer("assets:bank", accountId, amountMinor, { id: ulid(counter), date, note: `spend ${counter}` }));
};

const atIndex = (index: number): string =>
  `${String(Math.floor(index / 12)).padStart(4, "0")}-${String((index % 12) + 1).padStart(2, "0")}`;

const periodsFrom = (start: string, count: number): readonly string[] => {
  const base = Number(start.slice(0, 4)) * 12 + Number(start.slice(5, 7)) - 1;
  return Array.from({ length: count }, (_, i) => atIndex(base + i));
};

const food = (over: Partial<EnvelopeInput> = {}): readonly EnvelopeInput[] => [
  { id: "food", label: "Food", accountId: "expenses:food", period: "2026-01", budgetMinor: 30000, unit: "EUR", ...over },
];

type Mode = "none" | "carry" | "carry-deficit";

/** Test-side reference of the rollover contract, written independently of src. */
const rollRef = (mode: Mode, cap: number | null, available: number): number => {
  const base = mode === "none" ? 0 : mode === "carry" ? Math.max(0, available) : available;
  return cap === null || cap === 0 ? base : Math.min(base, cap);
};

describe("defineEnvelopes", () => {
  it("fills the defaults and freezes the set", () => {
    const set = defineEnvelopes(food());
    expect(set.envelopes).toHaveLength(1);
    expect(set.get("food")).toMatchObject({ rollover: "carry", capMinor: null });
    expect(set.get("missing")).toBeUndefined();
    expect(Object.isFrozen(set)).toBe(true);
    expect(() => defineEnvelopes([...food(), ...food()])).toThrow();
  });

  it("forPeriod returns the envelopes active in that period", () => {
    const set = defineEnvelopes([...food(), { ...food()[0]!, id: "fun", label: "Fun", accountId: "expenses:fun", period: "2026-03" }]);
    expect(set.forPeriod("2026-01").map((e) => e.id)).toEqual(["food"]);
    expect(set.forPeriod("2026-03").map((e) => e.id)).toEqual(["food", "fun"]);
    expect(set.forPeriod("2025-12")).toEqual([]);
  });
});

describe("carriedIn and availableMinor", () => {
  it("carry keeps the surplus, none drops it, carry-deficit keeps the deficit", () => {
    const surplus = spend(createJournal("2026-01-01"), "expenses:food", 12000, "2026-01-10");
    expect(carriedIn(surplus, chart, defineEnvelopes(food()), "food", "2026-01")).toBe(0);
    expect(availableMinor(surplus, chart, defineEnvelopes(food()), "food", "2026-01")).toBe(18000);
    expect(carriedIn(surplus, chart, defineEnvelopes(food()), "food", "2026-02")).toBe(18000);
    expect(carriedIn(surplus, chart, defineEnvelopes(food({ rollover: "none" })), "food", "2026-02")).toBe(0);
    expect(availableMinor(surplus, chart, defineEnvelopes(food({ rollover: "none" })), "food", "2026-02")).toBe(30000);
    expect(carriedIn(surplus, chart, defineEnvelopes(food({ rollover: "carry-deficit" })), "food", "2026-02")).toBe(18000);

    const deficit = spend(createJournal("2026-01-01"), "expenses:food", 42000, "2026-01-10");
    expect(availableMinor(deficit, chart, defineEnvelopes(food()), "food", "2026-01")).toBe(-12000);
    expect(carriedIn(deficit, chart, defineEnvelopes(food()), "food", "2026-02")).toBe(0);
    expect(carriedIn(deficit, chart, defineEnvelopes(food({ rollover: "carry-deficit" })), "food", "2026-02")).toBe(-12000);
    expect(availableMinor(deficit, chart, defineEnvelopes(food({ rollover: "carry-deficit" })), "food", "2026-02")).toBe(18000);
  });

  it("chains month after month and caps the carry", () => {
    let journal = createJournal("2026-01-01");
    journal = spend(journal, "expenses:food", 10000, "2026-01-10");
    journal = spend(journal, "expenses:food", 5000, "2026-02-10");
    const set = defineEnvelopes(food());
    expect(availableMinor(journal, chart, set, "food", "2026-02")).toBe(30000 + 20000 - 5000);
    expect(carriedIn(journal, chart, set, "food", "2026-03")).toBe(45000);
    expect(carriedIn(journal, chart, defineEnvelopes(food({ capMinor: 5000 })), "food", "2026-03")).toBe(5000);
    expect(carriedIn(journal, chart, defineEnvelopes(food({ capMinor: 5000, rollover: "none" })), "food", "2026-03")).toBe(0);
  });

  it("counts a parent account with its children, and only its own unit", () => {
    let journal = createJournal("2026-01-01");
    journal = spend(journal, "expenses:food", 1000, "2026-01-05");
    journal = spend(journal, "expenses:food:grocery", 2000, "2026-01-06");
    journal = spend(journal, "expenses:food:resto", 3000, "2026-01-07");
    journal = spend(journal, "expenses:fun", 9999, "2026-01-08");
    journal = spend(journal, "expenses:food:grocery", 7777, "2026-02-06");
    const set = defineEnvelopes(food());
    expect(availableMinor(journal, chart, set, "food", "2026-01")).toBe(30000 - 6000);
    expect(availableMinor(journal, chart, set, "food", "2026-02")).toBe(30000 + 24000 - 7777);
  });
});

describe("leftTodayMinor and envelopeReport", () => {
  const monthly = (): readonly EnvelopeInput[] => [
    ...food(),
    { id: "fun", label: "Fun", accountId: "expenses:fun", period: "2026-01", budgetMinor: 10000, unit: "EUR" },
  ];

  it("divides the free money over the days left, floor, never negative", () => {
    let journal = createJournal("2026-01-01");
    journal = spend(journal, "expenses:food", 10000, "2026-01-10");
    journal = spend(journal, "expenses:fun", 5000, "2026-01-10");
    const set = defineEnvelopes(monthly());
    expect(leftTodayMinor(journal, chart, set, { period: "2026-01", daysLeft: 3 })).toBe(6666);
    expect(leftTodayMinor(journal, chart, set, { period: "2026-01", daysLeft: 3, committedMinor: 2000 })).toBe(6000);
    expect(leftTodayMinor(journal, chart, set, { period: "2026-01", daysLeft: 3, reserveMinor: 9000 })).toBe(3666);
    expect(leftTodayMinor(journal, chart, set, { period: "2026-01", daysLeft: 0 })).toBe(0);
    expect(leftTodayMinor(journal, chart, set, { period: "2026-01", daysLeft: 3, committedMinor: 50000 })).toBe(0);
  });

  it("builds one row per envelope of the period, with the shared total", () => {
    let journal = createJournal("2026-01-01");
    journal = spend(journal, "expenses:food", 10000, "2026-02-10");
    const set = defineEnvelopes(monthly());
    const report = envelopeReport(journal, chart, set, { period: "2026-02", daysLeft: 10, committedMinor: 1000 });
    expect(report.kind).toBe("envelopes");
    expect(report.period).toBe("2026-02");
    expect(report.unit).toBe("EUR");
    expect(report.daysLeft).toBe(10);
    expect(report.rows.map((r) => r.envelopeId)).toEqual(["food", "fun"]);
    expect(report.rows[0]).toMatchObject({ budgetMinor: 30000, spentMinor: 10000, carriedMinor: 30000, availableMinor: 50000 });
    expect(report.rows[0]!.leftTodayMinor).toBe(5000);
    expect(report.rows[1]).toMatchObject({ spentMinor: 0, leftTodayMinor: 0 });
    expect(report.totalLeftTodayMinor).toBe(4900);
  });
});

describe("property", () => {
  it("property (seed 20261113): 24 months conserve value — budgets + opening = spent + closing + abandoned", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 90000 }),
        fc.constantFrom<Mode>("none", "carry", "carry-deficit"),
        fc.option(fc.integer({ min: 1, max: 40000 }), { nil: null }),
        fc.array(fc.double({ min: 0, max: 1, noNaN: true }), { minLength: 24, maxLength: 24 }),
        (budget, mode, cap, fractions) => {
          const periods = periodsFrom("2026-01", 24);
          const spends: number[] = [];
          const carried: number[] = [];
          const availables: number[] = [];
          let previous = 0;
          for (const fraction of fractions) {
            const carryIn = rollRef(mode, cap, previous);
            const before = budget + carryIn;
            const amount = Math.floor(before * fraction);
            const after = before - amount;
            spends.push(amount);
            carried.push(carryIn);
            availables.push(after);
            previous = after;
          }
          let journal = createJournal("2026-01-01");
          periods.forEach((period, index) => {
            if (spends[index]! > 0) journal = spend(journal, "expenses:food", spends[index]!, `${period}-15`);
          });
          const set = defineEnvelopes(food({ budgetMinor: budget, rollover: mode, capMinor: cap }));
          let abandoned = 0;
          periods.forEach((period, index) => {
            expect(carriedIn(journal, chart, set, "food", period)).toBe(carried[index]);
            expect(availableMinor(journal, chart, set, "food", period)).toBe(availables[index]);
            if (index < periods.length - 1) abandoned += availables[index]! - rollRef(mode, cap, availables[index]!);
          });
          const totalSpent = spends.reduce((a, b) => a + b, 0);
          const closing = availables.at(-1)!;
          expect(abandoned).toBeGreaterThanOrEqual(0);
          expect(periods.length * budget + 0).toBe(totalSpent + closing + abandoned);
        },
      ),
      { numRuns: 30, seed: 20261113 },
    );
  });

  it("property (seed 20261113): overspending keeps the chain exact, deficits carry as a signed abandonment", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 60000 }),
        fc.constantFrom<Mode>("none", "carry", "carry-deficit"),
        fc.option(fc.integer({ min: 1, max: 20000 }), { nil: null }),
        fc.array(fc.integer({ min: 0, max: 150000 }), { minLength: 24, maxLength: 24 }),
        (budget, mode, cap, spends) => {
          const periods = periodsFrom("2026-01", 24);
          const carried: number[] = [];
          const availables: number[] = [];
          let previous = 0;
          spends.forEach((amount) => {
            const carryIn = rollRef(mode, cap, previous);
            const after = budget + carryIn - amount;
            carried.push(carryIn);
            availables.push(after);
            previous = after;
          });
          let journal = createJournal("2026-01-01");
          periods.forEach((period, index) => {
            if (spends[index]! > 0) journal = spend(journal, "expenses:food", spends[index]!, `${period}-15`);
          });
          const set = defineEnvelopes(food({ budgetMinor: budget, rollover: mode, capMinor: cap }));
          let dropped = 0;
          periods.forEach((period, index) => {
            expect(carriedIn(journal, chart, set, "food", period)).toBe(carried[index]);
            expect(availableMinor(journal, chart, set, "food", period)).toBe(availables[index]);
            if (index < periods.length - 1) dropped += availables[index]! - rollRef(mode, cap, availables[index]!);
          });
          const totalSpent = spends.reduce((a, b) => a + b, 0);
          expect(periods.length * budget + 0).toBe(totalSpent + availables.at(-1)! + dropped);
        },
      ),
      { numRuns: 30, seed: 20261113 },
    );
  });

  it("property (seed 20261113): spending leftToday every remaining day never breaks the month", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 300000 }),
        fc.integer({ min: 1, max: 31 }),
        fc.integer({ min: 0, max: 20000 }),
        fc.integer({ min: 0, max: 20000 }),
        (free, daysLeft, committed, reserve) => {
          let journal = createJournal("2026-01-01");
          journal = spend(journal, "expenses:food", 300000 - free, "2026-01-10");
          const set = defineEnvelopes([...food({ budgetMinor: 300000 }), { id: "fun", label: "Fun", accountId: "expenses:fun", period: "2026-01", budgetMinor: 0, unit: "EUR" }]);
          const left = leftTodayMinor(journal, chart, set, { period: "2026-01", daysLeft, committedMinor: committed, reserveMinor: reserve });
          expect(left).toBeGreaterThanOrEqual(0);
          const room = free - committed - reserve;
          const residue = room - daysLeft * left;
          if (room >= 0) {
            expect(residue).toBeGreaterThanOrEqual(0);
            expect(residue).toBeLessThan(daysLeft);
          } else {
            expect(left).toBe(0);
          }
        },
      ),
      { numRuns: 30, seed: 20261113 },
    );
  });
});
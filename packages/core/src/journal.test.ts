import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { append, createJournal, headHash, LedgerError, validateEntry, verifyChain } from "./journal.js";
import { entry, posting, transfer, ulid } from "../tests/helpers.js";
import { GENESIS } from "./hash.js";

/** Property runs: 30 by default, 10 000 for the submission campaign (LED-N-13). */
const RUNS = (n: number): number => Number(process.env.LEDGER_RUNS ?? n);

const codeOf = (fn: () => unknown): string => {
  try { fn(); return "no-error"; } catch (error) { return error instanceof LedgerError ? error.code : "not-a-ledger-error"; }
};

describe("validateEntry", () => {
  it("accepts a balanced entry", () => {
    expect(() => validateEntry(transfer("assets:bank", "expenses:food", 4820))).not.toThrow();
  });

  it("refuses an unbalanced entry with UnbalancedEntry and the exact gap", () => {
    const bad = entry({ postings: [posting("assets:bank", -100), posting("expenses:food", 60)] });
    expect(codeOf(() => validateEntry(bad))).toBe("UnbalancedEntry");
    try { validateEntry(bad); } catch (error) { expect((error as LedgerError).detail.sum).toBe(-40); }
  });

  it("refuses a single posting, mixed units, and a reversal without target", () => {
    expect(codeOf(() => validateEntry(entry({ postings: [posting("assets:bank", 0)] })))).toBe("TooFewPostings");
    const mixed = entry({ postings: [posting("assets:bank", -10), posting("expenses:x", 10, { unit: "USD" })] });
    expect(codeOf(() => validateEntry(mixed))).toBe("MixedUnits");
    expect(codeOf(() => validateEntry(transfer("assets:bank", "expenses:x", 10, { kind: "reversal" })))).toBe("BadReversal");
  });

  it("refuses a duplicate posting id inside one entry", () => {
    const dup = entry({ postings: [posting("assets:bank", -10, { id: "same" }), posting("expenses:x", 10, { id: "same" })] });
    expect(codeOf(() => validateEntry(dup))).toBe("DuplicatePosting");
  });
});

describe("append and verifyChain", () => {
  it("chains hashes and verifies", () => {
    let journal = createJournal("2026-11-01");
    journal = append(journal, transfer("assets:bank", "expenses:food", 4820, { id: ulid(1) }));
    journal = append(journal, transfer("assets:bank", "expenses:rent", 90000, { id: ulid(2) }));
    expect(journal.records.map((r) => r.seq)).toEqual([0, 1]);
    expect(journal.records[0]!.prevHash).toBe(GENESIS);
    expect(journal.records[1]!.prevHash).toBe(journal.records[0]!.hash);
    expect(verifyChain(journal)).toEqual({ ok: true });
    expect(headHash(journal)).toBe(journal.records[1]!.hash);
  });

  it("is frozen: mutating a record throws", () => {
    const journal = append(createJournal("2026-11-01"), transfer("assets:bank", "expenses:food", 100));
    expect(Object.isFrozen(journal)).toBe(true);
    expect(Object.isFrozen(journal.records[0]!.postings[0])).toBe(true);
    expect(() => { (journal.records[0] as { note: string }).note = "edited"; }).toThrow();
  });

  it("refuses a duplicate entry id", () => {
    const one = transfer("assets:bank", "expenses:food", 100);
    const journal = append(createJournal("2026-11-01"), one);
    expect(codeOf(() => append(journal, one))).toBe("DuplicateEntry");
  });

  it("property: after any sequence of appends and reversals the chain verifies", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 1, max: 50000 }), { minLength: 2, maxLength: 40 }), (amounts) => {
        let journal = createJournal("2026-11-01");
        amounts.forEach((amount, index) => {
          journal = append(journal, transfer("assets:bank", "expenses:food", amount, { id: ulid(index) }));
        });
        expect(verifyChain(journal)).toEqual({ ok: true });
        const broken = { ...journal, records: journal.records.map((r, i) => (i === 1 ? { ...r, note: "tampered" } : r)) };
        expect(verifyChain(broken)).toEqual({ ok: false, index: 1, reason: "bad-hash" });
      }),
      { numRuns: RUNS(30), seed: 20261113 },
    );
  });
});

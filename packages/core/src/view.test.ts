import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { append, createJournal, headHash, validateEntry, verifyChain } from "./journal.js";
import { View } from "./schema.js";
import type { Journal, RedactionPolicy } from "./schema.js";
import { decodeView, encodeView, pseudonym, redactEntry, redactJournal, ViewError } from "./view.js";
import { entry, posting, transfer, ulid } from "../tests/helpers.js";

/** Property runs: 30 by default, 10 000 for the submission campaign (LED-N-13). */
const RUNS = (n: number): number => Number(process.env.LEDGER_RUNS ?? n);

const SEED = 20261113;
const STRICT: RedactionPolicy = { parties: "pseudonymised", dates: "month", amounts: "exact", memo: "whitelist", minGroupSize: 3 };
const AGGREGATE: RedactionPolicy = { ...STRICT, parties: "aggregate" };
const LOOSE: RedactionPolicy = { parties: "named", dates: "exact", amounts: "exact", memo: "as-is", minGroupSize: 3 };

/** A partyed entry whose every free-text field carries the same unique marker. */
function privateEntry(secret: string, seq: number) {
  const amount = 100 + seq;
  return entry({
    id: ulid(seq),
    date: `2026-11-${String((seq % 28) + 1).padStart(2, "0")}`,
    note: `${secret}-note`,
    postings: [
      posting("expenses:food", amount, {
        id: `p-exp-${seq}`,
        memo: `${secret}-memo`,
        party: { id: `${secret}-id`, label: `${secret}-label`, publicLabel: "Counterparty", disclosed: false },
        evidence: [`${secret}-evidence`],
      }),
      posting("assets:bank", -amount, { id: `p-bank-${seq}` }),
    ],
  });
}

function privateJournal(secrets: readonly string[]): Journal {
  return secrets.reduce((journal, secret, seq) => append(journal, privateEntry(secret, seq)), createJournal("2026-11-01"));
}

const secretArb = fc.array(fc.stringMatching(/^[0-9a-f]{8}$/).map((hex) => `PRIV-${hex}`), { minLength: 1, maxLength: 4 });

const isoDateArb = fc
  .tuple(fc.integer({ min: 2020, max: 2030 }), fc.integer({ min: 1, max: 12 }), fc.integer({ min: 1, max: 28 }))
  .map(([year, month, day]) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
const accountArb = fc
  .tuple(fc.constantFrom("assets", "expenses", "income", "equity", "liabilities"), fc.integer({ min: 0, max: 40 }))
  .map(([head, n]) => `${head}:bucket-${n}`);
const policyArb = fc.record({
  parties: fc.constantFrom("named", "pseudonymised", "aggregate"),
  dates: fc.constantFrom("exact", "month"),
  amounts: fc.constantFrom("exact", "bucket10"),
  memo: fc.constantFrom("as-is", "whitelist"),
  minGroupSize: fc.integer({ min: 1, max: 9 }),
});
const viewArb: fc.Arbitrary<View> = fc
  .record({
    v: fc.constant(1 as const),
    app: fc.constantFrom("envelopes", "mutual-aid", "skeleton"),
    report: fc.constantFrom("trial-balance", "income-statement", "envelopes", "audit-trail", "public-ledger"),
    params: fc.record({
      from: fc.option(isoDateArb, { nil: undefined }),
      to: fc.option(isoDateArb, { nil: undefined }),
      period: fc.option(isoDateArb.map((date) => date.slice(0, 7)), { nil: undefined }),
      accounts: fc.array(accountArb, { maxLength: 5 }),
      tags: fc.array(fc.string({ maxLength: 12 }), { maxLength: 4 }),
    }),
    redaction: fc.option(policyArb, { nil: undefined }),
  })
  .map((raw) => View.parse(raw));

const twentyAccountView = (): View =>
  View.parse({
    v: 1,
    app: "envelopes",
    report: "trial-balance",
    params: {
      from: "2026-01-01",
      to: "2026-12-31",
      accounts: Array.from({ length: 20 }, (_, i) => `assets:account-${i}`),
      tags: ["public"],
    },
    redaction: { parties: "pseudonymised", dates: "month", amounts: "bucket10", memo: "whitelist", minGroupSize: 3 },
  });

describe("pseudonym", () => {
  it("is stable, salted, and shaped as party-<8 hex>", () => {
    expect(pseudonym("alice")).toMatch(/^party-[0-9a-f]{8}$/);
    expect(pseudonym("alice")).toBe(pseudonym("alice"));
    expect(pseudonym("alice")).not.toBe(pseudonym("bob"));
    expect(pseudonym("alice", "other")).not.toBe(pseudonym("alice"));
  });
});

describe("redactEntry", () => {
  it("drops the evidence, truncates the date, and keeps the entry valid and balanced", () => {
    const redacted = redactEntry(privateEntry("PRIV-cafe0001", 0), STRICT);
    expect(redacted.postings.every((p) => p.evidence === undefined)).toBe(true);
    expect(redacted.date).toBe("2026-11-01");
    expect(() => validateEntry(redacted)).not.toThrow();
    expect(redacted.postings.map((p) => p.amountMinor)).toEqual([100, -100]);
    expect(redacted.note).not.toContain("PRIV-");
    expect(JSON.stringify(redacted)).not.toContain("PRIV-cafe0001");
  });

  it("honours each party policy", () => {
    const source = privateEntry("PRIV-cafe0002", 1);
    expect(redactEntry(source, LOOSE).postings[0]!.party).toEqual(source.postings[0]!.party);
    const pseudonymised = redactEntry(source, STRICT).postings[0]!.party;
    expect(pseudonymised!.label).toBe(pseudonym("PRIV-cafe0002-id"));
    expect(pseudonymised!.id).toBe(pseudonym("PRIV-cafe0002-id"));
    expect(pseudonymised!.publicLabel).toBe("Counterparty");
    expect(redactEntry(source, AGGREGATE).postings[0]!.party).toBeUndefined();
  });

  it("writes light or heavy memo, never silence about amounts", () => {
    const source = entry({ postings: [posting("assets:bank", -5, { memo: "groceries" }), posting("expenses:food", 5)] });
    const loose = redactEntry(source, LOOSE);
    expect(loose.postings[0]!.memo).toBe("groceries");
    expect(loose.note).toBe(source.note);
    expect(redactEntry(source, STRICT).postings[0]!.memo).toBeUndefined();
    expect(redactEntry(source, STRICT).note).not.toBe(source.note);
  });
});

describe("redactJournal", () => {
  it("rebuilds a verifiable chain whose head moved", () => {
    const journal = privateJournal(["PRIV-deadbeef", "PRIV-feedface"]);
    const redacted = redactJournal(journal, STRICT);
    expect(verifyChain(redacted)).toEqual({ ok: true });
    expect(redacted.records.map((r) => r.seq)).toEqual([0, 1]);
    expect(redacted.records[1]!.prevHash).toBe(redacted.records[0]!.hash);
    expect(redacted.records.map((r) => r.id)).toEqual(journal.records.map((r) => r.id));
    expect(headHash(redacted)).not.toBe(headHash(journal));
  });

  it("property: no private marker survives, under a pseudonym or an aggregate policy", () => {
    fc.assert(
      fc.property(secretArb, (secrets) => {
        const journal = privateJournal(secrets);
        for (const policy of [STRICT, AGGREGATE]) {
          const text = JSON.stringify(redactJournal(journal, policy));
          for (const secret of secrets) {
            expect(text).not.toContain(secret);
            expect(text).not.toContain(`${secret}-id`);
          }
          expect(text).not.toContain("evidence");
        }
      }),
      { numRuns: RUNS(15), seed: SEED },
    );
  });
});

describe("encodeView / decodeView", () => {
  it("round-trips a view and keeps a 20-account view under 2000 chars", async () => {
    const view = twentyAccountView();
    const fragment = await encodeView(view);
    expect(fragment.length).toBeLessThanOrEqual(2000);
    expect(await decodeView(fragment)).toEqual(view);
    expect(await decodeView(`#v=${fragment}`)).toEqual(view);
  });

  it("reads the uncompressed 0. scheme, with or without the #v= prefix", async () => {
    const view = twentyAccountView();
    const plain = `0.${btoa(JSON.stringify({ ...view, v: 1 })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
    expect(await decodeView(plain)).toEqual(view);
    expect(await decodeView(`#v=${plain}`)).toEqual(view);
  });

  it("refuses an oversized view", async () => {
    const huge = View.parse({
      v: 1,
      app: "skeleton",
      report: "public-ledger",
      params: { tags: Array.from({ length: 4000 }, (_, i) => `${i.toString(36)}${(i * 2654435761 % 46655).toString(36)}`) },
    });
    await expect(encodeView(huge)).rejects.toBeInstanceOf(ViewError);
  });

  it("throws ViewError, and only ViewError, on anything else", async () => {
    for (const bad of ["", "1.", "0.", "2.", "abc", "1.!!!!", "0.!!!!", "1.zzzz", "0.zzzz", "#v=", "#v=1."]) {
      const outcome = await decodeView(bad).then(() => "accepted", (error: unknown) => (error instanceof ViewError ? "view-error" : "wrong-error"));
      expect(outcome).toBe("view-error");
    }
  });

  it("property: encode/decode round-trips every valid view", async () => {
    await fc.assert(
      fc.asyncProperty(viewArb, async (view) => {
        const fragment = await encodeView(view);
        expect(fragment.length).toBeLessThanOrEqual(2000);
        expect(await decodeView(fragment)).toEqual(view);
      }),
      { numRuns: RUNS(25), seed: SEED },
    );
  });

  it("property: decodeView on arbitrary text only ever raises ViewError", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ maxLength: 40 }), async (text) => {
        const outcome = await decodeView(text).then(() => "accepted", (error: unknown) => (error instanceof ViewError ? "view-error" : "wrong-error"));
        expect(outcome).not.toBe("wrong-error");
      }),
      { numRuns: RUNS(40), seed: SEED },
    );
  });
});
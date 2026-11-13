import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { canonicalJson, entryCanonical, entryHash, GENESIS, sha256Hex } from "./hash.js";
import { entry } from "../tests/helpers.js";

/** Property runs: 30 by default, 10 000 for the submission campaign (LED-N-13). */
const RUNS = (n: number): number => Number(process.env.LEDGER_RUNS ?? n);

describe("sha256Hex", () => {
  it("matches node:crypto on fixed vectors", () => {
    for (const input of ["", "abc", "ledger:v1\n", "éàü", "a".repeat(1000)]) {
      expect(sha256Hex(input)).toBe(createHash("sha256").update(input, "utf8").digest("hex"));
    }
  });

  it("property: matches node:crypto on arbitrary strings", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 400 }), (input) => {
        expect(sha256Hex(input)).toBe(createHash("sha256").update(input, "utf8").digest("hex"));
      }),
      { numRuns: RUNS(200), seed: 20261113 },
    );
  });
});

describe("canonicalJson", () => {
  it("sorts keys at every depth and keeps arrays in order", () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: 2 } })).toBe('{"a":{"c":2,"d":[3,{"y":2,"z":1}]},"b":1}');
  });

  it("property: two objects that differ only by key insertion hash the same", () => {
    fc.assert(
      fc.property(fc.dictionary(fc.string({ minLength: 1, maxLength: 6 }), fc.integer()), (dict) => {
        const shuffled = Object.fromEntries(Object.entries(dict).reverse());
        expect(canonicalJson(dict)).toBe(canonicalJson(shuffled));
      }),
      { numRuns: RUNS(100), seed: 20261113 },
    );
  });
});

describe("entryHash", () => {
  it("is independent of absent-vs-null optional fields", () => {
    const bare = entry({ postings: [{ id: "a", accountId: "assets:bank", amountMinor: 1, unit: "EUR" }, { id: "b", accountId: "expenses:x", amountMinor: -1, unit: "EUR" }] });
    const withNulls = { ...bare, reverses: null, tags: [] };
    expect(entryHash(bare, GENESIS)).toBe(entryHash(withNulls, GENESIS));
  });

  it("changes when a posting order changes (order is part of what was typed)", () => {
    const [p1, p2] = [{ id: "a", accountId: "assets:bank", amountMinor: 5, unit: "EUR" as const }, { id: "b", accountId: "expenses:x", amountMinor: -5, unit: "EUR" as const }];
    const one = entry({ postings: [p1, p2] });
    const other = entry({ postings: [p2, p1] });
    expect(entryHash(one, GENESIS)).not.toBe(entryHash(other, GENESIS));
    expect(entryCanonical(one, GENESIS).startsWith("ledger:v1\n" + GENESIS + "\n")).toBe(true);
  });
});

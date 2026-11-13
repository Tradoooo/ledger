/** CSV import: six twisted files, one property of balance, one of idempotence. */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { detectCsv, importStatement } from "./csv.js";
import type { Detection, ImportOptions } from "./csv.js";
import { LedgerError, validateEntry } from "./journal.js";
import { entryHash, GENESIS, sha256Hex } from "./hash.js";
import { ulid } from "../tests/helpers.js";

/** Property seed: fixed for reproducibility, overridable to sweep for counter-examples. */
const SEED_VALUE = Number(process.env.LEDGER_SEED ?? 20261113);

/** Property runs: 30 by default, 10 000 for the submission campaign (LED-N-13). */
const RUNS = (n: number): number => Number(process.env.LEDGER_RUNS ?? n);

const SEED = { seed: SEED_VALUE, numRuns: RUNS(30) } as const;

/** Strings are UTF-8 encoded, numbers are raw octets: enough to hand-write windows-1252. */
const bytes = (...parts: (string | number)[]): Uint8Array => {
  const out: number[] = [];
  for (const part of parts) {
    if (typeof part === "number") out.push(part);
    else for (const byte of new TextEncoder().encode(part)) out.push(byte);
  }
  return new Uint8Array(out);
};
const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);
const lines = (...rows: string[]): Uint8Array => utf8(`${rows.join("\n")}\n`);

const options = (over: Partial<ImportOptions> = {}): ImportOptions => ({
  accountId: "assets:bank",
  debitAccountId: "expenses:misc",
  creditAccountId: "income:misc",
  unit: "EUR",
  idFactory: (index) => ulid(index),
  ...over,
});

// --- the six traps -----------------------------------------------------------

/** 1. UTF-8 BOM, ';' separator, comma decimal, thin thousands space. */
const BOM_FILE = bytes(
  0xef, 0xbb, 0xbf,
  "date;libellé;montant;devise\n01/02/2026;Café;1 234,56;EUR\n02/02/2026;Loyer;-800,00;EUR\n",
);

/** 2. Accents as real windows-1252 octets: 0xE9 é, 0xF4 ô. Not valid UTF-8. */
const WIN1252_FILE = bytes("date;libell", 0xe9, ";montant\n01/02/2026;D", 0xe9, "p", 0xf4, "t;10,50\n");

/** 3. Two columns, debit / credit, blank cell on one side. */
const SPLIT_FILE = lines(
  "Date;Libellé;Débit;Crédit",
  "01/02/2026;Achat;100,00;",
  "02/02/2026;Salaire;;2 500,00",
);

/** 4. One signed amount column, ISO dates, English headers. */
const SIGNED_FILE = lines(
  "Amount;Details;Date;Currency",
  "-12.50;Coffee;2026-02-01;EUR",
  "1200.00;Salary;2026-02-02;EUR",
);

/** 5. Quoted label holding both a ';' and a line break. */
const QUOTED_FILE = lines(
  "date;libellé;montant",
  '01/02/2026;"Achat ; divers',
  'ligne deux";-12,50',
);

/** 6. Reversed headers, English words: the label is not always second. */
const REVERSED_FILE = lines("Credit;Debit;Label;Date", ";42,00;Book;15/03/2026", "7,50;;Refund;16/03/2026");

/** Bonus: a parenthesised amount is a negative amount, not a positive one. */
const PARENS_FILE = lines("date;libellé;montant", "01/02/2026;Frais bancaires;(123,45)");

const sumOf = (entry: { postings: readonly { amountMinor: number }[] }): number =>
  entry.postings.reduce((total, posting) => total + posting.amountMinor, 0);

describe("detectCsv", () => {
  it("reads a UTF-8 BOM file with ';' and comma decimals", () => {
    const detection = detectCsv(BOM_FILE);
    expect(detection.encoding).toBe("utf-8");
    expect(detection.separator).toBe(";");
    expect(detection.decimal).toBe(",");
    expect(detection.thousands).toBe(" ");
    expect(detection.dateFormat).toBe("DD/MM/YYYY");
    expect(detection.header).toEqual(["date", "libellé", "montant", "devise"]);
    expect(detection.columns).toEqual({
      date: "date", label: "libellé", debit: null, credit: null, amount: "montant", currency: "devise",
    });
  });

  it("falls back to windows-1252 when the bytes are not valid UTF-8", () => {
    const detection = detectCsv(WIN1252_FILE);
    expect(detection.encoding).toBe("windows-1252");
    expect(detection.columns.label).toBe("libellé");
    expect(detection.decimal).toBe(",");
    expect(detection.thousands).toBeNull();
  });

  it("finds a debit/credit pair instead of a single amount", () => {
    const detection = detectCsv(SPLIT_FILE);
    expect(detection.separator).toBe(";");
    expect(detection.columns).toMatchObject({ date: "Date", label: "Libellé", debit: "Débit", credit: "Crédit", amount: null });
    expect(detection.thousands).toBe(" ");
    expect(detection.dateFormat).toBe("DD/MM/YYYY");
  });

  it("reads a signed amount column with English headers and ISO dates", () => {
    const detection = detectCsv(SIGNED_FILE);
    expect(detection.decimal).toBe(".");
    expect(detection.thousands).toBeNull();
    expect(detection.dateFormat).toBe("YYYY-MM-DD");
    expect(detection.columns).toMatchObject({ date: "Date", label: "Details", amount: "Amount", currency: "Currency" });
  });

  it("keeps a quoted label containing a separator and a line break intact", () => {
    const detection = detectCsv(QUOTED_FILE);
    expect(detection.separator).toBe(";");
    const [entry] = importStatement(QUOTED_FILE, options()).entries;
    expect(entry?.note).toBe("Achat ; divers\nligne deux");
  });

  it("copes with reversed and English headers", () => {
    const detection = detectCsv(REVERSED_FILE);
    expect(detection.columns).toMatchObject({ credit: "Credit", debit: "Debit", label: "Label", date: "Date", amount: null });
    expect(detection.dateFormat).toBe("DD/MM/YYYY");
    expect(detection.decimal).toBe(",");
  });

  it("throws a typed NotBalanced when the date column is missing", () => {
    const noDate = utf8("libellé;montant\nBon;10,00\n");
    expect(() => detectCsv(noDate)).toThrowError(LedgerError);
    try { detectCsv(noDate); } catch (error) { expect((error as LedgerError).code).toBe("NotBalanced"); }
    expect(() => detectCsv(utf8("date;montant\n01/02/2026;10,00\n"))).toThrowError(LedgerError);
  });
});

describe("importStatement", () => {
  it("posts money in against the credit account and money out against the debit account", () => {
    const { entries } = importStatement(BOM_FILE, options());
    expect(entries).toHaveLength(2);
    expect(entries[0]!.postings.map((p) => [p.accountId, p.amountMinor])).toEqual([
      ["assets:bank", 123456], ["income:misc", -123456],
    ]);
    expect(entries[1]!.postings.map((p) => [p.accountId, p.amountMinor])).toEqual([
      ["expenses:misc", 80000], ["assets:bank", -80000],
    ]);
    expect(entries[0]).toMatchObject({ date: "2026-02-01", note: "Café", unit: "EUR", kind: "transaction", reverses: null });
  });

  it("computes credit minus debit when the statement has two columns", () => {
    const { entries } = importStatement(SPLIT_FILE, options());
    expect(entries.map((entry) => entry.postings.map((p) => p.amountMinor))).toEqual([
      [10000, -10000], [250000, -250000],
    ]);
    expect(entries[0]!.postings.map((p) => p.accountId)).toEqual(["expenses:misc", "assets:bank"]);
    expect(entries[1]!.postings.map((p) => p.accountId)).toEqual(["assets:bank", "income:misc"]);
  });

  it("reads a parenthesised amount as a negative one", () => {
    const { entries, rejected } = importStatement(PARENS_FILE, options());
    expect(rejected).toHaveLength(0);
    expect(entries[0]!.postings.map((p) => [p.accountId, p.amountMinor])).toEqual([
      ["expenses:misc", 12345], ["assets:bank", -12345],
    ]);
    expect(entries[0]!.note).toBe("Frais bancaires");
  });

  it("stamps every posting with the sha256 of the raw line", () => {
    const { entries } = importStatement(SPLIT_FILE, options());
    const raw = "01/02/2026;Achat;100,00;";
    expect(entries[0]!.postings.every((p) => p.evidence?.[0] === sha256Hex(raw))).toBe(true);
    expect(entries[1]!.postings[0]!.evidence).toEqual([sha256Hex("02/02/2026;Salaire;;2 500,00")]);
  });

  it("uses idFactory with a growing index", () => {
    const { entries } = importStatement(SPLIT_FILE, options());
    expect(entries.map((entry) => entry.id)).toEqual([ulid(0), ulid(1)]);
  });

  it("accepts a confirmed detection and gives the same result", () => {
    const detection: Detection = detectCsv(SPLIT_FILE);
    expect(importStatement(SPLIT_FILE, options({ detection }))).toEqual(importStatement(SPLIT_FILE, options()));
  });

  it("rejects bad rows with a code instead of throwing", () => {
    const bad = lines(
      "date;libellé;montant",
      "31/02/2026;Date impossible;10,00",
      "01/02/2026;Montant illisible;n/a",
      "01/02/2026;   ;10,00",
      "01/02/2026;Zéro;0,00",
      "01/02/2026;Bon;10,00",
    );
    const result = importStatement(bad, options());
    expect(result.entries.map((entry) => entry.note)).toEqual(["Bon"]);
    expect(result.rejected.map((row) => [row.code, row.line])).toEqual([
      ["BadDate", 2], ["BadAmount", 3], ["MissingLabel", 4], ["BadAmount", 5],
    ]);
    expect(result.rejected[0]!.raw).toBe("31/02/2026;Date impossible;10,00");
  });

  it("rejects a row whose field count does not match the header", () => {
    const truncated = lines("date;libellé;montant", "01/02/2026;Trop court", "01/02/2026;Bon;5,00");
    const result = importStatement(truncated, options());
    expect(result.rejected.map((row) => row.code)).toEqual(["BadColumns"]);
    expect(result.entries).toHaveLength(1);
  });
});

// --- properties --------------------------------------------------------------

const LABEL_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCÉéÀçü 0123456789.-&'".split("");

const labelGen: fc.Arbitrary<string> = fc.array(fc.constantFrom(...LABEL_ALPHABET), { minLength: 3, maxLength: 24 })
  .map((chars) => chars.join("").trim())
  .map((label) => (label === "" ? "divers" : label));

const dateGen = fc.constantFrom("01/02/2026", "28/02/2026", "29/02/2024", "31/12/2026", "09/11/2025");
const amountGen = fc.integer({ min: -999_999, max: 999_999 }).filter((minor) => minor !== 0);

const frenchAmount = (minor: number): string => {
  const absolute = Math.abs(minor);
  const units = String(Math.floor(absolute / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${minor < 0 ? "-" : ""}${units},${String(absolute % 100).padStart(2, "0")}`;
};

const csvField = (value: string): string => (/[;",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

const rowGen = fc.record({ minor: amountGen, label: labelGen, date: dateGen });

const statementOf = (rows: readonly { minor: number; label: string; date: string }[]): Uint8Array =>
  utf8(`${["date;libellé;montant", ...rows.map((row) => `${row.date};${csvField(row.label)};${frenchAmount(row.minor)}`)].join("\n")}\n`);

const evidenceOf = (entries: readonly { postings: readonly { evidence?: string[] }[] }[]): string[] =>
  entries.flatMap((entry) => entry.postings.flatMap((posting) => posting.evidence ?? []));

describe("properties", () => {
  it("property: every imported entry is balanced and validated by the journal", () => {
    fc.assert(fc.property(fc.array(rowGen, { minLength: 1, maxLength: 6 }), (rows) => {
      const { entries, rejected } = importStatement(statementOf(rows), options());
      expect(rejected).toHaveLength(0);
      expect(entries).toHaveLength(rows.length);
      for (const [index, entry] of entries.entries()) {
        expect(() => validateEntry(entry)).not.toThrow();
        expect(sumOf(entry)).toBe(0);
        expect(entry.postings).toHaveLength(2);
        expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(entry.postings.map((p) => p.amountMinor)).toEqual([Math.abs(rows[index]!.minor), -Math.abs(rows[index]!.minor)]);
        expect(entry.postings.map((p) => p.accountId)).toEqual(rows[index]!.minor > 0
          ? ["assets:bank", "income:misc"]
          : ["expenses:misc", "assets:bank"]);
        const raw = `${rows[index]!.date};${csvField(rows[index]!.label)};${frenchAmount(rows[index]!.minor)}`;
        expect(entry.postings.map((p) => p.evidence)).toEqual([[sha256Hex(raw)], [sha256Hex(raw)]]);
      }
    }), SEED);
  });

  it("property: re-importing with the evidence of the first run imports nothing", () => {
    fc.assert(fc.property(fc.array(rowGen, { minLength: 1, maxLength: 6 }), (rows) => {
      const file = statementOf(rows);
      const first = importStatement(file, options());
      const second = importStatement(file, options({ existingEvidence: evidenceOf(first.entries) }));
      expect(second.entries).toHaveLength(0);
      expect(second.rejected).toHaveLength(0);
      expect(second.duplicates).toBe(first.entries.length);
      expect(second.detection).toEqual(first.detection);

      // same input, no evidence: the same entries, hence the same hashes per entry.
      const replay = importStatement(file, options());
      expect(replay.entries).toEqual(first.entries);
      expect(replay.entries.map((entry) => entryHash(entry, GENESIS)))
        .toEqual(first.entries.map((entry) => entryHash(entry, GENESIS)));
    }), SEED);
  });

  it("property: detection never throws on the six traps and stays stable per file", () => {
    const files = [BOM_FILE, WIN1252_FILE, SPLIT_FILE, SIGNED_FILE, QUOTED_FILE, REVERSED_FILE];
    fc.assert(fc.property(fc.constantFrom(...files), (file) => {
      const detection = detectCsv(file);
      expect(detection).toEqual(detectCsv(file));
      const result = importStatement(file, options());
      expect(result.detection).toEqual(detection);
      expect(result.entries.length + result.rejected.length).toBeGreaterThan(0);
      for (const entry of result.entries) expect(() => validateEntry(entry)).not.toThrow();
    }), SEED);
  });
});
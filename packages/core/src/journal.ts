/** The journal: append-only, hash-chained, frozen. Nothing here mutates an entry. */
import { entryHash, GENESIS } from "./hash.js";
import type { Entry, Journal, JournalRecord } from "./schema.js";

export type LedgerErrorCode =
  | "TooFewPostings" | "UnbalancedEntry" | "MixedUnits" | "BadReversal" | "DuplicatePosting"
  | "DuplicateEntry" | "BadSeq" | "BrokenLink" | "BadHash" | "NotBalanced"
  | "UnknownAccount" | "BadAmount" | "UnknownEnvelope";

/** Every failure is typed. The UI can translate `code`, tests can assert on it. */
export class LedgerError extends Error {
  constructor(
    readonly code: LedgerErrorCode,
    message: string,
    readonly detail: Record<string, unknown> = {},
  ) {
    super(`${code}: ${message}`);
    this.name = "LedgerError";
  }
}

export type VerifyResult = { ok: true } | { ok: false; index: number; reason: "broken-link" | "bad-hash" | "bad-seq" };

/** Recursively freeze so that no caller can edit what the journal holds. */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.getOwnPropertyNames(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

/** The only law of the core: postings sum to zero, in one unit. */
export function validateEntry(entry: Entry): Entry {
  if (entry.postings.length < 2) {
    throw new LedgerError("TooFewPostings", "an entry needs at least two postings", { postings: entry.postings.length });
  }
  const ids = new Set<string>();
  for (const posting of entry.postings) {
    if (ids.has(posting.id)) {
      throw new LedgerError("DuplicatePosting", `posting id ${posting.id} appears twice`, { postingId: posting.id });
    }
    ids.add(posting.id);
  }
  const units = new Set(entry.postings.map((p) => p.unit));
  if (units.size > 1 && entry.kind !== "conversion") {
    throw new LedgerError("MixedUnits", "an entry may not mix units without kind=conversion", { units: [...units] });
  }
  if (units.size > 1) return entry; // a conversion balances per unit group; checked by the app that builds it
  const sum = entry.postings.reduce((total, p) => total + p.amountMinor, 0);
  if (sum !== 0) {
    throw new LedgerError("UnbalancedEntry", `postings sum to ${sum}, not zero`, { sum, unit: entry.postings[0]!.unit });
  }
  if (entry.kind === "reversal" && entry.reverses === null) {
    throw new LedgerError("BadReversal", "a reversal must name the entry it reverses");
  }
  if (entry.kind !== "reversal" && entry.reverses !== null) {
    throw new LedgerError("BadReversal", "only a reversal may carry reverses");
  }
  return entry;
}

/** An empty journal. `createdAt` is injected: the core never reads the clock. */
export function createJournal(createdAt: string): Journal {
  return deepFreeze({ version: 1 as const, createdAt, records: [] as JournalRecord[] });
}

/** Append one validated entry; returns a new frozen journal, never mutates. */
export function append(journal: Journal, entry: Entry): Journal {
  validateEntry(entry);
  if (journal.records.some((r) => r.id === entry.id)) {
    throw new LedgerError("DuplicateEntry", `entry ${entry.id} is already in the journal`, { entryId: entry.id });
  }
  const prevHash = journal.records.at(-1)?.hash ?? GENESIS;
  const record: JournalRecord = deepFreeze({
    ...entry, seq: journal.records.length, prevHash, hash: entryHash(entry, prevHash),
  });
  return deepFreeze({ ...journal, records: [...journal.records, record] });
}

/** Walk the chain and report the first fault, with its reason. */
export function verifyChain(journal: Journal): VerifyResult {
  let prevHash = GENESIS;
  for (let index = 0; index < journal.records.length; index++) {
    const record = journal.records[index]!;
    if (record.seq !== index) return { ok: false, index, reason: "bad-seq" };
    if (record.prevHash !== prevHash) return { ok: false, index, reason: "broken-link" };
    if (entryHash(record, record.prevHash) !== record.hash) return { ok: false, index, reason: "bad-hash" };
    prevHash = record.hash;
  }
  return { ok: true };
}

/** Head hash: what you publish and what a donor compares against. */
export function headHash(journal: Journal): string {
  return journal.records.at(-1)?.hash ?? GENESIS;
}

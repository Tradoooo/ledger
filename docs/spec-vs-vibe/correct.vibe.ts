/** Correcting a mistake without rewriting history.
 *
 * The journal is append-only and its entries are frozen: a mistake is never
 * edited, it is cancelled by a *contre-passation* — a new entry of kind
 * "reversal" that names the entry it cancels (`reverses`).
 *
 * `correct` builds that entry. It reads no clock, mutates nothing, and the
 * entry it corrects comes out untouched.
 *
 * Two shapes of correction:
 *
 *   1. plain — the new entry carries the exact inverse of the original's
 *      postings (same accounts, opposite amounts). It balances by itself and
 *      original + contre-passation nets to zero.
 *   2. replacement — the correction also carries the corrected postings. The
 *      new entry then holds the inverse of the original *plus* the
 *      replacement, so the books end up showing the replacement instead of
 *      the mistake. The replacement must balance on its own, otherwise the
 *      new entry would not sum to zero and could never enter the journal.
 *
 * The identifier of the new entry is derived from the content of the
 * correction (the same correction always yields the same entry), unless the
 * caller injects one.
 */
import { canonicalJson, sha256Hex } from "../../../packages/core/src/hash";
import { ulidFrom } from "../../../packages/core/src/ids";
import { LedgerError, deepFreeze, validateEntry } from "../../../packages/core/src/journal";
import type { Entry, Posting } from "../../../packages/core/src/schema";

/** A posting as the caller writes it: the identifier may be left out. */
export type PostingInput = Omit<Posting, "id"> & { id?: string };

/** What the user says when they fix a mistake. */
export type Correction = {
  /** Plain language: what was wrong, and what replaces it. Mandatory. */
  note: string;
  /** The corrected postings; leave out for a pure cancellation. */
  postings?: readonly PostingInput[];
  /** Date of the contre-passation; the date of the original when omitted. */
  date?: string;
  /** Identifier of the new entry; derived from the content when omitted. */
  id?: string;
};

const NOTE_MAX = 200;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/** The note is the sentence a human reads in the audit trail: never empty. */
function requireNote(note: string): string {
  if (typeof note !== "string") {
    throw new LedgerError("BadReversal", "a correction must carry a plain-language note", { reason: "missing-note" });
  }
  const trimmed = note.trim();
  if (trimmed.length === 0) {
    throw new LedgerError("BadReversal", "a correction must carry a plain-language note", { reason: "empty-note" });
  }
  if (trimmed.length > NOTE_MAX) {
    throw new LedgerError("BadReversal", `a note is at most ${NOTE_MAX} characters long`, {
      reason: "note-too-long",
      length: trimmed.length,
    });
  }
  return trimmed;
}

/** Dates are strings; the caller may date the contre-passation. */
function requireDate(date: string | undefined, fallback: string): string {
  if (date === undefined) return fallback;
  if (!DATE_PATTERN.test(date)) {
    throw new LedgerError("BadReversal", "a correction date must be written YYYY-MM-DD", { reason: "bad-date", date });
  }
  return date;
}

/** An injected identifier must be a ULID, like every other entry. */
function requireId(id: string | undefined): string | undefined {
  if (id === undefined) return undefined;
  if (!ULID_PATTERN.test(id)) {
    throw new LedgerError("BadReversal", "the identifier of a correction must be a ULID", { reason: "bad-id", id });
  }
  return id;
}

/** A copy that shares no mutable structure with the entry it comes from. */
function clonePosting(posting: Posting, id: string, amountMinor: number): Posting {
  const copy: Posting = {
    id,
    accountId: posting.accountId,
    amountMinor,
    unit: posting.unit,
  };
  if (posting.memo !== undefined) copy.memo = posting.memo;
  if (posting.party !== undefined) copy.party = { ...posting.party };
  if (posting.evidence !== undefined) copy.evidence = [...posting.evidence];
  return copy;
}

/** The opposite of every posting: same account, opposite amount. */
function inversePostings(postings: readonly Posting[], entryId: string): Posting[] {
  return postings.map((posting, index) => clonePosting(posting, `${entryId}-${index}`, -posting.amountMinor));
}

/** The corrected postings, with fresh identifiers where the caller had none. */
function buildReplacement(
  inputs: readonly PostingInput[],
  entryId: string,
  taken: Set<string>,
): Posting[] {
  return inputs.map((input, index) => {
    const id = input.id ?? `${entryId}-r${index}`;
    if (taken.has(id)) {
      throw new LedgerError("DuplicatePosting", `posting id ${id} is already used by the entry being corrected`, {
        postingId: id,
        reason: "reused-posting-id",
      });
    }
    taken.add(id);
    return clonePosting({ ...input, id }, id, input.amountMinor);
  });
}

/** A replacement that does not balance could never enter the journal. */
function requireBalanced(postings: readonly Posting[]): void {
  const sum = postings.reduce((total, posting) => total + posting.amountMinor, 0);
  if (sum !== 0) {
    throw new LedgerError("UnbalancedEntry", `the corrected postings sum to ${sum}, not zero`, {
      sum,
      reason: "unbalanced-replacement",
    });
  }
}

/** A correction stays in the unit of the entry it corrects. */
function requireSingleUnit(postings: readonly Posting[], unit: string): void {
  const units = new Set(postings.map((posting) => posting.unit));
  if (units.size > 1 || (units.size === 1 && !units.has(unit))) {
    throw new LedgerError("MixedUnits", "a correction must stay in the unit of the entry it corrects", {
      units: [...units],
      unit,
    });
  }
}

/** The seed of the derived identifier: everything that makes the entry. */
function seedOf(entry: Entry, note: string, date: string, postings: readonly PostingInput[]): string {
  return canonicalJson({
    original: entry.id,
    note,
    date,
    postings: postings.map((posting) => ({
      id: posting.id ?? null,
      accountId: posting.accountId,
      amountMinor: posting.amountMinor,
      unit: posting.unit,
    })),
  });
}

/** Ten bytes of digest, as the random part of a ULID. */
function digestBytes(seed: string): number[] {
  const hex = sha256Hex(seed);
  const bytes: number[] = [];
  for (let index = 0; index < 10; index += 1) {
    bytes.push(Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16));
  }
  return bytes;
}

/** The same correction always yields the same entry: no clock, no random. */
function deriveEntryId(entry: Entry, note: string, date: string, postings: readonly PostingInput[]): string {
  return ulidFrom(0, digestBytes(seedOf(entry, note, date, postings)));
}

/** Cancel an entry and, optionally, say what replaces it.
 *
 * The returned entry is a contre-passation: `kind` is "reversal" and `reverses`
 * names the entry being cancelled. The entry passed in is never touched.
 */
export function correct(entry: Entry, correction: Correction): Entry {
  const note = requireNote(correction?.note);
  validateEntry(entry);
  const date = requireDate(correction.date, entry.date);
  const replacement = correction.postings;
  const id = requireId(correction.id) ?? deriveEntryId(entry, note, date, replacement ?? []);

  const taken = new Set<string>(entry.postings.map((posting) => posting.id));
  const cancelled = inversePostings(entry.postings, id);
  for (const posting of cancelled) taken.add(posting.id);

  const corrected = replacement ? buildReplacement(replacement, id, taken) : [];
  if (replacement) {
    if (corrected.length < 2) {
      throw new LedgerError("TooFewPostings", "a correction needs at least two postings", {
        postings: corrected.length,
        reason: "too-few-replacements",
      });
    }
    requireBalanced(corrected);
    requireSingleUnit(corrected, entry.unit);
  }

  const contrePassation: Entry = {
    id,
    date,
    note,
    unit: entry.unit,
    kind: "reversal",
    postings: [...cancelled, ...corrected],
    reverses: entry.id,
    tags: [],
  };
  validateEntry(contrePassation);
  return deepFreeze(contrePassation);
}

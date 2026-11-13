/** Correction is addition, never edition.
 *
 * Authority: `.kiro/specs/ledger-journal/requirements.md` (LED-F-03, LED-F-04),
 * `.kiro/specs/ledger-journal/design.md`, `.kiro/steering/accounting.md` (rule 3).
 *
 * The module is deliberately self-contained: it imports *types* only, never code, so it
 * can be lifted into `packages/core/src/` without dragging a runtime dependency along.
 * When it lands there, the local `deepFreeze` and `CorrectionError` are replaced by the
 * engine's own (`journal.ts`, `errors.ts`): same shapes, same codes.
 *
 * Laws enforced here (the engine enforces them again on `append`):
 *   - a correction never edits the entry it corrects;
 *   - postings sum to zero, in one unit, the unit of the corrected entry;
 *   - a correction carries a note (plain language, non-empty).
 */
import type { Entry, Posting } from "../../../packages/core/src/schema.js";

/** What the user asks to correct, and why. */
export interface Correction {
  readonly entryId: string;
  readonly note: string;
  readonly newPostings: readonly { accountId: string; amountMinor: number }[];
}

/** The engine's error vocabulary (`packages/core/src/errors.ts`), reused as-is. */
export type CorrectionErrorCode =
  | "BadReversal" | "UnbalancedEntry" | "TooFewPostings" | "MixedUnits"
  | "DuplicatePosting" | "BadAmount" | "UnknownAccount";

/** Typed failure: a code and a sentence, like every other error of the engine. */
export class CorrectionError extends Error {
  constructor(
    readonly code: CorrectionErrorCode,
    message: string,
    readonly detail: Record<string, unknown> = {},
  ) {
    super(`${code}: ${message}`);
    this.name = "CorrectionError";
  }
}

/** A note is a sentence for a human: 200 characters is the engine's ceiling. */
const MAX_NOTE = 200;

/** Recursively freeze: an entry never changes, and neither does a correction. */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.getOwnPropertyNames(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

/** Opposite amount, without the -0 that would read as a typo in a ledger. */
const opposite = (amountMinor: number): number => (amountMinor === 0 ? 0 : -amountMinor);

/** The note is mandatory: an unexplained correction is not a correction. */
function requireNote(correction: Correction): string {
  if (typeof correction.note !== "string" || correction.note.trim() === "") {
    throw new CorrectionError("BadReversal", "a correction needs a plain-language note", {
      entryId: correction.entryId,
    });
  }
  if (correction.note.length > MAX_NOTE) {
    throw new CorrectionError("BadReversal", `the note is longer than ${MAX_NOTE} characters`, {
      entryId: correction.entryId,
      length: correction.note.length,
    });
  }
  return correction.note;
}

/** The correction must name the entry it is given, or `reverses` would lie. */
function requireTarget(entry: Entry, correction: Correction): void {
  if (correction.entryId !== entry.id) {
    throw new CorrectionError("BadReversal", "the correction targets another entry", {
      expected: entry.id,
      received: correction.entryId,
    });
  }
}

/** The id of the correction is injected: the core never reads a clock nor a random. */
function requireId(id: string): void {
  if (typeof id !== "string" || id.trim() === "") {
    throw new CorrectionError("BadReversal", "a correction needs an id", { id: String(id) });
  }
}

/** Mirror of the original postings: same accounts, opposite amounts, same metadata. */
function mirrorPostings(entry: Entry, id: string): Posting[] {
  return entry.postings.map((posting, index) => ({
    id: `${id}-p${index}`,
    accountId: posting.accountId,
    amountMinor: opposite(posting.amountMinor),
    unit: posting.unit,
    memo: posting.memo,
    // copied, not shared: freezing the correction must not freeze the original's objects
    party: posting.party === undefined ? undefined : { ...posting.party },
    evidence: posting.evidence === undefined ? undefined : [...posting.evidence],
  }));
}

/** The replacement postings: the accounts and amounts the user asked for. */
function replacementPostings(
  newPostings: readonly { accountId: string; amountMinor: number }[],
  entry: Entry,
  id: string,
): Posting[] {
  return newPostings.map((posting, index) => {
    if (typeof posting.accountId !== "string" || posting.accountId.trim() === "") {
      throw new CorrectionError("UnknownAccount", `posting ${index} has no account`, {
        index,
        accountId: String(posting.accountId),
      });
    }
    if (!Number.isSafeInteger(posting.amountMinor)) {
      throw new CorrectionError("BadAmount", `posting ${index} is not a whole number of minor units`, {
        index,
        amountMinor: posting.amountMinor,
      });
    }
    return { id: `${id}-p${index}`, accountId: posting.accountId, amountMinor: posting.amountMinor, unit: entry.unit };
  });
}

/** The laws of double entry, applied to the postings of the correction. */
function validatePostings(postings: readonly Posting[], entry: Entry): void {
  if (postings.length < 2) {
    throw new CorrectionError("TooFewPostings", "an entry needs at least two postings", {
      postings: postings.length,
    });
  }
  const ids = new Set<string>();
  const units = new Set<string>();
  let sum = 0;
  for (const posting of postings) {
    if (ids.has(posting.id)) {
      throw new CorrectionError("DuplicatePosting", `posting id ${posting.id} appears twice`, {
        postingId: posting.id,
      });
    }
    ids.add(posting.id);
    if (!Number.isSafeInteger(posting.amountMinor)) {
      throw new CorrectionError("BadAmount", "amounts are whole numbers of minor units", {
        postingId: posting.id,
        amountMinor: posting.amountMinor,
      });
    }
    units.add(posting.unit);
    sum += posting.amountMinor;
  }
  if (units.size > 1 || !units.has(entry.unit)) {
    throw new CorrectionError("MixedUnits", "a correction stays in the unit of the entry it corrects", {
      units: [...units],
      unit: entry.unit,
    });
  }
  if (sum !== 0) {
    throw new CorrectionError("UnbalancedEntry", `postings sum to ${sum}, not zero`, {
      sum,
      unit: entry.unit,
    });
  }
}

/**
 * Build the entry that corrects `entry`: a new, frozen, opposite entry that points
 * back at the original through `reverses`. The original is never touched.
 *
 * - `newPostings` empty: the correction is the exact mirror of the original postings.
 * - `newPostings` given: it replaces the postings, and must be balanced.
 */
export function correct(entry: Entry, correction: Correction, id: string): Entry {
  requireTarget(entry, correction);
  const note = requireNote(correction);
  requireId(id);
  const postings = correction.newPostings.length > 0
    ? replacementPostings(correction.newPostings, entry, id)
    : mirrorPostings(entry, id);
  validatePostings(postings, entry);
  return deepFreeze({
    id,
    date: entry.date,
    note,
    unit: entry.unit,
    kind: "reversal",
    reverses: entry.id,
    tags: [...entry.tags],
    postings,
  });
}

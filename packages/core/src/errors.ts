/** Every failure has a code and a sentence. The UI shows the sentence, never the code. */

export const ERROR_CODES = [
  "TooFewPostings", "UnbalancedEntry", "MixedUnits", "BadReversal", "DuplicatePosting",
  "DuplicateEntry", "BadSeq", "BrokenLink", "BadHash", "NotBalanced", "UnknownAccount",
  "BadAmount", "UnknownEnvelope",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** One plain sentence per code. `detail` carries the numbers (the gap, the unit, the index). */
export function describeError(code: string, detail: Record<string, unknown> = {}): string {
  const gap = typeof detail.sum === "number" ? ` The postings sum to ${detail.sum}, not zero.` : "";
  const unit = typeof detail.unit === "string" ? ` (unit ${detail.unit})` : "";
  const index = typeof detail.index === "number" ? ` at index ${detail.index}` : "";
  switch (code) {
    case "TooFewPostings": return "An entry needs at least two postings whose amounts sum to zero.";
    case "UnbalancedEntry": return `This entry does not sum to zero.${gap}${unit}`;
    case "MixedUnits": return "This entry mixes two units. A conversion must be explicit.";
    case "BadReversal": return "A reversal must name the entry it reverses, with a note.";
    case "DuplicatePosting": return "Two postings of this entry share the same identifier.";
    case "DuplicateEntry": return "This entry is already in the journal.";
    case "BadSeq": return `The journal sequence is broken${index}.`;
    case "BrokenLink": return `The chain link is broken${index}.`;
    case "BadHash": return `A record does not match its hash${index}.`;
    case "NotBalanced": return "The books do not balance.";
    case "UnknownAccount": return "This account is not in the chart of accounts.";
    case "BadAmount": return "This amount cannot be read.";
    case "UnknownEnvelope": return "This envelope does not exist.";
    default: return "Something went wrong; nothing was written.";
  }
}

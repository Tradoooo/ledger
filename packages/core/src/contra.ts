/** Correction is addition, never edition: the golden rule of an immutable journal. */
import { append, LedgerError } from "./journal.js";
import type { Entry, Journal } from "./schema.js";
import type { Posting } from "./schema.js";

export interface ContraOptions { id: string; date: string; note: string }

/** Append a mirror entry that exactly cancels `targetId`. */
export function contra(journal: Journal, targetId: string, options: ContraOptions): Journal {
  const target = journal.records.find((r) => r.id === targetId);
  if (!target) throw new LedgerError("DuplicateEntry", `entry ${targetId} is not in the journal`, { entryId: targetId });
  if (target.kind === "reversal") {
    throw new LedgerError("BadReversal", `entry ${targetId} is already a reversal`, { entryId: targetId });
  }
  if (!options.note.trim()) throw new LedgerError("BadReversal", "a reversal needs a plain-language note");
  const postings: Posting[] = target.postings.map((posting, index) => ({
    ...posting, id: `${options.id}-p${index}`, amountMinor: -posting.amountMinor,
  }));
  const reversal: Entry = {
    id: options.id, date: options.date, note: options.note, unit: target.unit,
    kind: "reversal", reverses: targetId, tags: target.tags, postings,
  };
  return append(journal, reversal);
}

/** True when the entry has been reversed by a later record. */
export function isReversed(journal: Journal, entryId: string): boolean {
  return journal.records.some((r) => r.reverses === entryId);
}

/** One entry of the time bank: a transfer of hours between two members.
 *
 * The giver is debited, the receiver is credited, and the two postings must sum
 * to zero — the core says so, the application only writes the two legs.
 */
import { toMinor } from "@ledger/core";
import type { Entry, Posting } from "@ledger/core";
import { UNIT } from "./ledger.config";
import { hours } from "./format";

export interface Draft {
  readonly from: string;
  readonly to: string;
  readonly amount: string;
  readonly date: string;
  readonly note: string;
  /** One posting only: the core must refuse it, and the screen says why. */
  readonly single: boolean;
}

/** "2026-03" is accepted (first day of the month); anything else is refused. */
export function normaliseDate(raw: string): string | null {
  const text = raw.trim().replace(/\//g, "-");
  if (/^\d{4}-\d{2}$/.test(text)) return `${text}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  return null;
}

/** Hours as minor units, through the core's own scale for this unit. */
export function amountMinor(raw: string): number | null {
  const text = raw.trim().replace(",", ".");
  if (text === "") return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0) return null;
  return toMinor(value, UNIT);
}

/** The two legs of the transfer. `single` leaves out the counterpart on purpose. */
export function transferPostings(draft: Draft, id: string, members: readonly { accountId: string; label: string }[]): Posting[] {
  const giver = members.find((member) => member.accountId === draft.from);
  const receiver = members.find((member) => member.accountId === draft.to);
  const minor = amountMinor(draft.amount) ?? 0;
  const memo = draft.note.trim();
  const postings: Posting[] = [];
  if (giver !== undefined) {
    postings.push({ id: `${id}-g`, accountId: giver.accountId, amountMinor: minor, unit: UNIT, memo: memo === "" ? undefined : memo });
  }
  if (draft.single) return postings;
  if (receiver !== undefined) {
    postings.push({ id: `${id}-r`, accountId: receiver.accountId, amountMinor: -minor, unit: UNIT, memo: memo === "" ? undefined : memo });
  }
  return postings;
}

/** An entry, ready for the core to validate. */
export function buildEntry(draft: Draft, id: string, date: string, members: readonly { accountId: string; label: string }[]): Entry {
  const receiver = members.find((member) => member.accountId === draft.to);
  const minor = amountMinor(draft.amount) ?? 0;
  const note = draft.note.trim() === "" ? `${hours(minor, "en")} given to ${receiver?.label ?? "the bank"}` : draft.note.trim();
  return {
    id, date, note, unit: UNIT,
    kind: "transaction", reverses: null, tags: [],
    postings: transferPostings(draft, id, members),
  };
}

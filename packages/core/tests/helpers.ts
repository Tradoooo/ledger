/** Test helpers. Outside src/ on purpose: they do not count against the line budget. */
import type { Entry, Posting } from "../src/schema.js";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Deterministic ULID from a counter: same input, same id, always. */
export function ulid(seq: number): string {
  let time = 1730592000000 + seq;
  let head = "";
  for (let i = 0; i < 10; i++) { head = CROCKFORD[time % 32]! + head; time = Math.floor(time / 32); }
  let rest = seq;
  let tail = "";
  for (let i = 0; i < 16; i++) { tail = CROCKFORD[rest % 32]! + tail; rest = Math.floor(rest / 32) + 7; }
  return head + tail;
}

export function posting(accountId: string, amountMinor: number, over: Partial<Posting> = {}): Posting {
  return { id: `${accountId}-${Math.abs(amountMinor)}-${over.unit ?? "EUR"}`, accountId, amountMinor, unit: "EUR", ...over };
}

export function entry(over: Partial<Entry> & { postings: Posting[] }): Entry {
  return {
    id: ulid(1), date: "2026-11-03", note: "test entry", unit: "EUR",
    kind: "transaction", reverses: null, tags: [], ...over,
  };
}

/** A balanced two-posting entry: `amountMinor` leaves `from` and lands in `to`. */
export function transfer(from: string, to: string, amountMinor: number, over: Partial<Entry> = {}): Entry {
  return entry({
    postings: [posting(to, amountMinor), posting(from, -amountMinor)],
    ...over,
  });
}

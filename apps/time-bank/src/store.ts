/** Local persistence: the entries are stored, the hash chain is recomputed.
 * `localStorage` only — nothing leaves the browser, no request is ever made. */
import { append, createJournal } from "@ledger/core";
import type { Entry, Journal } from "@ledger/core";

const KEY = "ledger:time-bank:v1";

export interface StoredLedger {
  readonly createdAt: string;
  readonly entries: readonly Entry[];
}

/** Today as `YYYY-MM-DD`: the anchor of the book, not an accounting input. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

/** Keep only things shaped like an entry; `append` validates the rest. */
function readEntries(value: unknown): Entry[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Entry => {
    const candidate = item as { id?: unknown; date?: unknown; postings?: unknown };
    return typeof candidate?.id === "string" && typeof candidate.date === "string" && Array.isArray(candidate.postings);
  });
}

/** An empty book, anchored on today. */
export function emptyLedger(): StoredLedger {
  return { createdAt: todayIso(), entries: [] };
}

/** Rebuild the journal: `createJournal`, then one `append` per entry, in order. */
export function journalFrom(stored: StoredLedger): Journal {
  let journal = createJournal(stored.createdAt);
  for (const entry of stored.entries) {
    try {
      journal = append(journal, entry);
    } catch {
      continue; // one damaged entry must not hide the others
    }
  }
  return journal;
}

/** Read the book back; a missing, foreign or broken payload reads as empty. */
export function loadLedger(): StoredLedger {
  const store = storage();
  if (store === undefined) return emptyLedger();
  try {
    const raw = store.getItem(KEY);
    if (raw === null) return emptyLedger();
    const parsed = JSON.parse(raw) as { createdAt?: unknown; entries?: unknown };
    const createdAt = typeof parsed.createdAt === "string" ? parsed.createdAt : todayIso();
    return { createdAt, entries: readEntries(parsed.entries) };
  } catch {
    return emptyLedger();
  }
}

/** Rewrite the whole JSON: entries only, the chain is always recomputed. */
export function saveLedger(stored: StoredLedger): void {
  const store = storage();
  if (store === undefined) return;
  try {
    store.setItem(KEY, JSON.stringify({ createdAt: stored.createdAt, entries: stored.entries }));
  } catch {
    return; // quota or private mode: the session keeps working in memory
  }
}

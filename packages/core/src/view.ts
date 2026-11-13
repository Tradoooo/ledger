/** Shareable views and redacted journals.
 *
 * Isomorphic on purpose: `btoa`/`atob` and `TextEncoder`, never `Buffer`, so the same
 * module runs in a browser tab and under node. Fragment scheme:
 *   "1." + base64url(deflate-raw(utf8 json))   when CompressionStream exists
 *   "0." + base64url(utf8 json)                otherwise
 * A fragment is public: short (<= 2000 chars) and free of private markers. Redaction
 * is irreversible — it rebuilds the hash chain instead of trying to edit it.
 */
import { append, createJournal } from "./journal.js";
import { sha256Hex } from "./hash.js";
import { Entry as EntrySchema, View as ViewSchema } from "./schema.js";
import type { Entry, Journal, JournalRecord, PartyRef, Posting, RedactionPolicy, View } from "./schema.js";

const MAX_FRAGMENT = 2000;
const B64URL = /^[A-Za-z0-9_-]+$/;
const REDACTED_TEXT = "redacted";

/** Every view failure is typed, so callers (URL loader, UI) can branch on it. */
export class ViewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ViewError";
  }
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unBase64Url(text: string): Uint8Array<ArrayBuffer> {
  if (!B64URL.test(text)) throw new ViewError("fragment body is empty or not base64url");
  const padded = text.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(text.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Read one stream to its end and concatenate every chunk. */
async function collect<T extends Uint8Array>(readable: ReadableStream<T>): Promise<Uint8Array> {
  const reader = readable.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value !== undefined) chunks.push(value);
  }
  const out = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

type RawStream = { readable: ReadableStream<Uint8Array>; writable: WritableStream<Uint8Array<ArrayBuffer>> };

/** Feed `bytes` through one deflate-raw transform and collect its output. */
async function pump(stream: RawStream, bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  const pumped = (async () => {
    await writer.write(bytes);
    await writer.close();
  })();
  const [out] = await Promise.all([collect(stream.readable), pumped]);
  return out;
}

const deflateRaw = (bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array> => pump(new CompressionStream("deflate-raw"), bytes);
const inflateRaw = (bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array> => pump(new DecompressionStream("deflate-raw"), bytes);

export async function encodeView(view: View): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(view));
  let fragment: string;
  try {
    fragment = `1.${base64Url(await deflateRaw(bytes))}`;
  } catch {
    fragment = `0.${base64Url(bytes)}`; // no CompressionStream or no deflate-raw: stay honest, stay isomorphic
  }
  if (fragment.length > MAX_FRAGMENT) {
    throw new ViewError(`encoded view is ${fragment.length} chars, over the ${MAX_FRAGMENT} limit`);
  }
  return fragment;
}

/** Never throws anything but `ViewError`: garbage in, typed failure out. */
export async function decodeView(fragment: string): Promise<View> {
  try {
    const text = fragment.startsWith("#v=") ? fragment.slice(3) : fragment; // a URL may keep the prefix
    const scheme = text.slice(0, 2);
    if (scheme !== "1." && scheme !== "0.") throw new ViewError("unknown view scheme, expected 1. or 0.");
    const payload = unBase64Url(text.slice(2));
    const bytes = scheme === "1." ? await inflateRaw(payload) : payload;
    const json = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const parsed: unknown = JSON.parse(json);
    const result = ViewSchema.safeParse(parsed);
    if (!result.success) throw new ViewError("fragment does not hold a valid view");
    return result.data;
  } catch (error) {
    if (error instanceof ViewError) throw error;
    const detail = error instanceof Error ? error.message : "unknown failure";
    throw new ViewError(`unreadable view fragment: ${detail}`);
  }
}

/** "party-" + 8 hex chars of sha256(salt:id): stable, salted, not reversible. */
export function pseudonym(id: string, salt = "ledger"): string {
  return `party-${sha256Hex(`${salt}:${id}`).slice(0, 8)}`;
}

function pseudonymiseParty(party: PartyRef, policy: RedactionPolicy, salt?: string): PartyRef | undefined {
  if (policy.parties === "aggregate") return undefined;
  if (policy.parties === "named") return party;
  // The pseudonym replaces the identity itself: shipping party.id next to it would
  // hand out the exact string the label was derived from, so both become the alias.
  const alias = pseudonym(party.id, salt);
  return { ...party, id: alias, label: alias };
}

function redactPosting(posting: Posting, policy: RedactionPolicy, salt?: string): Posting {
  // `evidence` is never copied: it is the fingerprint of the source line.
  const next: Posting = { id: posting.id, accountId: posting.accountId, amountMinor: posting.amountMinor, unit: posting.unit };
  if (policy.memo === "as-is" && posting.memo !== undefined) next.memo = posting.memo;
  const party = posting.party === undefined ? undefined : pseudonymiseParty(posting.party, policy, salt);
  if (party !== undefined) next.party = party;
  return next;
}

/** One entry, redacted, still valid and still balanced.
 *
 * Amounts stay EXACT: the core law (postings sum to zero) must survive redaction.
 * Bucketing (`amounts: "bucket10"`) belongs to aggregated reports, never to entries.
 * Free text is the leak: under `memo: "whitelist"` both the entry note and every
 * posting memo are dropped (the schema forbids an empty note, hence a placeholder).
 */
export function redactEntry(entry: Entry, policy: RedactionPolicy, salt?: string): Entry {
  const redacted: Entry = {
    ...entry,
    date: policy.dates === "month" ? `${entry.date.slice(0, 8)}01` : entry.date,
    note: policy.memo === "whitelist" ? REDACTED_TEXT : entry.note,
    postings: entry.postings.map((posting) => redactPosting(posting, policy, salt)),
  };
  return EntrySchema.parse(redacted);
}

const asEntry = (record: JournalRecord): Entry => ({
  id: record.id, date: record.date, note: record.note, unit: record.unit,
  kind: record.kind, postings: record.postings, reverses: record.reverses, tags: record.tags,
});

/** Rewrite the chain from zero: same entries (redacted), new seq/prevHash/hash. */
export function redactJournal(journal: Journal, policy: RedactionPolicy, salt?: string): Journal {
  let out = createJournal(journal.createdAt);
  for (const record of journal.records) out = append(out, redactEntry(asEntry(record), policy, salt));
  return out;
}
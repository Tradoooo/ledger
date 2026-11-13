/** Redaction, the public page and the receipt: the whole point of this application.
 *
 * `redactJournal` rewrites the chain instead of editing it, so a published ledger stays
 * verifiable. The policy below is the one this app ships: party ids and labels become a
 * salted pseudonym, dates collapse to the month, amounts stay exact (double entry must
 * survive), and every free text — entry note and posting memo — is dropped.
 */
import { encodeView, redactJournal, verifyChain } from "@ledger/core";
import type { Journal, RedactionPolicy, View } from "@ledger/core";

export const PUBLIC_POLICY: RedactionPolicy = {
  parties: "pseudonymised",
  dates: "month",
  amounts: "exact",
  memo: "whitelist",
  minGroupSize: 3,
};

export const PLACEHOLDER_NOTE = "redacted";

/** The journal a donor is allowed to read. Irreversible: the chain is rebuilt from zero. */
export function publicJournal(journal: Journal): Journal {
  return redactJournal(journal, PUBLIC_POLICY);
}

/** A view is a question, never an answer: the reader recomputes everything from the chain. */
export function publicView(from: string, to: string): View {
  return {
    v: 1,
    app: "mutual-aid",
    report: "public-ledger",
    params: { from, to, accounts: [], tags: [] },
    redaction: PUBLIC_POLICY,
  };
}

/** `#v=` + the encoded view: short, public, and free of private markers by construction. */
export async function publishLink(from: string, to: string): Promise<string> {
  return `#v=${await encodeView(publicView(from, to))}`;
}

export interface ReceiptResult {
  ok: boolean;
  message: string;
}

/** A receipt is `entryId` + `hash`. Both must answer for the same record, in an intact chain. */
export function verifyReceipt(journal: Journal, entryId: string, hash: string): ReceiptResult {
  const chain = verifyChain(journal);
  if (!chain.ok) {
    return { ok: false, message: `The chain is broken at #${chain.index} (${chain.reason}).` };
  }
  const record = journal.records.find((candidate) => candidate.id === entryId.trim());
  if (record === undefined) return { ok: false, message: "No entry carries this id in the chain." };
  if (record.hash !== hash.trim().toLowerCase()) {
    return { ok: false, message: "This hash belongs to no entry with this id." };
  }
  return { ok: true, message: `Entry #${record.seq} confirmed: the hash matches the chain.` };
}

/** Every private party id of the source journal. */
function partyIds(journal: Journal): readonly string[] {
  const ids = new Set<string>();
  for (const record of journal.records) {
    for (const posting of record.postings) {
      if (posting.party !== undefined) ids.add(posting.party.id);
    }
  }
  return [...ids];
}

/** Proof, not promise: what would leak if the policy were wrong. Empty means nothing leaks. */
export function auditPublic(privateJournal: Journal, published: Journal): readonly string[] {
  const text = JSON.stringify(published.records);
  const findings: string[] = [];
  if (text.includes('"evidence"')) findings.push("an evidence field survived");
  for (const id of partyIds(privateJournal)) {
    if (text.includes(id)) findings.push(`party.id ${id} survived`);
  }
  for (const record of privateJournal.records) {
    if (record.note !== PLACEHOLDER_NOTE && text.includes(record.note)) {
      findings.push(`a private note survived: ${record.note}`);
    }
  }
  return findings;
}
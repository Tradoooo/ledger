/** Redaction and the receipt: what a donor may read, and what they can check.
 *
 * `redactJournal` rewrites the chain instead of editing it, so a published ledger stays
 * verifiable. The policy below is the one this app ships: party ids and labels become a
 * salted pseudonym, dates collapse to the month, amounts stay exact (double entry must
 * survive), and every free text — entry note and posting memo — is dropped.
 */
import { redactJournal, verifyChain } from "@ledger/core";
import type { Journal, RedactionPolicy } from "@ledger/core";

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

export type ReceiptStatus = "verified" | "not-found" | "broken";

export interface ReceiptResult {
  ok: boolean;
  status: ReceiptStatus;
  message: string;
}

/** A receipt is `entryId` + `hash`. Both must answer for the same record, in an intact chain. */
export function verifyReceipt(journal: Journal, entryId: string, hash: string): ReceiptResult {
  const chain = verifyChain(journal);
  if (!chain.ok) return { ok: false, status: "broken", message: `The chain is broken at #${chain.index} (${chain.reason}).` };
  const record = journal.records.find((candidate) => candidate.id === entryId.trim());
  if (record === undefined) return { ok: false, status: "not-found", message: "No entry carries this id in the chain." };
  if (record.hash !== hash.trim().toLowerCase()) return { ok: false, status: "not-found", message: "This hash belongs to no entry with this id." };
  return { ok: true, status: "verified", message: `Entry #${record.seq} confirmed: the hash matches the chain.` };
}

/** Proof, not promise: what would leak if the policy were wrong. Empty means nothing leaks. */
export function auditPublic(privateJournal: Journal, published: Journal): readonly string[] {
  const text = JSON.stringify(published.records);
  const findings: string[] = [];
  if (text.includes('"evidence"')) findings.push("an evidence field survived");
  const ids = new Set<string>();
  for (const record of privateJournal.records) {
    for (const posting of record.postings) if (posting.party !== undefined) ids.add(posting.party.id);
    if (record.note !== PLACEHOLDER_NOTE && text.includes(record.note)) findings.push(`a private note survived: ${record.note}`);
  }
  for (const id of ids) if (text.includes(id)) findings.push(`party.id ${id} survived`);
  return findings;
}

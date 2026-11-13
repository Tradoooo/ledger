# ADR 0003 — redaction is irreversible

- Status: accepted
- Date: 13 November 2026
- Code: `packages/core/src/view.ts`, `packages/core/src/view.test.ts`, `apps/mutual-aid/src/publish.ts`

## Context

One application publishes its journal (a solidarity fund: donors must be able to check a receipt).
The journal it holds is private: beneficiary names, party identifiers, and per-posting `evidence`
strings that fingerprint the source bank line. Publishing means removing all of that **without**
losing the property that makes the publication worth anything: the chain still verifies.

The tempting move is to edit the records in place — replace the name, keep the hash. It cannot
work: a record's hash covers its payload, so editing it either breaks the chain or forces a
re-signing step that would silently bless the edit.

## Decision

**Redaction rebuilds the chain from zero.** `redactJournal` starts from an empty journal and
appends every redacted entry again, so `seq`, `prevHash` and `hash` are all recomputed. The
published hashes are therefore *not* the private ones, and there is no operation that maps one to
the other.

Three specifics, all in `view.ts`:

- `evidence` is never copied into a redacted posting — it is the fingerprint of the source line;
- a pseudonymised party gets `party-` + the first 8 hex characters of `sha256(salt + ":" + id)`, and
  the identifier itself is replaced by that alias, because shipping `party.id` next to the
  pseudonym would hand out the exact string the alias was derived from;
- amounts stay **exact**: the core law (`Σ postings = 0`) must survive redaction, so bucketing
  belongs to aggregated reports and never to an entry.

## Consequences

- **It cannot be undone.** No key, no salt and no tool recovers a redacted identity from the
  published journal. A mistake is republished from a new redaction of the private journal, not
  repaired in place.
- **The redaction is a filter, and filters leak what they let through.** Under `memo: "whitelist"`
  both the entry note and every posting memo are dropped; under `dates: "month"` a date becomes
  `YYYY-MM-01`. What remains is still in the file — so the policy is chosen per publication, and
  the measurement says what it produced: 16 566 B gzip, 0 private marker, 0 private id, 0 evidence
  (`docs/recette.json`, check `public`, 214 entries).
- **The published chain proves coherence, not truth.** It proves that the entries were not edited
  after publication, and it lets a donor recompute a `{entryId, hash}` receipt offline. It does
  **not** prove that a donation happened, that an amount reached a household, or that the tail of
  the journal was not cut off before publication — whoever holds the file can publish a shorter
  head. Those limits are listed in `docs/PROOFS.md` under "Not proven here": a limit that is written
  down is part of the product, a limit that is left to the reader's optimism is a liability.
- **What a reader needs is a head hash and a receipt.** Everything else is re-derivable from the
  published entries; those two values are the ones a donor copies and checks.

## Alternative rejected

**In-place redaction, keeping the hashes.** It would preserve a 1:1 link between the private and
public ledgers, which sounds like a feature and is a leak: the public hash would become a lookup
key for the private record, and the redaction could be reversed by anyone who later obtained the
private journal. It also requires trusting a claim ("the entry was not otherwise modified") instead
of a recomputation, which is the opposite of what this repository is for.

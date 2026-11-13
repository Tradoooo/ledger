/** What the chain proves, what it does not, and why that is an argument and not an excuse. */

/** Consistency: the chain is a proof, but only of consistency. */
export const PROVES: readonly string[] = [
  "That the entries you read are the ones the fund wrote: each one is hashed, and each hash commits to the hash before it.",
  "That no entry was quietly changed: one altered amount changes every hash that follows it.",
  "That the totals are the sum of the entries in front of you, recomputed from the chain itself.",
];

/** Sincerity is not a hash, and a chain has a tail that can be cut. */
export const DOES_NOT_PROVE: readonly string[] = [
  "That the money was really given. A chain proves consistency, not sincerity: a lie told consistently is a valid chain.",
  "That the chain is complete. What you hold is the head of a chain whose beginning may have been cut away.",
  "That these are the only movements of money: the chain only knows what was written into it.",
];

/** The parade: the head is anchored twice, so a cut or a rewrite leaves a trace. */
export const WHY_AN_ARGUMENT: readonly string[] = [
  "A break would be visible to anyone reading the chain, so tampering would announce itself instead of hiding.",
  "The head is anchored twice: in the annual report, dated and printed, and in the repository, committed and timestamped by the host.",
  "A cut tail leaves the head pointing at a record that no longer exists; the anchors make the cut detectable, which an unverifiable ledger could never do.",
  "So the chain does not certify honesty: it makes tampering expensive and visible, and it hands the check over to the reader.",
];

/** The same thing, shortened: the paragraph printed under the table of the public page. */
export const LIMITS_NOTE = `This chain proves consistency: that the entries below were not altered, and that the totals are their sum. It does not prove that the money was really given — a consistent lie is still a valid chain — nor that the chain is complete, since a tail can be cut.
What answers that is the head hash printed here: it is anchored in the annual report of the fund and committed in the repository, so a rewrite or a cut leaves a trace that anyone can check. The chain does not certify honesty; it makes tampering visible and hands the check to the reader.`;

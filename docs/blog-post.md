# What a hash chain proves — and what it doesn't

*Written as part of the **Kiroween 2026** hackathon.*

Here is a thing you can say if you build a ledger: **"no one edited this."** Here is a thing you
cannot say: **"this is true."** The two sentences look close. They are not the same claim at all.
If you publish a ledger and hand out receipts, your donors deserve to know the difference.

## The one law, and the one rule

`Ledger` (github.com/Tradoooo/ledger) is a double-entry skeleton. Its law is one line: every
entry sums to zero. Its rule is one line: nothing is ever edited.

Editing is not a feature you remove later, it is a property you forbid at the type level. Every
journal, record and posting is frozen on construction. A correction is a *reversal* — a mirror
entry linked to the original — so the mistake stays visible forever. There is no "fix the typo",
there is only "reverse it and try again". In accounting that is not pedantry; it is the only way
a reader a year later can see that the number was originally wrong.

Every entry carries the hash of the previous one, over a canonical form: keys sorted, no
whitespace, integers only, posting order preserved. The chain is recomputed, never stored.
Verifying 12 000 links takes 181 milliseconds in the browser, because the SHA-256 is pure
TypeScript on purpose: WebCrypto would be faster but asynchronous, and an append must stay
synchronous to keep the fold — the balance — a pure function.

## What the chain proves

Nothing has been **edited**, **removed** or **reordered** since the head was published. That is a
provable claim about the *bookkeeping of the book*. A donor types their receipt — `entryId` and
`hash` — and the page confirms or denies it, offline, against the chain. You cannot fake that
confirmation after the fact without rewriting a hash and breaking every link after it.

## What it does not prove — and why we print this

1. **That the entries are sincere.** The chain proves coherence, not truth. Someone can book a
   3-hour donation that never happened and the chain will faithfully confirm it forever.
2. **That the tail wasn't cut.** Whoever holds the file can truncate the latest entries, republish
   a shorter chain, and it will verify. The mitigation is anchoring: the head is printed in the
   annual report and committed to the repository, so a donor can compare. We say so on the
   published page, not in a footnote.

Why print your own limit? Because the honest one is the argument. "The chain proves what a chain
can prove" is the sentence that makes the rest of the claim — coherence, immutability, a visible
audit trail — believable. The product is a ledger you can audit, not a database that says "trust me".

## The two applications, one core

The same 2 100-line core serves two people who want opposite things. **Sarah** wants silence:
her envelope budget never leaves the browser and tells her one number — what she can still spend
today. **A solidarity fund** wants the opposite: a public book where every donation and every
grant is in plain language, beneficiaries become case numbers, and any donor can verify the chain.

One hides everything, one publishes everything. Same core. That contrast is the whole point of a
skeleton: if the foundation were not neutral, one of the two would have to fight it.

## How Kiro changed the way I build

The build is spec-driven from a 750-line requirements document turned into eight Kiro specs
(`requirements.md`, `design.md`, `tasks.md`). The steering file that mattered most was not about
architecture — it was `accounting.md`, a two-kilobyte statement of the sign convention and the one
law, included only on `packages/core/**`. Five modules were written in parallel; that one file is
why they agreed with each other.

The honest surprise is what the skeleton *refused*. A "lean" budget is a ceiling that never
moves, enforced by a hook that fails the build — and the only accepted fix is to delete code.
Three times a feature wanted in, the guard said no, and each time the code got shorter and clearer
for it. "Lean enough to be clear" turns out to be a refusal machine, not a feature list.

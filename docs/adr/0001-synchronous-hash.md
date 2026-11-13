# ADR 0001 — SHA-256 written in synchronous TypeScript

- Status: accepted
- Date: 13 November 2026
- Code: `packages/core/src/hash.ts`, `packages/core/src/journal.ts`, `packages/core/src/hash.test.ts`

## Context

The journal is a hash chain: every record stores `prevHash` and `hash`, and `hash` is
`SHA-256("ledger:v1\n" + prevHash + "\n" + canonicalJson(payload))`. Two consequences follow.

1. **`append` must return a journal, not a promise.** `append(journal, entry)` validates, computes
   the hash of the new record and returns a new frozen journal. Every caller — the applications'
   stores, `contra()`, `redactJournal()`, the React state updates — is written against that
   signature.
2. **The chain is re-read often.** `verifyChain` hashes every record again; a balance is a fold
   over the same records; the property tests call `append` thousands of times per run.

The platform offers `crypto.subtle.digest`, which is asynchronous by specification.

## Decision

Implement SHA-256 in the core, in plain TypeScript, **synchronously**, with module-level scratch
buffers so the hot path allocates nothing.

## Consequences

- **The whole core stays synchronous.** `append`, `verifyChain`, `headHash`, `contra`,
  `redactJournal`, `trialBalance` and every fast-check property keep a plain value-in/value-out
  shape. No `Promise` leaks into the accounting law, and no test has to await a hash.
- **The cost is measurable and it is paid on purpose.** Verifying a 12 000-link chain costs
  **181 ms** in the figures quoted by `docs/PROOFS.md` and `docs/devpost-form.md`, while the
  acceptance run of 13 November measured **402 ms** (`docs/recette.json`, check `chain`) — over its
  own `< 150 ms` target, which is why that check carries a written deviation: "12 000 links cannot go
  below ~156 ms", a pure-JS digest costing ~13 µs per 300-byte message. Re-measured on this machine
  the same day, in three consecutive passes: **91 / 87 / 88 ms**. The figure depends on the machine
  and on what else it is running, so the command is the authority, not a remembered number.
- **Correctness is not taken on trust.** `hash.test.ts` compares this implementation with
  `node:crypto` on random strings, so the hand-written digest is checked against the reference
  rather than assumed.
- **The digest ships in the bundle.** There is no native primitive to call, so the ~126 lines of
  `hash.ts` are part of every page's JavaScript; that cost sits inside the budget measured by
  `.github/checks/loc-budget.mjs` (core 1 399 / 1 500).
- **It runs the same everywhere.** No `crypto.subtle`, no secure-context requirement, no difference
  between a browser tab and `node` — which is what lets one module serve both.

## Alternative rejected

**`crypto.subtle.digest` (WebCrypto), asynchronous.** It would be faster and would not have to be
maintained here. Rejected because it poisons the call graph: `append` becomes `async`, so every
fold, every report, every reversal, every React handler and every property test becomes
asynchronous, and the core's central law would be expressed as a promise. The two options are not
comparable in kind: the speed difference is a matter of milliseconds, the shape of the API is not.

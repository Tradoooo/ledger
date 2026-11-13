# Features — what is visible, where, and what proves it

One row per visible capability. **Where** is an address on the published site
(`tradoooo.github.io/ledger/`) or a screen; **Proof** is a file or command in this repository.
Nothing appears here without both.

## The law of the core

| Capability | What it is | Where to see it | What proves it |
|---|---|---|---|
| Balanced entries | Every entry's postings must sum to zero, or the call throws `UnbalancedEntry` with the exact gap | `/skeleton/` — press *Add entry*: the report still balances; the subtitle keeps `chain ok` | `packages/core/src/journal.ts` + `journal.test.ts`; `docs/recette.json` check `balance` (5 815 396 = 5 815 396) |
| Immutable records | A record cannot be edited: the journal is recursively frozen | `/envelopes/` → *Journal*: no edit control exists, only the hash prefix of each entry | `deepFreeze` + `journal.test.ts`; `docs/recette.json` check `immutable` (`frozen, contra() → 1 entry, original hash unchanged`) |
| Correction is a reversal | A mistake is reversed by a mirror entry linked to the original, so both stay visible | `/skeleton/` → *Reverse*: the pair appears and the original hash is unchanged | `packages/core/src/contra.ts`; `docs/recette.json` check `immutable` |
| Hash chain | Each record stores `prevHash` and `hash` (SHA-256 of a canonical JSON form, prefix `ledger:v1`) | `/skeleton/` and `/mutual-aid/` → *Audit*: head hash and per-row hash prefix | `packages/core/src/hash.ts` + `hash.test.ts` (compared to `node:crypto`); `docs/recette.json` checks `chain`, `replay` |
| Tampering is localised | Verification names the first faulty index and the reason (`bad-seq`, `broken-link`, `bad-hash`) | Not on screen (a tampered build is not published) | `verifyChain`; `docs/recette.json` check `tamper`: `FAILED at seq 4287, reason bad-hash` |
| Balances are folds | A balance is recomputed from the journal, never stored; replaying a snapshot gives the same head | `/envelopes/` → *Vue d'ensemble*, `/skeleton/` → *Reports* | `reports.test.ts` (property, seeded); `docs/recette.json` check `replay` |

## Import and classification

| Capability | What it is | Where to see it | What proves it |
|---|---|---|---|
| Detection before import | Encoding, separator, decimal mark and date format are shown and confirmed before a single row lands | `/envelopes/` → *Import* → choose a file | `packages/core/src/csv.ts`; `csv.test.ts`; `fixtures/messy-csv/` (BOM, semicolon, decimal point, English headers, negative in parentheses, quoted newline, single amount) |
| Idempotent import | A statement imported twice adds nothing; duplicates are counted, not merged | `/envelopes/` → *Import* twice with the same file | `csv.test.ts` (import twice, compare hashes); `ImportWizard` reports `{count} ligne(s) déjà importée(s)` |
| Rejections are reported | A line that cannot be read is rejected and counted, never guessed | `/envelopes/` → *Import* result line | `csv.test.ts`; `docs/recette.json` check `import`: `12 000 entries · 0 rejected` |
| Learned and authored rules | A memo pattern proposes an account; it never writes a posting | `/envelopes/` → *Import* then *Budgets*: amounts land in the right envelope | `rules.test.ts` (28 tests, partitions conserve the total) |
| Splits are conservative | A rule splitting an amount keeps the remainder on the first leg — the sum is preserved | Not on screen (it decides where the amount lands) | `rules.test.ts` property |

## Budget

| Capability | What it is | Where to see it | What proves it |
|---|---|---|---|
| Envelope board | Budget, spent, carried, available and left-today per envelope | `/envelopes/` → *Budgets* | `packages/ui/src/EnvelopeBoard.tsx`; `envelopes.test.ts` (10 tests, value conserved over 24 months) |
| One number | "Reste à dépenser aujourd'hui": spend exactly this each remaining day and the month stays balanced | `/envelopes/` → *Vue d'ensemble*, first figure on the screen | `leftTodayMinor`; `envelopes.test.ts` (simulation property); `scripts/smoke.mjs` expects the string `Reste à dépenser` |
| Rollover policies | `none`, `carry`, `carry-deficit`, declared per envelope | `apps/envelopes/src/ledger.config.ts` (6 envelopes) | `envelopes.test.ts`; `docs/recette.json` check `budget` |

## Publication and privacy

| Capability | What it is | Where to see it | What proves it |
|---|---|---|---|
| Redacted public journal | The fund publishes its entries with parties pseudonymised, dates collapsed to the month, free text dropped, amounts exact | `/mutual-aid/` → *Publish* | `packages/core/src/view.ts` + `view.test.ts` (12 tests); `docs/recette.json` check `public`: 16 566 B gzip, 0 private marker, 0 private id, 0 evidence |
| Receipt check | A donor types an `{entryId, hash}` pair and gets a verdict — offline, no tool, no account | `/mutual-aid/` → *Publish* → *Verify a receipt* → *Verify* | `apps/mutual-aid/src/publish.ts` (`verifyReceipt`); `docs/recette.json` check `network`: 0 foreign request over 4 pages |
| Shareable view in a fragment | A view travels in the URL fragment (`#v=1.…`), never in a query string; bounded at 2 000 characters | `/mutual-aid/` → *Publish* → the link is copied to the clipboard | `encodeView` / `decodeView`; `view.test.ts` (any fragment yields a valid view or a typed `ViewError`) |
| Redaction is irreversible | The public chain is rebuilt from zero; no key recovers an identity | `/mutual-aid/` → *Publish*: the published list differs from the internal one | `docs/adr/0003-irreversible-redaction.md`; `view.test.ts` |

## The three applications

| Capability | What it is | Where to see it | What proves it |
|---|---|---|---|
| Minimal skeleton | Two reports, two buttons, no business law — 61 / 200 lines | `/skeleton/` | `scripts/smoke.mjs` expects `Ledger skeleton`; `node .github/checks/loc-budget.mjs` |
| Private household | French, `warm-paper`, six tabs, nothing leaves the browser — 596 / 600 lines | `/envelopes/` | `scripts/smoke.mjs`; `docs/recette.json` check `network`; `apps/envelopes/src/ledger.config.ts` |
| Public fund | English, `ink-paper`, four tabs, everything published — 598 / 600 lines | `/mutual-aid/` | `scripts/smoke.mjs`; `docs/recette.json` check `public` |
| Third application, unpublished | A time bank with a `hour` unit, built in 16 min 32 s without touching `packages/**` — 543 / 600 lines | `apps/time-bank/` locally only (three published applications is the ceiling) | `docs/UNKNOWN-ROOM.md`; `node .github/checks/loc-budget.mjs` |
| Bilingual | Every screen string goes through `t(locale, key)`; `en` and `fr` dictionaries | `/envelopes/` (fr) vs `/mutual-aid/` (en) | `packages/ui/src/i18n.ts` |
| Printable | A print stylesheet hides tabs and buttons and keeps the tables and the print title | Any app → *Imprimer* / *Print* in the header | `packages/ui/src/Shell.tsx` (`@media print`); `printTitle` in each `ledger.config.ts` |
| Accessible | 0 critical and 0 serious violations, WCAG 2.0/2.1 AA, axe | The four pages driven by the acceptance run | `docs/recette.json` check `a11y` |

## Repository discipline (visible in the terminal)

| Capability | What it is | Where to see it | What proves it |
|---|---|---|---|
| Line ceiling | Skeleton 1 500 + 1 500 + 200 = 3 200 lines, applications 600 each; the build fails when exceeded | `node .github/checks/loc-budget.mjs` | 2 486 / 3 200 on 13 November 2026; `.github/checks/loc-budget.mjs`; ADR 0002 |
| Purity | No application concept inside `packages/**`, and the guard names the owner | `node .github/checks/purity.mjs` | `.github/checks/purity.mjs` in CI |
| Fictional data | No IBAN-like value, no valid card number, no real name | `node .github/checks/fixture-privacy.mjs` | `fixtures/FICTIONAL.md`, seed `20261103` |
| Proof page | `/proof.html` is generated from `docs/proofs.json`, so it cannot drift | `/proof.html` | `scripts/assemble-site.mjs` |
| Reproducible run | 95 tests in the core files (138 in 11 files on 13 November), 12 acceptance checks, 8 proofs | `pnpm check`, `pnpm proof`, `npx vite-node scripts/recette.ts` | `docs/proofs.json` (8/8), `docs/recette.json` (12/12, 2 documented deviations) |

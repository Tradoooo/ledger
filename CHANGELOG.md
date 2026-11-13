# Changelog

All notable changes to this repository. Format loosely follows Keep a Changelog; versions follow
`package.json`. Numbers quoted here are the ones in `docs/proofs.json`, `docs/recette.json` and
`node .github/checks/loc-budget.mjs` at the date of the entry.

## [0.1.0] — 2026-11-13

First version. What the repository contains, at this date:

### Core (`packages/core`, 1 399 / 1 500 lines)

- **Double-entry journal**, append-only and hash-chained: `append`, `verifyChain`, `headHash`,
  `contra`, `deepFreeze`. Every entry must sum to zero, or the call throws a typed `LedgerError`
  carrying the exact gap.
- **SHA-256 in synchronous TypeScript**, checked against `node:crypto` by a unit test; canonical
  form prefixed `ledger:v1`. Why synchronous, and what it costs: `docs/adr/0001-synchronous-hash.md`.
- **Accounts, rules, envelopes, reports**: chart of accounts with normal sides; memo-to-account
  rules with conservative splits; envelope budgets with rollover; trial balance, income statement,
  envelope board, audit trail.
- **CSV import** that detects encoding, separator, decimal mark and date format, fingerprints lines
  so a second import adds nothing, and reports rejected lines instead of guessing.
- **Shareable views**: `encodeView` / `decodeView` over the URL fragment (deflate-raw when
  available, `0.` base64 scheme otherwise, 2 000-character limit).
- **Irreversible redaction**: `redactJournal` rebuilds the chain instead of editing it; salted 8-hex
  pseudonyms, dates collapsed to the month, exact amounts, `evidence` never copied. See
  `docs/adr/0003-irreversible-redaction.md`.

### UI (`packages/ui`, 1 026 / 1 500 lines)

`Shell`, `NumberBand`, `JournalTable`, `ImportWizard`, `EnvelopeBoard`, `ReportViews`, `AuditTrace`,
bilingual `t()` (en / fr), print stylesheet. Screens render what the core computed; no law, no I/O.

### Applications

- `apps/envelopes` (596 / 600) — household, private, French, `warm-paper` theme, six tabs
  (overview, budgets, journal, import, reports, audit trail), six envelopes, thirteen rules.
- `apps/mutual-aid` (598 / 600) — solidarity fund, public, English, `ink-paper` theme, four tabs
  (fund, ledger, publish, audit), a redacted public journal and a `{entryId, hash}` receipt checker.
- `apps/time-bank` (543 / 600) — the third application, built from the skeleton in 16 min 32 s by
  someone who had not opened the repository (`docs/UNKNOWN-ROOM.md`). **Not published**: three
  published applications is the ceiling, plus the index and the proof page.
- `skeleton` (61 / 200) — the smallest thing that runs: two reports, two buttons.

### Proofs and guards

- `.github/checks/loc-budget.mjs` — the 3 200-line ceiling (currently 2 486), per-application
  budgets, CI failure on any increase. `docs/adr/0002-immutable-ceiling.md`.
- `.github/checks/purity.mjs` — no application concept in `packages/**`, and it names the owner.
- `.github/checks/fixture-privacy.mjs` — no IBAN-like value, no valid card number, ever.
- `scripts/lint.mjs` — no clock, no randomness, no network, no `any`, no file over 500 lines.
- `pnpm proof` → `docs/proofs.json`, **8/8** at this date.
- `npx vite-node scripts/recette.ts` → `docs/recette.json`, **12/12** checks with two documented
  deviations (`chain`, `properties`).
- **95 tests in the 8 core files** — `pnpm test` reported 138 in 11 files on 13 November, the extra
  files being `packages/ui` and the git-ignored `scratch/` — properties seeded and run at 10 000
  cases in the acceptance campaign.

### Documentation

`README.md` (the map), `REPRODUCE.md`, `SECURITY.md`, `CONTRIBUTING.md`, `docs/PROOFS.md`,
`docs/FEATURES.md`, `docs/COMPARISON.md`, `docs/UNKNOWN-ROOM.md`, `docs/UI-API.md`, three ADRs in
`docs/adr/`, `KIRO_JOURNAL.md`, contest texts (`docs/video-script.md`, `docs/devpost-form.md`,
`docs/blog-post.md`, `docs/social-post.md`).

### Known limits, stated rather than hidden

- The chain proves coherence, not sincerity; a truncated tail cannot be detected from the file
  alone (`docs/PROOFS.md`).
- The `offline` proof (manifest, service worker, icon) has no entry in `docs/proofs.json` yet: not
  measured.
- The spec-vs-vibe coding timing is not measured (`KIRO_JOURNAL.md` §4).
- Bundle sizes at this date, gzipped: skeleton 102.4 kB, envelopes 109 kB, mutual-aid 105.3 kB
  (`docs/proofs.json`).

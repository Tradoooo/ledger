# Measured comparison with existing tools

Six established tools, one repository, the same eight factual questions. **Every cell says either
what I read and where, or `not verified`.** A `not verified` cell is a gap in this table, not a
claim about the tool.

The row **Ledger** is different in kind: its cells come from files in this repository, and the
number is named next to each one.

## How this table was built (13 November 2026)

- Sources: each project's own site and repository metadata (licence and implementation language
  from its GitHub repository), read on that date. Domains are printed without a scheme on purpose:
  the repository's URL guard only accepts the project's own hosts, so a third-party link must not
  look like a published page.
- The `Ledger` row was measured here: `node .github/checks/loc-budget.mjs`,
  `docs/proofs.json`, `docs/recette.json`, `packages/core/src/hash.ts`, `package.json`, `LICENSE`.
- **What is not compared:** speed, quality of reports, number of users, ease of use. I did not
  measure any of them, and this table says nothing about them.

## The table

| Tool | Where it runs | Installation | Entry language | Cost (licence) | Dependencies | Hash chain | Works offline | Static self-host |
|---|---|---|---|---|---|---|---|---|
| **Beancount** | command line (Python); its README also mentions "a web interface" | from source per its install doc; exact command not verified | plain-text file, Beancount syntax | free, GPL-2.0 | Python interpreter and libraries; full list not verified | not verified | yes — reads local text files, no server | no — a CLI that writes report files |
| **hledger** | command line, terminal UI and web UI (its repository description) | "download one binary … with nothing else needed" (its site) | plain-text journal (ledger format); CSV import with rules files | free, GPL-3.0 | none beyond the binary, per its site | not verified | yes — journal file on disk | no — `hledger web` serves a UI from `127.0.0.1:5000`, it is a server, not a static site |
| **ledger-cli** | command line (C++) | binaries and distro packages listed on its download page | its own textual format | free, BSD (LICENSE + site) | not verified | not verified | yes — local text file | no — no web interface |
| **Actual Budget** | desktop app, web app, plus a sync server you can self-host (its docs) | download, or self-host the server | UI forms; bank-file import (formats not verified) | free, MIT; hosting cost not verified | server + client; details not verified | not verified — its docs describe a stored mutation log, which is not the same thing | yes — "it works regardless of your network connection" (its sync docs) | no — syncing needs the server |
| **GnuCash** | desktop GUI (GTK) | precompiled binaries, Flathub, distro packages (its README) | desktop forms; imports (QIF confirmed by its README, others not verified) | free, GNU GPL set (its LICENSE) | GNOME/GTK development libraries, libxml2, SWIG (build requirements in its README) | not verified | yes — desktop app, local file | no — desktop only |
| **Firefly III** | web server you self-host (PHP); JSON REST API | Docker, Kubernetes or a self-managed server (its docs) | web forms; separate Data Importer for files | free, AGPL-3.0 | PHP + MySQL/MariaDB or PostgreSQL — "without such a database container, Firefly III will not work" | not verified | not verified | no — a PHP server plus a database |
| **Ledger** (this repository) | browser, static pages: index + `skeleton` + `envelopes` + `mutual-aid` + `/proof.html` | nothing to use the published pages; to build: Node 22+, pnpm 10, `pnpm install` | the applications' screens, and a CSV wizard that detects encoding, separator and decimal before importing | free, MIT (`LICENSE`) | 1 runtime dependency (`zod`) plus React (`package.json`) | **yes** — SHA-256 over a canonical JSON form, `ledger:v1` prefix, chained on `prevHash` (`packages/core/src/hash.ts`); checked against `node:crypto` by `packages/core/src/hash.test.ts` | **yes** — 0 foreign request over 4 pages (`docs/recette.json`, `network`) | **yes** — plain static files, no server, no account |

## The one-line difference

A lean accounting skeleton, in the browser, whose two applications sit at the two extremes of
privacy, with a hash chain a donor verifies without any tool.

## The two extremes, measured in this repository

The claim above is not a slogan; it is two published pages built from the same core. Left column
is silence, right column is proof. Line counts measured on 13 November 2026.

| | `apps/envelopes` (private) | `apps/mutual-aid` (public) |
|---|---|---|
| Published at | `/envelopes/` | `/mutual-aid/` |
| Locale and theme | `fr`, `warm-paper` (`apps/envelopes/src/ledger.config.ts`) | `en`, `ink-paper` (`apps/mutual-aid/src/ledger.config.ts`) |
| Own lines | 596 / 600 (99 %) | 598 / 600 (100 %) |
| Data | 12 000 imported lines (`fixtures/FIXTURES.json`) | 214 entries (`fixtures/FIXTURES.json`) |
| Leaves the browser | nothing — 0 foreign request (`docs/recette.json`) | a redacted journal: 16 566 B gzip, 0 private marker, 0 private id, 0 evidence (`docs/recette.json`) |
| Envelopes | 6 declared in its configuration | none — a fund does not budget (`reports` excludes `envelopes`) |

## What this comparison does not establish

- It does not say Ledger is better. The six other tools answer questions Ledger refuses: bank
  synchronisation, several currencies, VAT, multi-user access, a hosted service
  (`.kiro/steering/lean.md` lists each refusal with its reason).
- It does not measure performance against any of them. The only timings in this repository are
  its own: `docs/recette.json`.
- The `Ledger` column "works offline" means **after the page has loaded**, proven by counting
  foreign requests. It does not claim the page is installable: the `offline` proof of
  `scripts/run-proofs.mjs` (manifest, service worker, icon) has no entry in `docs/proofs.json`,
  so it is **not measured** at the date of this file.

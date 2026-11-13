# Ledger — a double-entry skeleton, and the two applications that prove it

> **Σ postings = 0.** The journal is append-only and hash-chained. Every balance is a fold.
> Nothing is ever edited: a correction is a reversal.

Kiroween 2026 · **Skeleton Crew** · MIT · three published applications, an index and a proof page;
no account, no server, no network request after loading.

## The map of this repository

| You want | Read |
|---|---|
| What can I see, and what proves it | [`docs/FEATURES.md`](docs/FEATURES.md) |
| Every claim and its proof | [`docs/PROOFS.md`](docs/PROOFS.md) |
| Where it sits next to existing tools | [`docs/COMPARISON.md`](docs/COMPARISON.md) |
| The stranger test (a third app in 16 min 32 s) | [`docs/UNKNOWN-ROOM.md`](docs/UNKNOWN-ROOM.md) |
| Start again on a new machine | [`REPRODUCE.md`](REPRODUCE.md) |
| The three decisions that shape the code | [`docs/adr/`](docs/adr/) |
| Contest texts: video, submission | [`docs/video-script.md`](docs/video-script.md) · [`docs/devpost-form.md`](docs/devpost-form.md) |
| What was used from Kiro, and what failed | [`KIRO_JOURNAL.md`](KIRO_JOURNAL.md) |

## The idea in one page

A ledger is the canonical "lean but flexible" template: the same notebook serves a household,
an association, a solidarity fund or a time bank. And its invariants are **equations**, not
opinions — which is exactly what property-based tests need to be worth something.

| | `apps/envelopes` | `apps/mutual-aid` |
|---|---|---|
| Who | a household, on a phone | a solidarity fund: donors on one side, aid on the other |
| Trust model | **everything private** — the trust comes from silence | **everything public** — the trust comes from proof |
| Data | 12 000 imported bank lines, 6 envelopes | 214 entries, plain-language notes |
| Question answered | "can I still spend tomorrow?" — one number | "where did the money go?" — a verifiable chain |
| Share | nothing leaves the browser | a redacted static page + an `{entryId, hash}` receipt |

Both use the **same core**, unmodified. Each application writes **one configuration file** and
its screens. That is the whole category claim, and `.github/checks/purity.mjs` enforces it:
no application concept may live in `packages/**`.

## The five extension points

| Point | Signature | What an application decides |
|---|---|---|
| `defineChart` | `(accounts) => Chart` | accounts, types, units, normal sides |
| `defineRules` | `(rules) => RuleSet` | memo → account, splits, learned rules |
| `defineEnvelopes` | `(envs) => EnvelopeSet` | budgets per period, rollover policy |
| `defineReports` | `(names) => ViewName[]` | which reports are published |
| `definePresentation` | `(p) => Presentation` | theme, locale, columns, print title |

`defineLedger({ chart, rules, envelopes, reports, presentation })` composes and freezes them.

## What is proven (and how)

Every line below is produced by a script, not by hand — the full table is in
[`docs/PROOFS.md`](docs/PROOFS.md), and the published [`/proof.html`](https://tradoooo.github.io/ledger/proof.html)
is generated from `docs/proofs.json`, so it cannot drift.

- `Σ postings = 0` for every entry, and a typed `UnbalancedEntry` naming the exact gap otherwise.
- The hash chain verifies after any sequence of appends and reversals; a tampered record is
  reported at its index with a reason.
- Balances are order-independent (a fold); a snapshot replays to the same balances and the same head.
- 24 simulated months of envelope rollover conserve value, and spending `leftToday` every
  remaining day never puts the month in deficit.
- A public view is irreversible: no private marker, no `party.id`, no source fingerprint.
- Importing the same statement twice adds nothing (fingerprinted lines).
- No `Date.now`, no `new Date`, no `Math.random`, no `fetch` in the core — checked by `scripts/lint.mjs`.
- A third application (a time bank, unit `hour`) was built from this skeleton in **16 min 32 s**
  by someone who had never opened the repository, without a single line changed under `packages/**`
  — see [`docs/UNKNOWN-ROOM.md`](docs/UNKNOWN-ROOM.md).

## Budgets (the ceiling never goes up)

| Package | Lines | Ceiling | Fill |
|---|---|---|---|
| `packages/core` | 1 399 | 1 500 | 93 % |
| `packages/ui` | 1 026 | 1 500 | 68 % |
| `skeleton` | 61 | 200 | 31 % |
| **skeleton total** | **2 486** | **3 200** | 78 % |
| `apps/envelopes` (its own lines) | 596 | 600 | 99 % |
| `apps/mutual-aid` (its own lines) | 598 | 600 | 100 % |
| `apps/time-bank` (third app, unpublished) | 543 | 600 | 91 % |

Measured with `node .github/checks/loc-budget.mjs` on 13 November 2026, on the working tree; the
command is the authority, and the numbers move with the code. The guard fails the build
when a budget is exceeded, and the only accepted fix is **removing code** (see
[ADR 0002](docs/adr/0002-immutable-ceiling.md)). The rules that keep the skeleton lean are in
[`.kiro/steering/lean.md`](.kiro/steering/lean.md), with a reason for every refusal.

## By the numbers

| | Source |
|---|---|
| **95** tests in the 8 core files, every property seeded — `pnpm test` reported **138** in 11 files, the extras being `packages/ui` and the git-ignored `scratch/` | `pnpm test` · `docs/proofs.json` |
| **12/12** acceptance checks, 2 documented deviations | `npx vite-node scripts/recette.ts` → `docs/recette.json` |
| Import of 12 000 lines: **383 ms**, 0 rejected | `docs/recette.json`, check `import` |
| Trial balance: **5 815 396 = 5 815 396** | `docs/recette.json`, check `balance` |
| Chain of 12 000 links: **402 ms** (target `< 150 ms`, deviation written) | `docs/recette.json`, check `chain` |
| Public view: **16 566 B gzip**, 0 private marker | `docs/recette.json`, check `public` |
| Network: **0** foreign request over 4 pages · a11y: **0 critical, 0 serious** | `docs/recette.json`, checks `network`, `a11y` |
| Proofs re-run by `pnpm proof`: **8/8** | `docs/proofs.json` |
| Bundle, gzipped: skeleton **102.7 kB** · envelopes **113.5 kB** · mutual-aid **110.5 kB** (ceiling 220) | `docs/proofs.json` |
| Published pages: **3** + index + `/proof.html`, all answering 200 on 13 November 2026 | `node scripts/check-live.mjs` (the four application paths) |
| Dependencies at runtime: **1** (`zod`) + React | `package.json` |

## Run it

```bash
pnpm install
pnpm check      # typecheck + lint + guards + tests
pnpm proof      # every claim above, re-measured
pnpm fixtures   # regenerate the synthetic data (seed 20261103, byte for byte)
pnpm build      # the three sites into dist/
```

Step by step, with the expected output of each command: [`REPRODUCE.md`](REPRODUCE.md).

## Data

Every fixture is synthetic and regenerable from the fixed seed `20261103`; `fixtures/FICTIONAL.md`
says so and `.github/checks/fixture-privacy.mjs` refuses any IBAN or valid card number. No real bank
statement, no real donor, ever.

## Dependencies and licences

| Dependency | Licence | Why |
|---|---|---|
| `zod` | MIT | every incoming datum is validated |
| `react`, `react-dom` | MIT | the UI |
| `vite`, `vitest`, `fast-check` (dev) | MIT | build, tests, properties |

No chart library, no CSV library, no date library, no state manager, no database, no copyleft
dependency. How this compares with Beancount, hledger, ledger-cli, Actual Budget, GnuCash and
Firefly III: [`docs/COMPARISON.md`](docs/COMPARISON.md).

## Built with Kiro

`/.kiro` is tracked (a CI job fails if it is ever ignored): 7 steering files (including
`accounting.md` and `apps.md` in `fileMatch`), 8 specs, 5 hooks, 2 read-only agents, 1 skill and
the `new-ledger-app` power. [`KIRO_JOURNAL.md`](KIRO_JOURNAL.md) records what was used, what
worked, and **what did not**.

# Ledger — a double-entry skeleton, and the two applications that prove it

> **Σ postings = 0.** The journal is append-only and hash-chained. Every balance is a fold.
> Nothing is ever edited: a correction is a reversal.

Kiroween 2026 · **Skeleton Crew** · MIT · three published pages, no account, no server,
no network request after loading.

## The idea in one page

A ledger is the canonical "lean but flexible" template: the same notebook serves a household,
an association, a solidarity fund or a time bank. And its invariants are **equations**, not
opinions — which is exactly what property-based tests need to be worth something.

| | `apps/envelopes` | `apps/mutual-aid` |
|---|---|---|
| Who | a household, on a phone | a solidarity fund, 6 volunteers, 180 donors |
| Trust model | **everything private** — the trust comes from silence | **everything public** — the trust comes from proof |
| Data | 12 000 imported bank lines, 9 envelopes | 214 hand-written entries, plain-language notes |
| Question answered | "can I still spend tomorrow?" — one number | "where did the money go?" — a verifiable chain |
| Share | nothing leaves the browser | a static public page + `{entryId, hash}` receipt |

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

Every line below is produced by a script, not by hand — see [`docs/PROOFS.md`](docs/PROOFS.md)
and the published [`/proof.html`](https://tradoooo.github.io/ledger/proof.html).

- `Σ postings = 0` for every entry, and a typed `UnbalancedEntry` naming the exact gap otherwise.
- The hash chain verifies after any sequence of appends and reversals; a tampered record is
  reported at its index with a reason.
- Balances are order-independent (a fold), a snapshot replays to the same balances and the same head.
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
| `packages/core` | 1 369 | 1 500 | 91 % |
| `packages/ui` | 699 | 1 500 | 47 % |
| `skeleton` | 61 | 200 | 31 % |
| **skeleton total** | **2 129** | **3 200** | 67 % |
| `apps/envelopes` (its own lines) | 401 | 600 | 67 % |
| `apps/mutual-aid` (its own lines) | 560 | 600 | 93 % |
| `apps/time-bank` (third app, unpublished) | 542 | 600 | 90 % |

`node .github/checks/loc-budget.mjs` fails the build when a budget is exceeded, and the only
accepted fix is **removing code**. The rules that keep the skeleton lean are in
[`.kiro/steering/lean.md`](.kiro/steering/lean.md), with a reason for every refusal.

## By the numbers

| | |
|---|---|
| Tests and properties | **95** in 8 files, every property seeded; 20 extra seeds × 200 runs, all green |
| Measured acceptance run | **12/12** checks (`npx vite-node scripts/recette.ts`), 2 documented deviations |
| Third application | built in **16 min 32 s** without touching `packages/**` |
| Proofs re-run by `pnpm proof` | **8/8** |
| Bundle, gzipped | skeleton **104 kB** · envelopes **109 kB** · mutual-aid **105 kB** (ceiling 220) |
| Published pages | **3** + index + `/proof.html`, verified at 390×844 with no console error and no foreign request |
| Dependencies at runtime | **1** (`zod`) + React |

## Run it

```bash
pnpm install
pnpm check      # typecheck + lint + guards + tests
pnpm proof      # every claim above, re-measured
pnpm fixtures   # regenerate the synthetic data (seed 20261103, byte for byte)
pnpm build      # the three sites into dist/
```

## Data

Every fixture is synthetic and regenerable from a fixed seed; `fixtures/FICTIONAL.md` says so
and `.github/checks/fixture-privacy.mjs` refuses any IBAN or valid card number. No real bank
statement, no real donor, ever.

## Dependencies and licences

| Dependency | Licence | Why |
|---|---|---|
| `zod` | MIT | every incoming datum is validated |
| `react`, `react-dom` | MIT | the UI |
| `vite`, `vitest`, `fast-check` (dev) | MIT | build, tests, properties |

No chart library, no CSV library, no date library, no state manager, no database, no
copyleft dependency.

## Built with Kiro

`/.kiro` is tracked (a CI job fails if it is ever ignored): 7 steering files (including
`accounting.md` and `apps.md` in `fileMatch`), 8 specs, 5 hooks, 2 read-only agents, 1 skill and
the `new-ledger-app` power. [`KIRO_JOURNAL.md`](KIRO_JOURNAL.md) records what was used, what
worked, and **what did not**.

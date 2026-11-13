# Reproduce it from scratch

From an empty machine to the published site, in seven commands. Every expected line below
was observed on 13 November 2026 (Node 26.9.0, pnpm 10.0.0, Debian 13); a different Node or pnpm
may print different durations — the pass/fail wording is what matters.

## Prerequisites

| Requirement | Version | Check |
|---|---|---|
| Node | 22 or newer (`package.json` declares `type: module`) | `node -v` → `v22.x` or later |
| pnpm | 10 (`packageManager: pnpm@10.0.0` in `package.json`) | `pnpm -v` → `10.x` |
| Git | any recent | `git clone https://github.com/Tradoooo/ledger && cd ledger` |

Nothing else: no database, no Docker, no browser until step 7 (Playwright downloads Chromium
itself on first use).

## 1. Install

```bash
pnpm install
```

Expected: a resolution summary, then `Done in …`. It must end with exit code 0 and create
`node_modules/` at the root and in each workspace package.

## 2. Check (types, repo rules, guards, tests)

```bash
pnpm check
```

This runs four things in order. Expected output, section by section:

1. `tsc --noEmit -p tsconfig.json` — **prints nothing at all**. Silence is the success signal.
2. `node scripts/lint.mjs` — `ok   lint: <n> files, no forbidden pattern` (the file count moves with
   the code). The lint fails on
   `Date.now`, `new Date(`, `Math.random(`, `fetch`, `any`, and on any file over 500 lines or any
   function over 50 lines.
3. `pnpm guards` — three guards, nine lines (seven of them the line budgets):
   ```
   ok   core             1399/1500 (93%)
   ok   ui               1026/1500 (68%)
   ok   skeleton           61/200 (31%)
   ok   app:envelopes     596/600 (99%)
   ok   app:mutual-aid    598/600 (100%)
   ok   app:time-bank     543/600 (91%)
   ok   skeleton total   2486/3200
   ok   purity: no application concept in packages/**
   ok   fixture privacy: fictional data only
   ```
4. `vitest run` — `Test Files  11 passed (11)` and `Tests  138 passed (138)` on 13 November 2026;
   95 of them are the 8 core files, the rest live in `packages/ui` and in the git-ignored `scratch/`
   directory.

Line counts move as the code moves; the rule does not: no line may exceed its budget, and the
total may never pass 3 200.

## 3. Proofs

```bash
pnpm proof
```

Runs `.github/checks/*.mjs`, lint, the test suite, the contest checks (`.kiro` tracked, MIT licence
present), the line budgets and the gzip measurement of `dist/`, then **writes
`docs/proofs.json`**. Expected last line: `N/M proofs passed — written to docs/proofs.json`; the
last recorded run is `8/8` (`docs/proofs.json`, 13 November 2026), and `scripts/run-proofs.mjs`
also defines an `offline` and an `acceptance` check, so count the `PASS` lines instead of trusting a
remembered number. Any red line exits 1.

`pnpm proof` measures the bundles in `dist/`, so run step 5 first if the directory is empty:
without a build, `bundle-budget` reports `not built yet`.

## 4. Fixtures (regenerate the synthetic data)

```bash
pnpm fixtures
```

Expected: `fixtures written: {"household":12000,"mutualAid":214,"messy":6} (seed 20261103)`.
The seed is fixed, so the files are reproduced **byte for byte** — verified by running the script
on a copy of `fixtures/` and comparing `sha256sum` before and after: no difference. No real bank
statement is involved; `fixtures/FICTIONAL.md` says so and
`.github/checks/fixture-privacy.mjs` refuses any IBAN-like value or valid card number.

## 5. Build the three sites

```bash
pnpm build
```

Three `vite build` runs, one per application, each ending with `✓ built in …s`. Output lands in
`dist/skeleton/`, `dist/envelopes/`, `dist/mutual-aid/`. A site whose entry is missing is skipped
with `skip <name>: no entry yet` rather than failing the run.

## 6. Assemble the index and the proof page

```bash
node scripts/assemble-site.mjs
```

Generates `dist/index.html` (the three cards) and `dist/proof.html` **from `docs/proofs.json`** —
which is why the published proof page cannot drift from the repository: it is regenerated, never
edited. Run it after step 3 and step 5.

## 7. The acceptance run

```bash
npx vite-node scripts/recette.ts
```

Drives the built site in Chromium at 390×844, measures twelve checks and writes
`docs/recette.json`. Expected last line: `12/12 checks passed — written to docs/recette.json`, with
`PASS` on each row. Two rows print `DEVI` instead of `PASS`, and that is the expected state: each
carries a written reason (`chain` and `properties`, see `DEVIATIONS` in the script). The recorded
run (`docs/recette.json`, 13 November 2026) reports: import 383 ms for 12 000 lines, chain 402 ms,
public view 16 566 B gzip, 0 foreign request, 0 critical and 0 serious accessibility violation.

Two numbers that decide whether the run is meaningful: `network` must report **0 foreign
request(s)**, and `public` must report **0 private markers**.

## What you should have at the end

| Artifact | Produced by | What it is |
|---|---|---|
| `docs/proofs.json` | `pnpm proof` | every mechanical claim, machine-written |
| `docs/recette.json` | `npx vite-node scripts/recette.ts` | the twelve acceptance checks |
| `dist/` | `pnpm build` + `node scripts/assemble-site.mjs` | the three applications, the index and the proof page, ready to serve statically |

Serve `dist/` with any static file server and the pages work; they issue no network request after
loading. If you only want to read the documentation, none of this is needed: the proofs are
already in `docs/`.

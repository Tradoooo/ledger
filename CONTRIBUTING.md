# Contributing

Short version: keep it small, keep it proven, keep the applications out of the skeleton.

## Before you open a pull request

```bash
pnpm check   # types, repo lint, three guards, 95 tests
pnpm proof   # every mechanical claim, written to docs/proofs.json
```

Both must be green. `pnpm check` fails on a file over 500 lines, a function over 50 lines, a
forbidden pattern (`Date.now`, `new Date(`, `Math.random(`, `fetch`, `any`), a line budget, or an
application concept inside `packages/**`.

## The three rules

1. **The ceiling does not move.** The skeleton is limited to 1 500 (core) + 1 500 (ui) + 200
   (skeleton) = 3 200 lines, and each application to 600. `node .github/checks/loc-budget.mjs`
   enforces it; the only accepted fix is **removing code**. When a feature does not fit, the feature
   leaves — see `.kiro/steering/lean.md`, which keeps a written reason for every refusal.
2. **A number comes from a script.** Cite `docs/proofs.json`, `docs/recette.json` or
   `node .github/checks/loc-budget.mjs`; if a figure is not in one of them, it is not a figure.
   Never estimate, never round in the direction that flatters the project.
3. **The skeleton holds no application concept.** Accounts, memos and rules of a specific
   application live in `apps/<name>/`; `.github/checks/purity.mjs` names the owner of any word that
   escapes. If a guard needs an exception, annotate the line with `// purity-ok: <reason>` — never
   weaken the guard.

## Where things go

| You are adding | Put it in |
|---|---|
| An accounting law, a report, a fold | `packages/core/src/` (it must be needed by both applications) |
| A screen used by one application | that application, or `packages/ui/src/` if both need it |
| A new application | `apps/<name>/` with one `ledger.config.ts`; 600-line budget; the third `apps/` is the last |
| Data | `fixtures/`, synthetic, regenerable from the seed — never a real statement |

## Decisions that deserve a file

A choice that is hard to reverse gets an ADR in `docs/adr/` (context, decision, consequences,
alternative rejected). Existing examples: the synchronous SHA-256, the immutable ceiling, the
irreversible redaction.

## Style, in one breath

TypeScript strict, ESM, no `any`; amounts are integers in minor units; the core never reads the
clock or randomness (`createdAt` and `idFactory` are injected); commits in the imperative; English
in code, documentation and commit messages.

## Reporting a security problem

See `SECURITY.md`. Do not open a public issue with a working exploit.

# ADR 0002 — the line ceiling never goes up

- Status: accepted
- Date: 13 November 2026
- Code: `.github/checks/loc-budget.mjs`, `.kiro/hooks/loc-budget.json`, `.kiro/steering/lean.md`

## Context

The claim of this repository is that a ledger can be *lean enough to be read*. Lean is not a
style; it is a number that either holds or does not. The context that made this an ADR: the
author's previous project promised 3 300 lines and ended at 7 994, with four ceiling raises and
14 published URLs — the demonstration the category asks for became impossible to perform
(`KIRO_JOURNAL.md` §5).

## Decision

Fix the skeleton at **1 500 (core) + 1 500 (ui) + 200 (skeleton) = 3 200 lines**, before the first
commit, and enforce it as a build failure. Each application carries its own separate budget of
600 lines. When a feature does not fit, **the feature leaves, not the ceiling**. The only accepted
fix to a red budget is removing code.

The rule is enforced twice, and duplicated on purpose: `node .github/checks/loc-budget.mjs` in CI,
`.kiro/hooks/loc-budget.json` for edits made inside an agent session. A file-triggered hook never
sees a change made outside it, so the CI gate is not redundant.

## Consequences

- **Refusals are written down, with a reason each.** `.kiro/steering/lean.md` lists what the
  skeleton will not grow: bank synchronisation, accounts and permissions, VAT, a chart library, a
  state manager, an LLM in the core, a second currency, a gallery of example applications.
- **The admission test is explicit.** Anything new in `core` must be needed by both applications
  *and* have a provable invariant; otherwise it stays in the application, where the purity guard
  can name its owner.
- **A guard may need an exception, and an exception must be visible.** When `purity.mjs` flagged the
  shared contract itself, the fix was an annotated `// purity-ok: <reason>` next to the code, not a
  weaker guard.
- **The number moves only one way.** On 13 November 2026 the measured fill was core 1 399 / 1 500
  (93 %), ui 1 026 / 1 500 (68 %), skeleton 61 / 200 (31 %), total **2 486 / 3 200 (78 %)**;
  applications 596, 598 and 543 out of 600. The command is the authority, not this sentence.
- **The ceiling constrains ambition; it does not measure quality.** It says nothing about whether
  the code is good. It makes "small" falsifiable, which is all it was meant to do.

## Alternative rejected

**A soft budget, or a budget that can be raised with justification.** That is exactly the mechanism
that failed before: every raise had a good reason at the time, and the sum of good reasons was
7 994 lines. A ceiling that can move is not a ceiling; it is a wish with a number attached.

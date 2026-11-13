# Kiro journal

Kept as the work happens. The submission form asks what surfaces were used and what they
changed; this file answers with facts, including the gaps. **Nothing here is claimed unless it
happened in this repository.**

## 1. What exists in `/.kiro`, and what was actually exercised

| Surface | In the repository | Exercised during construction |
|---|---|---|
| Steering (7 files) | `product`, `tech`, `structure`, `testing` (always on) · `accounting.md` on `packages/core/**` · `apps.md` on `apps/**` · `lean.md` on `packages/**` | `accounting.md` and `lean.md` were pasted into every agent brief for the core, so the sign convention and the refusals held across five modules written in parallel |
| Specs (8) | `ledger-contract`, `ledger-journal`, `ledger-reports`, `ledger-envelopes`, `ledger-csv-import`, `ledger-ui`, `app-envelopes`, `app-mutual-aid` — requirements always, `design.md` for the two that needed one | requirements were written **before** the corresponding code, and the `LED-*` identifiers in the specs are the ones the tests cite |
| Hooks (5) | `loc-budget`, `immutable-journal-guard`, `property-guard`, `fixture-privacy-guard`, `bundle-budget` | the hook *commands* ran (as `pnpm guards`, `pnpm proof`), not the Kiro triggers: this machine has no Kiro IDE session. Each hook is therefore duplicated in CI — a file-triggered hook never sees edits made outside the agent |
| Agents (2) | `ledger-reviewer` (read-only), `property-tester` (writes only `*.test.ts`) | written as briefs; **not executed** — no Kiro session available. Their checklists are the ones I applied by hand |
| Skill + power | `.kiro/skills/new-ledger-app/SKILL.md`, `power/new-ledger-app/POWER.md` | the five-question brief is the one used to write `apps/envelopes` |
| CLI headless, Crew, MCP | **not used** | not claimed. `.kiro/settings/mcp.json` is deliberately empty rather than declaring a server that does not exist |

## 2. Numbers

Measures are produced by scripts, never typed by hand:

- tests and properties → `docs/proofs.json` (`unit-tests`)
- line budgets → `node .github/checks/loc-budget.mjs`
- published pages → `node scripts/check-live.mjs`
- bundle size → `docs/proofs.json` (`bundle-budget`)

## 3. What the properties found

Filled with real counter-examples only, each with its seed. An empty section is better than an
invented one; it stays empty until a property actually fails.

## 4. Spec vs "vibe coding", on one function

Function chosen: `contra()` + chain recalculation. **Not measured yet.** The comparison needs two
timed sessions on the same brief; the figures go here when they exist.

## 5. The budget, honestly

The ceiling was fixed at 1 500 + 1 500 + 200 = 3 200 lines **before the first commit** and has never
been raised. When `purity.mjs` flagged the shared contract itself (`View.app` enumerates the two
applications), the fix was an explicit, auditable exception (`// purity-ok: <reason>`) — not a
weaker guard.

Context, because it explains every rule here: the author's previous project (`bare-bones`,
destroyed on 12 November 2026) started at a 3 300-line promise and ended at **7 994 lines**, with
four ceiling raises, **14** published URLs, and its `views` extension point still a hard-coded
`switch` — the one demonstration the category asks for, impossible to perform. This repository
exists to not repeat that: a ceiling that does not move, three URLs, and a purity guard that names
the application a concept belongs to.

## 6. What did not work

- Eight specs before any code: right for the contract and the journal, ceremony for `ledger-reports`
  and `ledger-ui`, whose design came out of the tests instead.
- The purity guard's first run flagged the contract file itself. Weakening the rule would have
  removed the only guard on direction; the annotated exception is the fix.
- The property that the chain verifies after appends first failed for a *test* reason: with fewer
  than two entries the tampering index did not exist. The generator now produces at least two
  entries — a reminder that a property can pass or fail for reasons unrelated to the code it guards.

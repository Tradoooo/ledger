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

**The honest answer: no product counter-example surfaced after the invariants were formalised, and
that is a fact, not an omission.**

- The 15 properties of the cahier (`LED-P-01` … `LED-P-15`) run at 10 000 cases each in the
  acceptance campaign (74 s locally, `LEDGER_RUNS=10000`) and at **20 further seeds × 200 runs**
  (`node scripts/seed-sweep.mjs`): all green.
- One property did fail, and it was a **test** fault, not a product fault: the chain property
  generated fewer than two entries, so the tampering index did not exist. The generator now
  produces at least two entries.
- What the properties *did* find is written down in `docs/UNKNOWN-ROOM.md`: five edges of the
  skeleton found by a third application, not by a test. Two of them were fixed afterwards — the
  core now accepts any application name in `View.app` (a core that knows its applications is a
  core that will grow application code), and the theme of `definePresentation` now has an effect
  (`data-theme` on the shell).
- The one real performance defect found by measurement: the pure-JS SHA-256 was rewritten to avoid
  allocating on the hot path (189 ms → 111 ms for 12 000 hashes of a 300-byte message).

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

## 5 bis. The second pass (13 November, evening) — making the video true

The first version of the project promised six things in its own video script that **no screen
delivered**: a rule that learns, a reversal, a hand-written entry, an export, a projection as a
range, and the "what this chain does not prove" paragraph *on the public page*. A jury that
opened the repository after the video would have found six gaps. The second pass closed them:

| Delivered | Where |
|---|---|
| `EntryForm` (shared), `publicPage` (a standalone HTML document), `errorSentence` | `packages/ui` |
| Learned rules with their usage counter, reversal from the journal, export/import `.ledger.json`, projection as a range | `apps/envelopes` |
| Manual entry, the "what it proves / does not prove" box, the downloadable public page, the printable annual statement with totals in words | `apps/mutual-aid` |
| Manifest, service worker and icon on the three sites (one generator, no application file touched) | `scripts/pwa.mjs` |
| Eight end-to-end tests against the **build**: the whole household gesture, the fund gesture, keyboard, mobile, reduced motion | `e2e/` |

Two things the machine caught that the eye did not:

1. **The overflow debt, repaid in one line of CSS.** The e2e suite recorded nine views wider than a
   phone (up to 688 px instead of 390). The fix belonged to the shared stylesheet — `min-width: 0`
   on the grid children, a scroll container on the cards, hashes that wrap — and it removed the
   whole debt: **16/16 views now fit in 390 px**, and `e2e/known-overflows.json` is empty.
2. **A contrast regression that the theme introduced.** The `ink-paper` theme set the shell's
   colours but not its background, so light text landed on light paper: one *serious* axe
   violation on the fund's page. The acceptance run failed on it; the fix was one line
   (`.bb-shell` paints `var(--paper)`).

The spec-driven comparison was measured rather than asserted: `docs/spec-vs-vibe.md`, with both
implementations published. The honest result is that **the spec did not make it faster** (27 min 59 s
against 27 min 00 s) — it made the result narrower (194 lines against 215, 21 tests against 16) and
it made the output fit the house rules (no deep import), which the one-paragraph version did not.

## 5 ter. One number that moves, and how we say it

Verifying the 12 000-link chain takes **78 ms** on the CI runner, about **90 ms** on an idle
machine, **188 ms** while five agents share the box, and once **402 ms** while three measurement
campaigns ran at the same time. The acceptance run prints the value of the day, and the documents
quote the range instead of the best number: a measurement that depends on the load of the machine
is a measurement, not a constant.

## 6. What did not work

- Eight specs before any code: right for the contract and the journal, ceremony for `ledger-reports`
  and `ledger-ui`, whose design came out of the tests instead.
- The purity guard's first run flagged the contract file itself. Weakening the rule would have
  removed the only guard on direction; the annotated exception is the fix.
- The applications are now **full**: `envelopes` 596/600 and `mutual-aid` 598/600. The next feature
  will have to be paid for by a subtraction, in an application, not by a rise of the ceiling.
- The property that the chain verifies after appends first failed for a *test* reason: with fewer
  than two entries the tampering index did not exist. The generator now produces at least two
  entries — a reminder that a property can pass or fail for reasons unrelated to the code it guards.

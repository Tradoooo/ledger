# Spec-driven against vibe coding, on one function

The submission form asks for a comparison. This is the measurement, with its limits stated first.

## The protocol

**Same task, two contexts, one model, one machine, both running at the same time.**

The task: implement `correct(entry, correction)` on a ledger whose entries are frozen and whose
journal is append-only — a reversal entry that names the original, must balance, must carry a
plain-language note, must not mutate anything.

| | Arm A — **spec-driven** | Arm B — **vibe coding** |
|---|---|---|
| Given | `.kiro/specs/ledger-journal/requirements.md`, `design.md`, `.kiro/steering/accounting.md` | one paragraph of prose (the same requirement, in four sentences) |
| Forbidden | — | reading the specs or the steering |
| Output | `scratch/spec-vs-vibe/spec/` | `scratch/spec-vs-vibe/vibe/` |
| Both copied verbatim into | [`docs/spec-vs-vibe/correct.spec-driven.ts`](spec-vs-vibe/correct.spec-driven.ts) | [`docs/spec-vs-vibe/correct.vibe.ts`](spec-vs-vibe/correct.vibe.ts) |

## The result

| Measure | Spec-driven | Vibe |
|---|---|---|
| Module | **194 lines** | **215 lines** |
| Tests written | **322 lines, 21 tests** | 320 lines, **16 tests** |
| Behaviour delivered | both pass | both pass |
| **Import discipline** | **type-only**, from the package entry | **five deep value imports** (`core/src/hash`, `core/src/ids`, `core/src/journal`) — exactly what the repository's `lint` guard refuses |
| Elapsed | ~29 min | ~25 min |

Both were running concurrently on the same machine, and both were slowed by that contention; the
elapsed figures are order-of-magnitude, not a benchmark.

## What the numbers actually say

1. **The spec did not make the code shorter — it made it narrower.** Arm A wrote fewer lines and
   *more* tests, because `design.md` had already decided the shape (what a reversal is, what the
   canonical form touches) and left only the cases to enumerate. Arm B had to invent that shape, and
   invented a richer one than asked (content-derived identifiers, a `date` option) — 21 lines more.
2. **The measurable difference is discipline, not speed.** Arm A never reached into the core's
   internals; Arm B imported five internals directly. In this repository that is not a style
   preference: `.github/checks` and `scripts/lint.mjs` fail the build on a deep import. In other
   words, **the vibe output would not have been mergeable**, and the reason is invisible in the task
   description — it lives in the steering.
3. **Both passed their own tests.** Neither arm produced a defect the other avoided. On a task this
   small, the honest conclusion is that the spec's value showed up in the *review*, not in the
   *result*: one output fits the house rules, the other does not.

## Limits of this experiment

- **One task, one model, one run per arm.** This is an anecdote with numbers attached, not a study.
- The two arms were not isolated from the machine's load (both ran while the acceptance campaign and
  the seed sweep were running), so the durations are not comparable as performance.
- The "vibe" arm still received a *well-written* paragraph — the comparison is spec vs. good prose,
  not spec vs. no brief at all.
- A larger effect is plausible but **not measured**: on a task spanning several modules, the
  difference between "the shape was decided before writing" and "the shape is discovered while
  writing" would show up in rework, which one run cannot reveal.

What would make this a real measurement: five tasks of increasing ambiguity, two runs per arm, and
a defect count by an independent reviewer who does not know which arm is which. That is a day of
work and it did not fit before the deadline — so the limitation is printed rather than hidden, and
the two implementations are published so anyone can re-run the comparison.

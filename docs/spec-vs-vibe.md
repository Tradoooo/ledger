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
| Tests written | **322 lines, 21 tests** (10 fast-check properties, 500 generated cases) | 320 lines, **16 tests** (~2 300 generated cases) |
| Behaviour delivered | both pass | both pass |
| **Import discipline** | **type-only**, from the package entry | **five deep value imports** (`core/src/hash`, `core/src/ids`, `core/src/journal`) — exactly what the repository's `lint` guard refuses |
| Elapsed | **27 min 59 s** | **27 min 00 s** |
| Tool calls | 27 | 19 |
| Cases left to arbitrate | 7 (list below) | 7 (list below) |

Both were running concurrently on the same machine, and both were slowed by that contention; the
elapsed figures are order-of-magnitude, not a benchmark.

## What the numbers actually say

1. **The spec did not make it faster.** 27 min 59 s against 27 min 00 s — the same, within noise.
   Anyone claiming that a spec buys speed on a one-function task is selling something.
2. **It did not remove the judgement calls.** Both arms listed **seven** arbitrations ("what the
   text did not say"). The spec removed the ambiguity about *the shape* — what a reversal is, what
   the canonical form touches, which error codes exist — but it did not remove the ambiguity about
   *edge cases*: whether an empty `newPostings` means "mirror" or "zero entries", whether `-0` must
   be normalised, whether a reversal may itself be reversed. Those were decided, in both arms, by
   the person writing the code.
3. **The measurable difference is discipline.** Arm A never reached into the core's internals;
   Arm B imported five of them directly. In this repository that is not a style preference:
   `scripts/lint.mjs` fails the build on a deep import. **The vibe output would not have been
   mergeable**, and the reason is invisible in the task description — it lives in the steering, and
   only the spec arm read it.
4. **The spec arm wrote more tests for the same behaviour** (21 against 16) and fewer lines of code
   (194 against 215): less invention, more enumeration. Arm B also *added* behaviour nobody asked
   for — content-derived identifiers, a `date` option — which is where the extra 21 lines went.

So the honest summary of one measured run: **the spec changed the shape of the work, not its
duration.** It produced code that fits the house rules, and tests that cover more of the contract —
which is exactly what a reviewer needs, and exactly what a marketing slide about "spec-driven
development" usually leaves out.

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

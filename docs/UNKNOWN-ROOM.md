# The unknown room

**The claim we wanted to test:** that the skeleton is clear enough that somebody who has never
opened the repository can build a working application from it, without touching the core.

**The protocol.** One brief, one shipped power, a chronometer. The brief was a *time bank* —
hours given and received between members, unit `hour` (a quantity, not a currency), one monthly
report, no envelope. The subject had the repository, the power (`power/new-ledger-app/POWER.md`,
`.kiro/skills/new-ledger-app/SKILL.md`) and nothing else.

## The result

| | |
|---|---|
| Start (first read of the repository) | 16:04:21 |
| End (final verification) | 16:20:53 |
| **Elapsed** | **16 min 32 s** |
| Target (cahier H.13.4) | under 15 minutes |
| Files created | 11, all under `apps/time-bank/` — **not one line under `packages/**`** |
| Size | 542 non-empty lines (ceiling 600) |
| Build | `✓ built in 3.53 s` · 106.7 kB gzipped |

**Over the target by 1 min 32 s, and the machine was not idle:** the acceptance campaign
(`scripts/recette.ts`, 10 000 fast-check runs) was running on the same box during the test.
The honest reading is "about 15 minutes on an idle machine, 16 min 32 s on a busy one".

## What the subject built

A time-bank ledger with a **quantity** unit (`hour`), one liability account per member, no
envelope, and four tabs (record, monthly report, journal, audit). A transfer is the giver
debited and the receiver credited — two postings summing to zero.

Acceptance, each line reproduced by the commands in `apps/time-bank/`:

| Check | Result |
|---|---|
| Builds | ✓ `vite build` → 347 kB / 106.7 kB gzip |
| Starts and renders | ✓ "Neighbourhood time bank · 0 entries · 2 members · unit: hour" |
| Accepts two entries | ✓ "Marta gave 3 h to Ali on 2026-03-15" · "Ali gave 1 h back to Marta on 2026-04-10" |
| Refuses an unbalanced entry | ✓ "an entry needs at least two postings whose amounts sum to zero. One posting alone is not an entry. (Σ = 3 h, not 0)" |
| Monthly report | ✓ per member and per month: given, received, net |
| Budget | ✓ `ok app:time-bank 542/600` |
| Types | ✓ `tsc --noEmit` reports nothing |
| Git | ✓ `git status` shows only `apps/time-bank/**` |

## What the core did *not* offer — and what the subject did instead

This is the most useful output of the test: it lists the real edges of the skeleton.

1. **A quantity unit has no code in a posting.** `Posting.unit` is a three-letter code, while a
   quantity unit carries a label. The subject took the code from the core's own `chartUnit()`
   ("HOU") and used the core's `minorDigits()`/`toMinor()` rather than hard-coding 100.
   *Consequence:* `HOU 3.00` in the shared journal table; the application's own report says `3 h`.
2. **No per-member monthly report in the core.** `trial-balance` and `income-statement` cover
   assets, income and expenses; members are liabilities. The subject folded the same postings by
   month and member **inside the application**, as `.kiro/steering/apps.md` requires, and left every
   balance to the core.
3. **`View.app` was a closed enum.** A third application could not encode a shareable view.
   *Fixed after the test:* the core now accepts any application name, because a core that knows
   the applications it serves is a core that will grow application code.
4. **The theme was declared but not consumed.** `definePresentation({ theme })` had no effect on
   the rendering. *Fixed after the test:* `Shell` now applies the theme (`data-theme`), and
   `warm-paper` / `ink-paper` / `plain` are real token sets.
5. **No locale key for a time bank** — application strings stay in the application.

The application is **not published**: three URLs is the ceiling (`.kiro/steering/lean.md`). It
lives in the repository as the proof, and it is the third application of the video.

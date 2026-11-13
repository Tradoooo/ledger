# Power: new-ledger-app

**What it does.** Turns a one-page brief into a working ledger application built on the skeleton,
without touching `packages/**`.

**Inputs it asks for** (five answers, nothing more): name · locale (en/fr) · unit (ISO 4217 or a
quantity such as `hour`) · accounts (a list of `a:b:c` with their type) · reports (from the five
`ViewName`s).

**What it produces.**
1. `apps/<name>/ledger.config.ts` — the single configuration file of the application.
2. `apps/<name>/index.html`, `vite.config.ts`, `src/main.tsx` — the shell, copied from `skeleton/`.
3. A spec under `.kiro/specs/app-<name>/` with its requirements and tasks.

**What it refuses.** Any change to `packages/core` or `packages/ui`; a sixth extension point; a
fourth published URL. If the brief needs one of those, the power stops and says why — that is the
answer the skeleton exists to give.

**Proof of use.** `docs/UNKNOWN-ROOM.md` records the third application (a time bank, unit `hour`)
built with this power by someone who had never opened the repository: chronometer, transcript,
and the fact that no file under `packages/` was modified.

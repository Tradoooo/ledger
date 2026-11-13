# Skill: new-ledger-app

Produces a third application from the skeleton in under fifteen minutes, without touching
`packages/**`.

1. Copy `skeleton/` to `apps/<name>/`.
2. Write `ledger.config.ts`, answering five questions: name, locale, unit, accounts, reports.
   Envelopes only if the application budgets something.
3. Run `node .github/checks/loc-budget.mjs` — the new application must stay under 600 lines.
4. Run `npx vitest run` — the core properties must stay green, untouched.
5. Publish only if it is one of the three published URLs (`lean.md`).

The acceptance test is the unknown-room protocol (`docs/UNKNOWN-ROOM.md`): a person who has never
seen the repository does it, chronometer running, and succeeds in under 15 minutes.

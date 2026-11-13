# Security

## What is exposed

**Nothing.** There is no application server, no account, no login, no cookie, and no network
request after the page loads: `docs/recette.json` measures **0 foreign request(s) over 4 pages**,
and `scripts/lint.mjs` bans `fetch` and `XMLHttpRequest` in the source. The three applications are
static files; the data they hold lives in the browser tab that opened them.

- No bank synchronisation, no aggregator, no API key: each refusal has a written reason in
  `.kiro/steering/lean.md`.
- The published fund page carries a **redacted** journal, rebuilt from zero: no party identifier,
  no `evidence` fingerprint, no free text (threshold measured in `docs/recette.json`, check
  `public`: 0 private marker, 0 private id, 0 evidence).
- Fixtures are synthetic, generated from the fixed seed `20261103`; `.github/checks/fixture-privacy.mjs`
  fails the build on any IBAN-like value or valid card number.

## What this project does not protect against

- **A hostile machine.** The journal is held by the browser, so whoever controls the device or the
  browser profile holds the data.
- **A lying bookkeeper.** The hash chain proves that records were not edited after the fact; it does
  not prove that an entry is sincere. This limit is stated in `docs/PROOFS.md` and in ADR 0003.
- **A truncated tail.** Whoever holds the journal can publish a shorter head. Mitigation, not a fix:
  the head hash is published with it, so donors can compare the two.
- **A tampered `dist/`.** The site is served as static files; if you self-host it, its integrity is
  the integrity of your hosting, not of this repository.

## Reporting a problem

Use GitHub's **private vulnerability reporting** on `github.com/Tradoooo/ledger` (Security tab,
"Report a vulnerability"). That channel was not verified as enabled when this file was written; if
it is unavailable, open a public issue that describes the affected file and the class of the
problem **without** a working exploit or anyone's data, and say that you are withholding details.

Useful to include: the commit, the file, the command that reproduces it, and what you expected.

Expected handling: an acknowledgement, then either a fix or a written explanation of why the
behaviour is intended. No bug bounty is offered, and none is promised here.

## The two rules a security report is measured against

1. **The ceiling does not move.** A fix that adds lines runs into
   `.github/checks/loc-budget.mjs`; the accepted fix is removing code, or an explicitly recorded
   refusal in `.kiro/steering/lean.md`.
2. **A claim needs a script.** A fix must keep `pnpm check` and `pnpm proof` green, and a new
   number must land in `docs/proofs.json` or `docs/recette.json`, never in prose.

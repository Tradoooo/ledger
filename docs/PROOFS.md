# Proofs

Each row answers one question: **what proves this, and where can it be seen?**
The `pnpm proof` command re-runs every mechanical proof and writes `docs/proofs.json`; the
published page `/proof.html` is generated from that file, so it cannot drift from the repository.

| Claim | Proof | Where |
|---|---|---|
| Every entry sums to zero | `validateEntry` + `journal.test.ts` (`UnbalancedEntry`, exact gap) | `packages/core/src/journal.test.ts` |
| Nothing is mutable | recursive `deepFreeze` + `Object.isFrozen` assertions | `packages/core/src/journal.test.ts` |
| The chain verifies after any append or reversal | property, seed 20261113 | `packages/core/src/journal.test.ts` |
| SHA-256 is the real SHA-256 | compared to `node:crypto` on random strings | `packages/core/src/hash.test.ts` |
| The hash ignores key order but not posting order | two tests pinning both halves | `packages/core/src/hash.test.ts` |
| The trial balance is always balanced | property, seed 20261113 | `packages/core/src/reports.test.ts` |
| Envelope rollover conserves value over 24 months | property, seed 20261113 | `packages/core/src/envelopes.test.ts` |
| `leftToday` never creates a deficit | simulation property | `packages/core/src/envelopes.test.ts` |
| Splits are conservative | property, remainder to the first leg | `packages/core/src/rules.test.ts` |
| Import is idempotent | import twice, compare hashes | `packages/core/src/csv.test.ts` |
| A public view is irreversible | no private marker survives redaction | `packages/core/src/view.test.ts` |
| Any fragment opens a valid view or a typed error | `decodeView` on arbitrary strings | `packages/core/src/view.test.ts` |
| No clock, no randomness, no network in the core | `scripts/lint.mjs` | `pnpm lint` |
| The skeleton holds no application concept | names the application a concept belongs to | `.github/checks/purity.mjs` |
| Fixtures are fictional | IBAN + Luhn card check | `.github/checks/fixture-privacy.mjs` |
| The ceiling never moves | line budgets, total 3 200 | `.github/checks/loc-budget.mjs` |
| The three pages answer, for real | HTTP 200 + expected content | `scripts/check-live.mjs` |
| Bundle stays under budget | gzip measurement at build | `scripts/run-proofs.mjs` |
| The whole acceptance run, 12 checks | import 504 ms · balance 5 815 396 = 5 815 396 · chain 181 ms · tamper at seq 4 287 · replay identical · public 16.6 kB gzip · 0 foreign request · 0 serious a11y · 2 documented deviations | `npx vite-node scripts/recette.ts` → `docs/recette.json` |
| The properties hold for other seeds | 20 seeds × 200 runs, all green | `node scripts/seed-sweep.mjs` |
| A third application, from a stranger | 16 min 32 s, 542 lines, **no line changed under `packages/**`** | `docs/UNKNOWN-ROOM.md` |
| The whole gesture, on the build | 8 Playwright tests: import → correct a rule → read the figure, record an entry → verify a receipt → publish, keyboard, mobile, reduced motion | `node --test e2e/` |
| No view overflows a phone | **16/16** views fit in 390 px (the overflow debt was repaid in `packages/ui/src/styles.css`) | `e2e/layout.test.mjs`, `e2e/known-overflows.json` |
| The apps work offline | manifest + service worker + icon on the three sites, one generator | `scripts/pwa.mjs`, proof `offline` |
| The spec beat the brief, measured | 27 min 59 s against 27 min 00 s: same speed, narrower result, 21 tests against 16 | `docs/spec-vs-vibe.md` |

## Not proven here

- that the entries are *sincere*: the chain proves coherence, not truth;
- that the journal was not truncated at the end: whoever holds the file can publish a shorter head.
  Mitigation: the head is printed in the annual report and compared by donors (documented on the
  public page, not hidden);
- the spec-vs-vibe coding timing: not measured yet (`KIRO_JOURNAL.md` §4).

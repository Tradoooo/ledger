# Tech

- TypeScript strict, ESM, no build step for the packages: Vite builds the three sites.
- Runtime dependencies: **`zod` only**, plus React in the UI. No chart library, no CSV
  library, no date library, no state manager, no database.
- Tests: Vitest, fast-check for properties (seeded, seeds recorded in `KIRO_JOURNAL.md`).
- Amounts are **integers in minor units**. Never a float, never a `Number` sum of decimals.
- SHA-256 is implemented in the core (`packages/core/src/hash.ts`), synchronously, and
  checked against `node:crypto` by a unit test.
- No clock and no randomness in the core: `createdAt` and `idFactory` are injected
  (LED-N-04). `scripts/lint.mjs` fails on `Date.now`, `new Date(` or `Math.random(`.
- Zero network: no `fetch`, no XHR, no WebSocket (LED-N-05). Views travel in the URL
  **fragment**, never in the query string.

# e2e — the gestures, on the build

The suite drives the **built** site (`dist/`), never the sources: what a visitor gets is what is
tested. It uses `playwright` + `node:test` — no new dependency, no test runner to install.

```bash
pnpm build            # the three sites into dist/
node --test e2e/      # the suite
node scripts/record-demo.mjs   # the raw material of the film, into artifacts/
```

| File | What it proves |
|---|---|
| `household.test.mjs` | the household gesture: correct an assignment, see the learned rule, read `leftToday`; then import the real statement `fixtures/household-3y.csv` (12 000 lines) — nothing leaves the browser |
| `fund.test.mjs` | the fund gesture: type an entry, check a receipt against the chain, publish the standalone public page — and refuse a forged receipt |
| `keyboard.test.mjs` | every screen reached with `Tab` and opened with `Enter`, the focus ring measured at every stop, a receipt verified without a mouse |
| `layout.test.mjs` | 390×844 without horizontal overflow, the one figure still the largest thing on screen, and `prefers-reduced-motion: reduce` honoured |
| `support.mjs` | the server, the page, the helpers — the measurement code, in one place |
| `server.mjs` | the static server over `dist/` |
| `known-overflows.json` | the measured overflow debt: empty today. A view that overflows is a failure, and a new debt is written down here with its reason |

**Rules of the suite:** it never clicks with the mouse where a keyboard would do; it watches the
console and the network, so a stray error or a foreign request fails the test; it asserts on
what a visitor reads (the figure, the notice, the tab), not on the internals of the application.

**CI:** the `e2e` job of `.github/workflows/recette.yml` runs `node --test e2e/` on the build,
with its own five-minute budget.

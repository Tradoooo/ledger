# Product

**Ledger** is a double-entry skeleton: a small, readable core where the law is
`Σ postings = 0`, the journal is append-only and hash-chained, and every balance is
a fold — never stored state.

Two applications come out of it, at opposite ends of the privacy spectrum:

- `apps/envelopes` — a household: everything private, nothing leaves the browser, one
  number on screen ("can I still spend tomorrow?").
- `apps/mutual-aid` — a solidarity fund: everything public, a hash chain a donor can
  verify with no tool and no account ("where did the money go?").

The skeleton itself ships **no** application concept. If both applications do not need
it, it does not enter `packages/` (see `lean.md`, enforced by `.github/checks/purity.mjs`).

# Structure

```
packages/core/src   the contract and the engine (≤ 1500 lines, tests excluded)
packages/ui/src     React components, no IndexedDB, no business law (≤ 1500 lines)
skeleton/src        an empty application that runs (≤ 200 lines)
apps/envelopes      household application (≤ 600 lines of its own)
apps/mutual-aid     solidarity fund application (≤ 600 lines of its own)
fixtures            synthetic data, seed 20261103
scripts             guards, proofs, fixtures, build, live check
docs                PROOFS.md, ARCHITECTURE.md, SUBMISSION.md, video script
```

One concept per file. Files under 500 lines, functions under 50. A file that grows
past its budget is split, not annotated. Imports go through the package entry
(`@ledger/core`), never through `@ledger/core/src/...`.

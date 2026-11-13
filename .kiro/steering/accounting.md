---
inclusion: fileMatch
fileMatchPattern: "packages/core/**"
---
# Accounting rules (core only)

1. **Sign convention.** Debit is positive. `asset` and `expense` are debit-normal;
   `liability`, `equity` and `income` are credit-normal.
2. **The only law.** For every entry, `Σ amountMinor = 0` in a single unit. An entry that
   mixes units is refused (`MixedUnits`) unless `kind: "conversion"`.
3. **Nothing is edited.** No public function mutates an entry. Correction is `contra()`:
   a mirror entry, `kind: "reversal"`, `reverses: <id>`, amounts strictly opposite, note required.
4. **The hash.** `sha256("ledger:v1\n" + prevHash + "\n" + canonicalJson(payload))`, keys sorted,
   no whitespace, integers only. Posting **order** is part of the hash and **not** part of any
   balance: the asymmetry is deliberate and documented.
5. **Balances are folds.** `balances()` walks the journal. There is no derived state to keep
   in sync, so the "balance out of date" bug class cannot exist.
6. **Frozen.** Every journal, record and posting is recursively frozen on construction.
   A write attempt throws; a test asserts it (`LED-P-05`).

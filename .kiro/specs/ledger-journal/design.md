# ledger-journal — design

`canonical(entry) = "ledger:v1\n" + prevHash + "\n" + canonicalJson({id,date,kind,note,unit,tags,reverses,postings})`

- `canonicalJson`: keys sorted at every depth, no whitespace, integers only.
- Absent optional fields are normalised to `null`/`[]` before hashing, so two equivalent entries
  cannot produce two hashes.
- Posting order is hashed (it is what was typed) and ignored by balances (folding commutes).
  The asymmetry is deliberate; a test pins both halves.
- `append` returns a new frozen journal. `verifyChain` walks once, O(n), and stops at the first fault.

Rejected alternative: storing a Merkle tree. The chain is enough for "nothing was edited, removed
or reordered", and a tree would cost ~200 lines for a property nobody can check in 30 seconds.

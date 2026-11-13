# ledger-journal — requirements

- LED-F-01 WHEN an entry is submitted, the system SHALL refuse it if its postings do not sum to zero
  per unit, with `UnbalancedEntry` naming the exact gap.
- LED-F-03 WHILE the journal exists, the system SHALL expose no public function that edits an entry.
- LED-F-04 WHEN a user reverses an entry, the system SHALL append a `reversal` entry linked by
  `reverses`, with strictly opposite amounts and a mandatory note.
- LED-F-05 WHEN an entry is appended, the system SHALL compute `hash` over the canonical form with
  `prevHash` and SHALL increment `seq`.
- LED-F-06 WHEN `verifyChain()` is called, the system SHALL answer `ok`, or the first faulty index
  with its reason (`broken-link`, `bad-hash`, `bad-seq`).

# ledger-csv-import — requirements

- LED-F-09 WHEN a statement is dropped, the system SHALL detect encoding, separator, decimal separator
  and date column, and SHALL show its detection before importing.
- LED-F-10 IF an imported line would produce an unbalanced entry, THEN the system SHALL reject it and
  put it in an exportable reject report.
- LED-F-11 WHEN the same statement is imported twice, the system SHALL skip lines already present
  (via the `evidence` fingerprint) and SHALL say so.
- LED-P-14 Import is idempotent: same file, same number of entries, same hashes.

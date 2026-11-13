# ledger-reports — requirements

- LED-F-07 The system SHALL compute every balance and report as a fold over the journal, with no
  persisted derived state.
- LED-F-18 The system SHALL produce its reports as pure functions of the journal and the configuration,
  with no side effect.
- LED-P-02 The trial balance SHALL always be balanced (`Σ debit = Σ credit`).
- LED-F-23 The system SHALL produce a printable annual report: A4, paginated, readable without colour,
  totals spelled out.

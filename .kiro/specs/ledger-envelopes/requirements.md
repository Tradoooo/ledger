# ledger-envelopes — requirements

- LED-F-15 The system SHALL compute `available = budget + carriedIn − spent` per envelope and SHALL
  carry the remainder according to `rollover` and `capMinor`.
- LED-F-16 WHEN the household application opens, the system SHALL display the single `leftToday` figure
  before any other datum.
- LED-F-17 The system SHALL render the end-of-month projection as a range (median and spread of the last
  three months), never as a single value.
- LED-P-08 Over 24 simulated months, `Σ budget + carried₀ = Σ spent + carriedFinal + Σ abandoned`,
  where `abandoned` is explicitly what the rollover policy throws away.
- LED-P-13 Spending exactly `leftToday` every remaining day SHALL never put the month in deficit;
  the final residue lies in `[0, daysLeft)` minor units.

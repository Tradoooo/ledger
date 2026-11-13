# ledger-reports — design

Four report kinds, one discriminated union (`Report` in `schema.ts`):

| Kind | Function | Folding over |
|---|---|---|
| `trial-balance` | `trialBalance(journal, chart, {asOf, unit})` | all postings at or before `asOf` |
| `income-statement` | `incomeStatement(journal, chart, {from,to,unit})` | income and expense accounts in the range |
| `envelopes` | `envelopeReport(...)` | budget periods, with rollover chain |
| `audit-trail` | `auditTrail(journal, {from,to})` | the records themselves, plus `headHash` |

No report caches anything. Rendering is the UI's job; a report is data, which is what makes it
testable and printable with the same code.

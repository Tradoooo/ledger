---
inclusion: fileMatch
fileMatchPattern: "packages/**"
---
# Lean: what this skeleton refuses, and why

The line ceiling (1 500 + 1 500 + 200) never goes up. When a feature does not fit, the
feature leaves — not the ceiling. Refusals, each with its reason:

| Refused | Why |
|---|---|
| Bank synchronisation, PSD2 aggregators | needs a server and a licence; import of a file is enough |
| Accounts, login, multi-user | the trust model is silence (private) or proof (public), not permissions |
| VAT, tax return, statutory chart of accounts | that is accounting software, not a ledger |
| A chart library | one SVG sparkline and tables are enough; a dependency would outweigh the whole UI |
| A state manager | the journal is the state |
| LLM in the core | no feature may depend on a model; rules are deterministic |
| A second currency | conversions are explicit entries, and `unit` already exists |
| A gallery of example apps | three published URLs, not fourteen: the proof is the two applications |

Admission test for anything new in `core`: **do both applications need it, and is the
invariant provable?** Otherwise it stays in the application — and `purity.mjs` says so.

# ledger-contract — requirements

Source: cahier H.6.1. The shapes are in `packages/core/src/schema.ts`; the laws are in `journal.ts`.

- LED-F-02 WHEN an account is declared, the system SHALL validate type, normal side, unit and parent,
  and SHALL reject an identifier outside `a:b:c`.
- LED-F-08 WHEN an entry mixes two units without an explicit `kind: "conversion"`, the system SHALL
  refuse it with `MixedUnits`.
- LED-N-10 EVERY incoming datum (file, URL fragment, storage) SHALL be validated by Zod and produce a
  typed error, never an unhandled exception.

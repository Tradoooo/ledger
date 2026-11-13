# app-mutual-aid — requirements

- LED-F-20 WHEN an entry is prepared for publication, the system SHALL apply the RedactionPolicy and
  SHOW private and public versions side by side before validation.
- LED-F-21 The system SHALL generate a standalone public page, with no network request, whose hash chain
  is recomputed over the **redacted** entries.
- LED-F-22 WHEN a donor types their receipt (`entryId` + `hash`), the system SHALL confirm or deny its
  presence in the chain, offline.
- LED-P-09 The public view SHALL be irreversible: no private marker, no private account id, no `party.id`.

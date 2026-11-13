# ledger-ui — requirements

- LED-N-02 Each application SHALL stay under 220 kB gzipped at start-up; system fonts only.
- LED-N-07 AA accessibility: keyboard navigation, tabular numbers, information never carried by colour
  alone, `prefers-reduced-motion` respected.
- LED-N-08 English and French shipped; adding a language is adding a file.
- LED-F-19 WHEN a view is serialised into an URL, the system SHALL write only in the fragment,
  validated by Zod and bounded to 2 000 characters.

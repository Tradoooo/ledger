# Testing

Every requirement `LED-F-*` names its verification. The 15 properties of the cahier
(`LED-P-01` … `LED-P-15`) live next to the code they protect and always carry a seed.

- Properties run at 1 000 cases by default, 10 000 for the submission campaign.
- A property that fails prints the seed and the smallest counter-example; the counter-example
  is written into `KIRO_JOURNAL.md` §6 with its fix. That section is part of the submission.
- No test may be deleted or weakened to make a change pass. A refactor keeps the old test green.
- Every pull request carries a `## Proof` section naming a test, a guard or a measurement.

---
inclusion: fileMatch
fileMatchPattern: "apps/**"
---
# Writing an application

An application writes **one configuration file** and its screens. It never imports
`@ledger/core/src/...`, never edits `packages/**`, and never re-implements a law.

The five extension points, and what each one owns:

| Point | Signature | Owns |
|---|---|---|
| `defineChart` | `(accounts: AccountInput[]) => Chart` | which accounts exist, their type, unit and normal side |
| `defineRules` | `(rules: RuleInput[]) => RuleSet` | automatic assignment (memo → account), splits, learned rules |
| `defineEnvelopes` | `(envs: EnvelopeInput[]) => EnvelopeSet` | budgets per period and their rollover policy |
| `defineReports` | `(names: ViewName[]) => ViewName[]` | which reports are published |
| `definePresentation` | `(p: PresentationInput) => Presentation` | theme, locale, columns, print title |

`defineLedger({ chart, rules, envelopes, reports, presentation, … })` composes them and
freezes the result. If a screen needs behaviour the core does not provide, the answer is
a report or a view in the application — never a patch to the core.

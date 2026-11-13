# UI API (packages/ui)

The applications import **only** these names from `@ledger/ui`. The components never touch
IndexedDB, never fetch, and never contain accounting law: they render what the core computed.

```tsx
import { Shell, NumberBand, JournalTable, ImportWizard, EnvelopeBoard, ReportViews, AuditTrace, t } from "@ledger/ui";
import type { ShellTab, Locale, MessageKey } from "@ledger/ui";
import "@ledger/ui/styles.css";
```

## Shell
```tsx
<Shell title={string} subtitle?={string} locale={Locale} tabs={ShellTab[]} activeTab={string}
       onTab={(id) => void} actions?={ReactNode}>{children}</Shell>
```
`ShellTab = { id: string; label: string }`. Renders a `<header>`, a `role="tablist"` nav and a
`role="tabpanel"` main area. Handles the print button and the print stylesheet.

## NumberBand
```tsx
<NumberBand label={string} valueMinor={number} unit={string} locale={string} hint?={string} />
```
One big figure, `aria-live="polite"`, tabular numbers. Used for `leftToday` first on screen.

## JournalTable
```tsx
<JournalTable records={readonly JournalRecord[]} locale={Locale} limit?={number} />
```
Newest first. Columns: date, note, kind (translated), amount (sum of postings per entry is zero,
so it shows the first debit amount), hash prefix. Empty state uses `t(locale, "journal.empty")`.

## ImportWizard
```tsx
<ImportWizard unit={string} accountId={string} debitAccountId={string} creditAccountId={string}
              locale={Locale} existingEvidence={readonly string[]}
              idFactory={(index: number) => string}
              onImported={(entries: readonly Entry[], rejected: number, duplicates: number) => void} />
```
Three steps in one card: choose a file → shows the detection (encoding, separator, decimal, date
format) with a confirm button → imports and reports counts. Uses `decode`, `detectCsv`,
`importStatement` from `@ledger/core`. Never imports before the confirm click (LED-F-09).

## EnvelopeBoard
```tsx
<EnvelopeBoard report={Extract<Report, { kind: "envelopes" }>} locale={Locale} />
```
Table: label, budget, spent, carried, available, left today. Never colours alone: the negative
difference carries a minus sign and the word "over".

## ReportViews
```tsx
<ReportViews report={Extract<Report, { kind: "trial-balance" | "income-statement" }>} locale={Locale} />
```
Table with debit / credit / balance columns and a totals row; the balance total must be displayed
so that a reader can see `Σ debit = Σ credit`.

## AuditTrace
```tsx
<AuditTrace report={Extract<Report, { kind: "audit-trail" }>} locale={Locale} />
```
Head hash in a `<code>` block with a copy button, then the rows (seq, date, note, kind, hash prefix).

## i18n
`t(locale, key, values?)` with `MessageKey` union. Adding a language is adding one dictionary in
`packages/ui/src/i18n.ts` (LED-N-08).

## Style rules
- system fonts only, no web font, no CSS framework;
- colour never carries information alone;
- `font-variant-numeric: tabular-nums` on every figure;
- everything must survive print (`@media print` already hides tabs and buttons).

## EntryForm (added 13 November)

```tsx
import { EntryForm } from "@ledger/ui";
import type { Entry } from "@ledger/core";

<EntryForm
  accounts={readonly { id: string; label: string; type: string }[]}   // chart.accounts
  unit={"EUR"}
  locale={Locale}
  idFactory={() => string}                                             // one id per entry
  onCreate={(entry: Entry) => void}                                    // the app appends it
  error={string | null}                                                // message from the core
/>
```

Two postings at least, one amount field, a date, a note, a debit account and a credit account.
The **sum is shown live** (`Σ = 0` required) and the form refuses to submit otherwise. When `error`
is set, the message is displayed with `role="alert"` — the sentence comes from the core
(`describeError`), never a raw code.

## PublicPage (added 13 November)

```ts
import { publicPage } from "@ledger/ui";

const html = publicPage({
  title: "Annual report of the fund",
  journal: redactedJournal,
  period: "2026",
  unit: "EUR",
  locale: "en",
  note: "What this chain proves — and what it does not prove.",   // printed under the table
});
```

Returns a **standalone HTML document**: inline CSS, no script, no external resource, no font.
It contains the table of entries, the head hash, the period totals, and the `note` paragraph.
The output is what a donor can save, print or host as a single file.

## errorSentence (added 13 November)

```ts
import { errorSentence } from "@ledger/ui";
errorSentence("UnbalancedEntry", { sum: -40 })  // → "This entry does not sum to zero. The postings sum to -40, not zero."
```
Built on `describeError` from `@ledger/core`, translated in the UI dictionary when a key exists,
English sentence otherwise.

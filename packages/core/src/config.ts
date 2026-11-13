/** The five extension points, and the one file each application writes. */
import { defineChart, type AccountInput, type Chart } from "./chart.js";
import { defineRules, type RuleInput, type RuleSet } from "./rules.js";
import { defineEnvelopes, type EnvelopeInput, type EnvelopeSet } from "./envelopes.js";
import type { Unit, ViewName } from "./schema.js";
import { deepFreeze, LedgerError } from "./journal.js";

export type Theme = "warm-paper" | "ink-paper" | "plain";
export type Locale = "en" | "fr";

export interface PresentationInput {
  theme: Theme;
  locale: Locale;
  columns?: readonly string[];
  printTitle?: string;
}

export interface Presentation extends PresentationInput {
  readonly columns: readonly string[];
  readonly printTitle: string;
}

/** Extension point #5: how the ledger looks and speaks. */
export function definePresentation(input: PresentationInput): Presentation {
  return deepFreeze({
    ...input,
    columns: input.columns ?? ["date", "note", "amount"],
    printTitle: input.printTitle ?? "Ledger report",
  });
}

/** Extension point #4: which reports are published, and nothing else. */
export function defineReports(names: readonly ViewName[]): readonly ViewName[] {
  if (names.length === 0) throw new LedgerError("NotBalanced", "an application must declare at least one report");
  return deepFreeze([...new Set(names)]);
}

export interface LedgerInput {
  name: string;
  locale: Locale;
  unit: Unit;
  chart: readonly AccountInput[];
  rules?: readonly RuleInput[];
  envelopes?: readonly EnvelopeInput[];
  reports: readonly ViewName[];
  presentation: PresentationInput;
}

export interface LedgerApp {
  readonly name: string;
  readonly locale: Locale;
  readonly unit: Unit;
  readonly chart: Chart;
  readonly rules: RuleSet;
  readonly envelopes: EnvelopeSet;
  readonly reports: readonly ViewName[];
  readonly presentation: Presentation;
}

/** The single entry point an application uses. Every point is honoured, none is bypassed. */
export function defineLedger(input: LedgerInput): LedgerApp {
  return deepFreeze({
    name: input.name,
    locale: input.locale,
    unit: input.unit,
    chart: defineChart(input.chart),
    rules: defineRules(input.rules ?? []),
    envelopes: defineEnvelopes(input.envelopes ?? []),
    reports: defineReports(input.reports),
    presentation: definePresentation(input.presentation),
  });
}

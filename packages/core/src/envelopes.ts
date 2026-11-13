/** Envelopes: a monthly budget per account, with an explicit rollover rule.
 *
 * Law (cahier H.5.5): available(p) = budget + carriedIn(p) - spent(p), where
 * carriedIn(p) is the previous period's available run through `rollover`
 * (`none` drops it, `carry` keeps the surplus only, `carry-deficit` also
 * carries a deficit), then bounded by `capMinor`. The chain is anchored on the
 * oldest period known to the set: carriedIn there is zero, so nothing is
 * invented before the books start.
 *
 * Every amount is a signed minor-unit integer. No clock, no randomness.
 */
import { Envelope as EnvelopeSchema } from "./schema.js";
import type { Envelope, Journal, Report } from "./schema.js";
import type { Chart } from "./chart.js";
import { deepFreeze } from "./journal.js";

export type EnvelopeInput = Omit<Envelope, "rollover" | "capMinor"> &
  Partial<Pick<Envelope, "rollover" | "capMinor">>;

export interface EnvelopeSet {
  readonly envelopes: readonly Envelope[];
  get(id: string): Envelope | undefined;
  /** Envelopes active in `period`: declared in that period or in an earlier one. */
  forPeriod(period: string): readonly Envelope[];
}

export interface EnvelopeOptions {
  period: string;
  daysLeft: number;
  committedMinor?: number;
  reserveMinor?: number;
}

/** How far back a carry chain may walk from a query: 100 years. */
const MAX_MONTHS = 1200;

const monthIndex = (period: string): number =>
  Number(period.slice(0, 4)) * 12 + Number(period.slice(5, 7)) - 1;

const atIndex = (index: number): string =>
  `${String(Math.floor(index / 12)).padStart(4, "0")}-${String((index % 12) + 1).padStart(2, "0")}`;

/** The rollover itself: what survives from one period to the next. */
function rollover(env: Envelope, available: number): number {
  const base = env.rollover === "none" ? 0 : env.rollover === "carry" ? Math.max(0, available) : available;
  if (env.capMinor === null || env.capMinor === 0) return base;
  return Math.min(base, env.capMinor);
}

/** Consumption on the account and its direct children, positive when money is used up.
 *
 * Postings carry signed minor units, so consumption is the *increase of the
 * account's normal balance*: `+sum` on a debit-normal account (an expense, in
 * this chart) and `-sum` on a credit-normal one — which is the `-sum` of H.5.5
 * when expenses are booked negated.
 */
function spentIn(journal: Journal, chart: Chart, env: Envelope, period: string): number {
  const ids = new Set<string>([env.accountId, ...chart.children(env.accountId).map((a) => a.id)]);
  const sign = chart.get(env.accountId)?.normalBalance === "credit" ? -1 : 1;
  let total = 0;
  for (const record of journal.records) {
    if (!record.date.startsWith(period)) continue;
    for (const posting of record.postings) {
      if (posting.unit !== env.unit) continue;
      if (ids.has(posting.accountId)) total += posting.amountMinor;
    }
  }
  return sign * total;
}

function requireEnvelope(set: EnvelopeSet, id: string): Envelope {
  const env = set.get(id);
  if (!env) throw new Error(`unknown envelope ${id}`);
  return env;
}

/** Oldest period the set knows; the chain starts there. */
function anchorOf(set: EnvelopeSet): string | null {
  const periods = set.envelopes.map((e) => e.period).sort();
  return periods[0] ?? null;
}

export function defineEnvelopes(inputs: readonly EnvelopeInput[]): EnvelopeSet {
  const byId = new Map<string, Envelope>();
  const envelopes = inputs.map((input) => {
    const env = deepFreeze(EnvelopeSchema.parse(input));
    if (byId.has(env.id)) throw new Error(`envelope ${env.id} is declared twice`);
    byId.set(env.id, env);
    return env;
  });
  const frozen = Object.freeze(envelopes);
  const set: EnvelopeSet = {
    envelopes: frozen,
    get: (id: string) => byId.get(id),
    forPeriod: (period: string) => frozen.filter((e) => e.period <= period),
  };
  return Object.freeze(set);
}

/** Report from the previous period, per the rollover rule and the cap. */
export function carriedIn(journal: Journal, chart: Chart, set: EnvelopeSet, envelopeId: string, period: string): number {
  const env = requireEnvelope(set, envelopeId);
  const anchor = anchorOf(set);
  if (anchor === null) return 0;
  const start = monthIndex(anchor);
  const end = monthIndex(period);
  if (end <= start) return 0;
  if (end - start > MAX_MONTHS) throw new Error(`period ${period} is too far from ${anchor}`);
  let available = env.budgetMinor - spentIn(journal, chart, env, anchor);
  let carried = 0;
  for (let index = start + 1; index < end; index++) {
    carried = rollover(env, available);
    available = env.budgetMinor + carried - spentIn(journal, chart, env, atIndex(index));
  }
  return rollover(env, available);
}

export function availableMinor(journal: Journal, chart: Chart, set: EnvelopeSet, envelopeId: string, period: string): number {
  const env = requireEnvelope(set, envelopeId);
  const carried = carriedIn(journal, chart, set, envelopeId, period);
  return env.budgetMinor + carried - spentIn(journal, chart, env, period);
}

/** One day's share of the free money: never negative, zero when the month is over. */
function perDay(amount: number, daysLeft: number): number {
  const days = Math.floor(daysLeft);
  if (days <= 0) return 0;
  return Math.floor(amount / days);
}

function dailyAvailable(journal: Journal, chart: Chart, set: EnvelopeSet, period: string): number {
  let total = 0;
  for (const env of set.forPeriod(period)) {
    if (chart.get(env.accountId)?.daily !== true) continue;
    total += availableMinor(journal, chart, set, env.id, period);
  }
  return total;
}

export function leftTodayMinor(journal: Journal, chart: Chart, set: EnvelopeSet, options: EnvelopeOptions): number {
  const days = Math.floor(options.daysLeft);
  if (days <= 0) return 0;
  const free = dailyAvailable(journal, chart, set, options.period)
    - (options.committedMinor ?? 0)
    - (options.reserveMinor ?? 0);
  return Math.max(0, perDay(free, days));
}

/** The unit the report speaks: that of the period's envelopes, else the set's first. */
function unitOf(set: EnvelopeSet, period: string): string {
  return (set.forPeriod(period)[0] ?? set.envelopes[0])?.unit ?? "EUR";
}

export function envelopeReport(
  journal: Journal, chart: Chart, set: EnvelopeSet, options: EnvelopeOptions,
): Extract<Report, { kind: "envelopes" }> {
  const rows = set.forPeriod(options.period).map((env) => {
    const carriedMinor = carriedIn(journal, chart, set, env.id, options.period);
    const spentMinor = spentIn(journal, chart, env, options.period);
    const available = env.budgetMinor + carriedMinor - spentMinor;
    const daily = chart.get(env.accountId)?.daily === true;
    return {
      envelopeId: env.id, label: env.label, budgetMinor: env.budgetMinor, spentMinor,
      carriedMinor, availableMinor: available, leftTodayMinor: daily ? perDay(available, options.daysLeft) : 0,
    };
  });
  return {
    kind: "envelopes" as const,
    period: options.period,
    unit: unitOf(set, options.period),
    totalLeftTodayMinor: leftTodayMinor(journal, chart, set, options),
    daysLeft: Math.max(0, Math.floor(options.daysLeft)),
    rows,
  };
}
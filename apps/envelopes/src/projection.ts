/** La projection de fin de mois : une fourchette de deux chiffres, jamais une valeur unique (LED-F-17). */
import type { Journal } from "@ledger/core";

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
/** Mois d'historique sur lesquels la fourchette se construit. */
export const HISTORY = 3;

export interface Projection {
  readonly periods: readonly string[]; readonly medianMinor: number; readonly spreadMinor: number;
  readonly lowMinor: number; readonly highMinor: number;
}

export function daysInMonth(period: string): number {
  const year = Number(period.slice(0, 4)), month = Number(period.slice(5, 7));
  const leap = month === 2 && year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return leap ? 29 : (MONTH_DAYS[month - 1] ?? 30);
}

export function daysLeftIn(period: string, today: string): number {
  if (today.startsWith(period)) return Math.max(0, daysInMonth(period) - Number(today.slice(8, 10)));
  return today < `${period}-01` ? daysInMonth(period) : 0;
}

/** Les `count` mois qui finissent par `period`, du plus ancien au plus récent. */
const monthsEnding = (period: string, count: number): string[] => {
  const end = Number(period.slice(0, 4)) * 12 + Number(period.slice(5, 7)) - 1;
  return Array.from({ length: count }, (_, step) => {
    const at = end - count + 1 + step;
    return `${String(Math.floor(at / 12)).padStart(4, "0")}-${String((at % 12) + 1).padStart(2, "0")}`;
  });
};

function spendByMonth(journal: Journal, period: string, today: string, ids: ReadonlySet<string>): Map<string, number> {
  const spent = new Map<string, number>();
  for (const record of journal.records) {
    const month = record.date.slice(0, 7);
    for (const posting of record.postings) if (ids.has(posting.accountId)) spent.set(month, (spent.get(month) ?? 0) + posting.amountMinor);
  }
  const elapsed = today.startsWith(period) ? Number(today.slice(8, 10)) : 0;
  const running = spent.get(period) ?? 0;
  if (elapsed > 0 && running !== 0) spent.set(period, Math.round((running * daysInMonth(period)) / elapsed));
  return spent;
}

/** Médiane et demi-écart : où le mois devrait finir, en fourchette (LED-F-17). */
export function projection(journal: Journal, period: string, today: string, accountIds: readonly string[]): Projection {
  const spent = spendByMonth(journal, period, today, new Set(accountIds));
  const rows = monthsEnding(period, HISTORY).flatMap((month) => {
    const total = spent.get(month);
    return total === undefined || total === 0 ? [] : [{ period: month, spentMinor: total }];
  });
  const values = rows.map((row) => row.spentMinor).sort((left, right) => left - right);
  const low = values[0] ?? 0, high = values.at(-1) ?? 0;
  return {
    periods: rows.map((row) => row.period), lowMinor: low, highMinor: high,
    medianMinor: values.length === 0 ? 0 : values[Math.floor((values.length - 1) / 2)] ?? 0,
    spreadMinor: Math.round((high - low) / 2),
  };
}

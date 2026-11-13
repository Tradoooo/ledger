/** The printable annual report (LED-F-23): one line per month, totals spelled out, A4. */
import type { Chart, Journal } from "@ledger/core";

export interface MonthRow {
  month: string;
  entries: number;
  inMinor: number;
  outMinor: number;
  balanceMinor: number;
}

/** One line per month: what came in, what went out, and what it leaves in the fund. */
export function monthlyRows(journal: Journal, chart: Chart, from: string, to: string): MonthRow[] {
  const byMonth = new Map<string, MonthRow>();
  for (const record of journal.records) {
    if (record.date < from || record.date > to) continue;
    const month = record.date.slice(0, 7);
    const row = byMonth.get(month) ?? { month, entries: 0, inMinor: 0, outMinor: 0, balanceMinor: 0 };
    row.entries += 1;
    for (const posting of record.postings) {
      const account = chart.get(posting.accountId);
      if (account === undefined) continue;
      if (account.type === "income") row.inMinor -= posting.amountMinor;
      if (account.type === "expense") row.outMinor += posting.amountMinor;
    }
    byMonth.set(month, row);
  }
  const rows = [...byMonth.values()].sort((left, right) => left.month.localeCompare(right.month));
  let balance = 0;
  for (const row of rows) {
    balance += row.inMinor - row.outMinor;
    row.balanceMinor = balance;
  }
  return rows;
}

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const SCALES: readonly (readonly [string, number])[] = [["thousand", 1_000], ["million", 1_000_000], ["billion", 1_000_000_000]];

/** An integer, in english words: readable without colour, without a column of digits. */
export function intWords(value: number): string {
  const abs = Math.abs(Math.trunc(value));
  const rest = abs % 100;
  const tail = rest === 0 ? "" : rest < 20 ? ONES[rest] ?? "" : `${TENS[Math.floor(rest / 10)]}${rest % 10 === 0 ? "" : `-${ONES[rest % 10]}`}`;
  const head = abs >= 1000 ? "" : abs >= 100 ? `${ONES[Math.floor(abs / 100)]} hundred` : "";
  const below = [head, tail].filter((part) => part.length > 0).join(" ");
  for (let index = SCALES.length - 1; index >= 0; index -= 1) {
    const [name, size] = SCALES[index]!;
    if (abs < size) continue;
    const times = Math.floor(abs / size);
    const remainder = abs % size;
    return [intWords(times), name, remainder === 0 ? "" : intWords(remainder)].filter((part) => part.length > 0).join(" ");
  }
  return below;
}

/** The same figure, spelled out: "two thousand three hundred euros and fifty cents". */
export function moneyWords(amountMinor: number, unit = "EUR"): string {
  const abs = Math.abs(Math.trunc(amountMinor));
  const whole = Math.floor(abs / 100);
  const cents = abs % 100;
  const name = unit === "EUR" ? "euro" : unit;
  const rest = cents === 0 ? "" : ` and ${intWords(cents)} cent${cents === 1 ? "" : "s"}`;
  return `${amountMinor < 0 ? "minus " : ""}${intWords(whole)} ${name}${whole === 1 ? "" : "s"}${rest}`;
}

/** A4, black on white, the head hash repeated in the page footer. */
export const PRINT_CSS = [
  "@page { size: A4 portrait; margin: 14mm; }",
  ".ma-report { color: #000; background: #fff; } .ma-report h1 { font-size: 1.3rem; }",
  ".ma-report table { width: 100%; border-collapse: collapse; }",
  ".ma-report th, .ma-report td { border-bottom: 1px solid #000; padding: 2mm 1mm; text-align: left; }",
  ".ma-report .num { text-align: right; font-variant-numeric: tabular-nums; }",
  ".ma-report tfoot td { font-weight: bold; border-top: 2px solid #000; } .ma-report .words { font-style: italic; }",
  "@media print { .ma-footer { position: fixed; bottom: 0; left: 0; right: 0; border-top: 1px solid #000; padding-top: 1mm; font-size: 9pt; } .ma-report tr { break-inside: avoid; } }",
].join("\n");

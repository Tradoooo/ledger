/** Hours, not money: the unit of the time bank is a quantity, so it is formatted
 * with the core's own minor-unit scale for this unit code — never as a currency. */
import { minorDigits } from "@ledger/core";
import { UNIT } from "./ledger.config";

/** "3 h" — the hour as a plain number, in the locale of the screen. */
export function hours(minor: number, locale: string): string {
  const scale = 10 ** minorDigits(UNIT);
  const text = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(minor / scale);
  return `${text} h`;
}

/** The month of a date: "2026-03-15" -> "2026-03". */
export function periodOf(date: string): string {
  return date.slice(0, 7);
}

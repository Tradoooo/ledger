/** Units and money formatting. Amounts are always integers in minor units. */

/** ISO 4217 codes whose minor unit is not 2 decimals. Everything else defaults to 2. */
const MINOR_DIGITS: Readonly<Record<string, number>> = Object.freeze({
  JPY: 0, KRW: 0, CLP: 0, ISK: 0, VND: 0,
  BHD: 3, IQD: 3, JOD: 3, KWD: 3, LYD: 3, OMR: 3, TND: 3,
});

/** Minor-unit exponent for a currency or declared quantity code. */
export function minorDigits(code: string): number {
  return MINOR_DIGITS[code] ?? 2;
}

/** Convert a decimal amount to minor units without float drift (e.g. 48.2 -> 4820). */
export function toMinor(amount: number, code: string): number {
  const scale = 10 ** minorDigits(code);
  return Math.round(amount * scale);
}

/** Human-readable amount, e.g. formatMinor(4820, "EUR", "fr") -> "48,20 €". */
export function formatMinor(amountMinor: number, code: string, locale = "en"): string {
  const digits = minorDigits(code);
  return new Intl.NumberFormat(locale, {
    style: "currency", currency: code, minimumFractionDigits: digits, maximumFractionDigits: digits,
  }).format(amountMinor / 10 ** digits);
}

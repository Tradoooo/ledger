import { formatMinor } from "@ledger/core";

export interface NumberBandProps {
  label: string;
  valueMinor: number;
  unit: string;
  locale: string;
  hint?: string;
}

/** The one figure that matters. Nothing else above it, ever (LED-F-16). */
export function NumberBand({ label, valueMinor, unit, locale, hint }: NumberBandProps) {
  return (
    <section className="bb-band" aria-live="polite">
      <p className="bb-band-label">{label}</p>
      <p className="bb-band-value">{formatMinor(valueMinor, unit, locale)}</p>
      {hint ? <p className="bb-band-hint">{hint}</p> : null}
    </section>
  );
}

/** Envelopes: budget, spent, carried, available, left today. One row per envelope. */
import type { Report } from "@ledger/core";
import { formatMinor } from "@ledger/core";
import { t, type Locale } from "./i18n.js";

type EnvelopesReport = Extract<Report, { kind: "envelopes" }>;
type EnvelopeRow = EnvelopesReport["rows"][number];

export interface EnvelopeBoardProps {
  report: EnvelopesReport;
  locale: Locale;
}

/** i18n.ts owns the sentences; the overrun tag has no key yet and travels with the minus sign. */
const OVERRUN_TAG: Record<Locale, string> = { en: "over", fr: "dépassé" };

/** An amount cell. A negative figure carries a minus sign *and* the word, never colour alone. */
function AmountCell({ amountMinor, unit, locale }: { amountMinor: number; unit: string; locale: Locale }) {
  return (
    <td className="num">
      {formatMinor(amountMinor, unit, locale)}
      {amountMinor < 0 ? <span className="bb-pill"> {OVERRUN_TAG[locale]}</span> : null}
    </td>
  );
}

function Row({ row, unit, locale }: { row: EnvelopeRow; unit: string; locale: Locale }) {
  return (
    <tr>
      <td>{row.label}</td>
      <AmountCell amountMinor={row.budgetMinor} unit={unit} locale={locale} />
      <AmountCell amountMinor={row.spentMinor} unit={unit} locale={locale} />
      <AmountCell amountMinor={row.carriedMinor} unit={unit} locale={locale} />
      <AmountCell amountMinor={row.availableMinor} unit={unit} locale={locale} />
      <AmountCell amountMinor={row.leftTodayMinor} unit={unit} locale={locale} />
    </tr>
  );
}

export function EnvelopeBoard({ report, locale }: EnvelopeBoardProps) {
  if (report.rows.length === 0) return <p className="bb-empty">{t(locale, "envelopes.empty")}</p>;
  return (
    <section className="bb-card">
      <h2>{t(locale, "tab.envelopes")}</h2>
      <p>
        {t(locale, "report.period")} <span>{report.period}</span>
        {", "}
        {t(locale, "leftToday")} <span className="num">{report.daysLeft}</span>
      </p>
      <table className="bb-table">
        <thead>
          <tr>
            <th scope="col">{t(locale, "audit.note")}</th>
            <th scope="col" className="num">{t(locale, "report.budget")}</th>
            <th scope="col" className="num">{t(locale, "report.spent")}</th>
            <th scope="col" className="num">{t(locale, "report.carried")}</th>
            <th scope="col" className="num">{t(locale, "report.available")}</th>
            <th scope="col" className="num">{t(locale, "leftToday")}</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row) => (
            <Row key={row.envelopeId} row={row} unit={report.unit} locale={locale} />
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">{t(locale, "report.total")}</th>
            <td className="num" />
            <td className="num" />
            <td className="num" />
            <td className="num" />
            <AmountCell amountMinor={report.totalLeftTodayMinor} unit={report.unit} locale={locale} />
          </tr>
        </tfoot>
      </table>
    </section>
  );
}
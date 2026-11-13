/** Trial balance and income statement: debit / credit / balance, then the totals a reader checks. */
import type { Report } from "@ledger/core";
import { formatMinor } from "@ledger/core";
import { t, type Locale } from "./i18n.js";

type BalancedReport = Extract<Report, { kind: "trial-balance" | "income-statement" }>;
type StatementRow = BalancedReport["rows"][number];

export interface ReportViewsProps {
  report: BalancedReport;
  locale: Locale;
}

interface Sums { debit: number; credit: number; balance: number }

function summed(rows: readonly StatementRow[]): Sums {
  let debit = 0;
  let credit = 0;
  let balance = 0;
  for (const row of rows) {
    debit += row.debit;
    credit += row.credit;
    balance += row.balance;
  }
  return { debit, credit, balance };
}

/** The core computed the totals of a trial balance: never recompute what the core already folded. */
function totalsOf(report: BalancedReport): Sums {
  const sums = summed(report.rows);
  return report.kind === "trial-balance"
    ? { ...sums, debit: report.totals.debit, credit: report.totals.credit }
    : sums;
}

function Period({ report }: { report: BalancedReport }) {
  if (report.kind === "trial-balance") return <time dateTime={report.asOf}>{report.asOf}</time>;
  return (
    <>
      <time dateTime={report.from}>{report.from}</time> <time dateTime={report.to}>{report.to}</time>
    </>
  );
}

export function ReportViews({ report, locale }: ReportViewsProps) {
  const totals = totalsOf(report);
  const unit = report.unit;
  return (
    <section className="bb-card">
      <h2>
        {report.kind === "trial-balance" ? t(locale, "report.balance") : t(locale, "report.net")}{" "}
        <Period report={report} />
      </h2>
      <table className="bb-table">
        <thead>
          <tr>
            <th scope="col">{t(locale, "report.account")}</th>
            <th scope="col" className="num">{t(locale, "report.debit")}</th>
            <th scope="col" className="num">{t(locale, "report.credit")}</th>
            <th scope="col" className="num">{t(locale, "report.balance")}</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row) => (
            <tr key={row.accountId}>
              <td>{row.label}</td>
              <td className="num">{formatMinor(row.debit, unit, locale)}</td>
              <td className="num">{formatMinor(row.credit, unit, locale)}</td>
              <td className="num">{formatMinor(row.balance, unit, locale)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">{t(locale, "report.total")}</th>
            <td className="num">{formatMinor(totals.debit, unit, locale)}</td>
            <td className="num">{formatMinor(totals.credit, unit, locale)}</td>
            <td className="num">{formatMinor(totals.balance, unit, locale)}</td>
          </tr>
          {report.kind === "income-statement" ? (
            <tr>
              <th scope="row">{t(locale, "report.net")}</th>
              <td className="num" />
              <td className="num" />
              <td className="num">{formatMinor(report.netMinor, unit, locale)}</td>
            </tr>
          ) : null}
        </tfoot>
      </table>
    </section>
  );
}
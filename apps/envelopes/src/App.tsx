/** The six screens of « Household envelopes ». Rendering only: the core computes. */
import { useCallback, useMemo, useState } from "react";
import {
  auditTrail, envelopeReport, formatMinor, leftTodayMinor, matchRules, trialBalance, ulidFactory, verifyChain,
} from "@ledger/core";
import type { Entry, Journal } from "@ledger/core";
import {
  AuditTrace, EnvelopeBoard, ImportWizard, JournalTable, NumberBand, ReportViews, Shell, t,
} from "@ledger/ui";
import type { Locale, ShellTab } from "@ledger/ui";
import ledger, { BANK_ACCOUNT, PERIOD, SALARY_ACCOUNT, UNIT, UNASSIGNED_ACCOUNT } from "./ledger.config";
import { journalFrom, loadLedger, saveLedger, todayIso, withEntries } from "./store";
import type { StoredLedger } from "./store";

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function daysInMonth(period: string): number {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7));
  const leap = month === 2 && year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return leap ? 29 : (MONTH_DAYS[month - 1] ?? 30);
}

/** Remaining days of the period; a period not started is counted whole, a closed one is zero. */
function daysLeftIn(period: string, today: string): number {
  const total = daysInMonth(period);
  if (today.startsWith(period)) return Math.max(0, total - Number(today.slice(8, 10)));
  return today < `${period}-01` ? total : 0;
}

/** A rule proposes the account of the unassigned leg; the posting is rewritten here, not by the core. */
function classify(entry: Entry): Entry {
  const leg = entry.postings.find((posting) => posting.accountId === UNASSIGNED_ACCOUNT);
  if (leg === undefined) return entry;
  const match = matchRules(ledger.rules, { memo: entry.note, amountMinor: leg.amountMinor });
  if (match === undefined || match.then.accountId === UNASSIGNED_ACCOUNT) return entry;
  const target = match.then.accountId;
  return { ...entry, postings: entry.postings.map((p) => (p.id === leg.id ? { ...p, accountId: target } : p)) };
}

function envelopeOptions(daysLeft: number) {
  return { period: PERIOD, daysLeft };
}

function Overview({ journal, locale }: { journal: Journal; locale: Locale }) {
  const options = envelopeOptions(daysLeftIn(PERIOD, todayIso()));
  const report = envelopeReport(journal, ledger.chart, ledger.envelopes, options);
  const left = leftTodayMinor(journal, ledger.chart, ledger.envelopes, options);
  return (
    <>
      <NumberBand
        label={t(locale, "leftToday")}
        valueMinor={left}
        unit={UNIT}
        locale={locale}
        hint={t(locale, "leftToday.hint")}
      />
      <section className="env-summary">
        <h2>{t(locale, "tab.envelopes")} — {t(locale, "report.period")} {report.period}</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">{t(locale, "tab.envelopes")}</th>
              <th scope="col">{t(locale, "report.budget")}</th>
              <th scope="col">{t(locale, "report.spent")}</th>
              <th scope="col">{t(locale, "report.available")}</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr key={row.envelopeId}>
                <th scope="row">{row.label}</th>
                <td>{formatMinor(row.budgetMinor, report.unit, locale)}</td>
                <td>{formatMinor(row.spentMinor, report.unit, locale)}</td>
                <td>{formatMinor(row.availableMinor, report.unit, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {report.rows.length === 0 ? <p>{t(locale, "envelopes.empty")}</p> : null}
        <p className="env-summary-meta">
          {t(locale, "leftToday")} · {report.daysLeft} jour(s) restant(s) sur {daysInMonth(PERIOD)}.
        </p>
      </section>
    </>
  );
}

function Envelopes({ journal, locale }: { journal: Journal; locale: Locale }) {
  const report = envelopeReport(journal, ledger.chart, ledger.envelopes, envelopeOptions(daysLeftIn(PERIOD, todayIso())));
  return <EnvelopeBoard report={report} locale={locale} />;
}

function JournalScreen({ journal, locale }: { journal: Journal; locale: Locale }) {
  return <JournalTable records={journal.records} locale={locale} limit={100} />;
}

function ImportScreen({ journal, onImported, locale }: {
  journal: Journal; onImported: (entries: readonly Entry[]) => void; locale: Locale;
}) {
  const evidence = useMemo(
    () => journal.records.flatMap((record) => record.postings.flatMap((posting) => posting.evidence ?? [])),
    [journal],
  );
  const factory = useMemo(
    () => ulidFactory(() => Date.now(), () => crypto.getRandomValues(new Uint8Array(10))),
    [],
  );
  const idFactory = useCallback(() => factory(), [factory]);
  return (
    <ImportWizard
      unit={UNIT}
      accountId={BANK_ACCOUNT}
      debitAccountId={UNASSIGNED_ACCOUNT}
      creditAccountId={SALARY_ACCOUNT}
      locale={locale}
      existingEvidence={evidence}
      idFactory={idFactory}
      onImported={(entries) => onImported(entries)}
    />
  );
}

/** The date window the reports fold on: what the journal actually contains, else the period. */
function windowOf(journal: Journal): { from: string; to: string } {
  const dates = journal.records.map((record) => record.date).sort();
  const from = dates[0] ?? `${PERIOD}-01`;
  return { from, to: dates.at(-1) ?? from };
}

function ReportsScreen({ journal, locale }: { journal: Journal; locale: Locale }) {
  const { to } = windowOf(journal);
  const report = useMemo(() => trialBalance(journal, ledger.chart, { asOf: to, unit: UNIT }), [journal, to]);
  return <ReportViews report={report} locale={locale} />;
}

function AuditScreen({ journal, locale }: { journal: Journal; locale: Locale }) {
  const { from, to } = windowOf(journal);
  const report = useMemo(() => auditTrail(journal, { from, to }), [journal, from, to]);
  const check = useMemo(() => verifyChain(journal), [journal]);
  return (
    <>
      <AuditTrace report={report} locale={locale} />
      <p className="audit-chain">
        {check.ok
          ? `Chaîne d'empreintes vérifiée : ${journal.records.length} écriture(s).`
          : `Chaîne rompue à l'écriture n°${check.index + 1}.`}
      </p>
    </>
  );
}

export function App() {
  const [stored, setStored] = useState<StoredLedger>(() => loadLedger());
  const [tab, setTab] = useState("overview");
  const locale: Locale = ledger.locale;
  const journal = useMemo(() => journalFrom(stored), [stored]);
  const onImported = useCallback((entries: readonly Entry[]) => {
    const next = withEntries(stored, entries.map(classify));
    saveLedger(next);
    setStored(next);
  }, [stored]);
  const tabs: ShellTab[] = [
    { id: "overview", label: t(locale, "tab.overview") },
    { id: "envelopes", label: t(locale, "tab.envelopes") },
    { id: "journal", label: t(locale, "tab.journal") },
    { id: "import", label: t(locale, "tab.import") },
    { id: "reports", label: t(locale, "tab.reports") },
    { id: "audit", label: t(locale, "tab.audit") },
  ];
  return (
    <Shell
      title={ledger.name}
      subtitle={`${t(locale, "report.period")} ${PERIOD} · ${formatMinor(journal.records.length, "EUR", locale).length > 0 ? "" : ""}`}
      locale={locale}
      tabs={tabs}
      activeTab={tab}
      onTab={setTab}
    >
      {tab === "overview" ? <Overview journal={journal} locale={locale} /> : null}
      {tab === "envelopes" ? <Envelopes journal={journal} locale={locale} /> : null}
      {tab === "journal" ? <JournalScreen journal={journal} locale={locale} /> : null}
      {tab === "import" ? <ImportScreen journal={journal} onImported={onImported} locale={locale} /> : null}
      {tab === "reports" ? <ReportsScreen journal={journal} locale={locale} /> : null}
      {tab === "audit" ? <AuditScreen journal={journal} locale={locale} /> : null}
    </Shell>
  );
}
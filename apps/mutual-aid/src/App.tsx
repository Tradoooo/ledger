/** Four screens: what came in, the raw journal, what is published, and the chain itself. */
import { useState, type ReactNode } from "react";
import { auditTrail, formatMinor, verifyChain } from "@ledger/core";
import type { JournalRecord } from "@ledger/core";
import { AuditTrace, JournalTable, NumberBand, Shell, t } from "@ledger/ui";
import type { ShellTab } from "@ledger/ui";
import { FUND_END, FUND_START, UNIT, mutualAid } from "./ledger.config.js";
import { demoJournal, fundTotals, lastDonationIndex } from "./store.js";
import { auditPublic, publicJournal, publishLink, verifyReceipt } from "./publish.js";

const TABS: readonly ShellTab[] = [
  { id: "fund", label: "Fund" },
  { id: "ledger", label: "Ledger" },
  { id: "publish", label: "Publish" },
  { id: "audit", label: "Audit" },
];

const LOCALE = mutualAid.locale;

/** Computed once: the public twin of the journal above. */
const PUBLISHED = publicJournal(demoJournal);

const money = (amountMinor: number): string => formatMinor(amountMinor, UNIT, LOCALE);

function FundTab(): ReactNode {
  const totals = fundTotals(demoJournal, mutualAid.chart);
  return (
    <>
      <div className="bb-grid-2">
        <NumberBand
          label="Total collected"
          valueMinor={totals.collectedMinor}
          unit={UNIT}
          locale={LOCALE}
          hint="Every donation received since January, in full."
        />
        <NumberBand
          label="Total granted"
          valueMinor={totals.grantedMinor}
          unit={UNIT}
          locale={LOCALE}
          hint="Every euro paid out to a household. Nothing is held back."
        />
      </div>
      <section className="bb-card">
        <h2>Last 10 entries</h2>
        <JournalTable records={demoJournal.records} locale={LOCALE} limit={10} />
      </section>
    </>
  );
}

function LedgerTab(): ReactNode {
  const count = demoJournal.records.length;
  return (
    <section className="bb-card">
      <h2>
        {t(LOCALE, "journal.title")} — {t(LOCALE, "journal.entries", { count })}
      </h2>
      <JournalTable records={demoJournal.records} locale={LOCALE} />
    </section>
  );
}

interface CardProps {
  title: string;
  record: JournalRecord;
}

/** One entry, shown exactly as it stands: what the fund keeps, then what it hands out. */
function EntryCard({ title, record }: CardProps): ReactNode {
  return (
    <article className="bb-card">
      <h2>{title}</h2>
      <table className="bb-table">
        <thead>
          <tr>
            <th>#{record.seq}</th>
            <th>Account</th>
            <th className="num">Amount</th>
            <th>Party</th>
            <th>Evidence</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{record.date}</td>
            <td colSpan={4}>{record.note}</td>
          </tr>
          {record.postings.map((posting) => (
            <tr key={posting.id}>
              <td />
              <td>{posting.accountId}</td>
              <td className="num">{money(posting.amountMinor)}</td>
              <td>{posting.party === undefined ? "—" : posting.party.label}</td>
              <td>{posting.evidence === undefined ? "—" : posting.evidence.join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="bb-empty">
        hash <code>{record.hash.slice(0, 16)}</code>
      </p>
    </article>
  );
}

function PublishLinkBox(): ReactNode {
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const publish = (): void => {
    publishLink(FUND_START, FUND_END)
      .then((fragment) => setLink(fragment))
      .catch((reason: unknown) => setError(String(reason)));
  };
  return (
    <section className="bb-card">
      <h2>The public page</h2>
      <p>The fragment carries a question, not the data: the reader recomputes it from the chain.</p>
      <button className="bb-btn" type="button" onClick={publish}>
        Publish
      </button>
      {link === null ? null : (
        <p>
          <a href={link}>
            <code>{link}</code>
          </a>
        </p>
      )}
      {error === null ? null : <p className="bb-error">{error}</p>}
    </section>
  );
}

function ReceiptBox(): ReactNode {
  const last = demoJournal.records.at(-1);
  const [entryId, setEntryId] = useState(last?.id ?? "");
  const [hash, setHash] = useState(last?.hash ?? "");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  return (
    <section className="bb-card">
      <h2>{t(LOCALE, "publish.check")}</h2>
      <p>
        <label>
          Entry id <input size={30} value={entryId} onChange={(event) => setEntryId(event.target.value)} />
        </label>
      </p>
      <p>
        <label>
          Hash <input size={68} value={hash} onChange={(event) => setHash(event.target.value)} />
        </label>
      </p>
      <button className="bb-btn" type="button" onClick={() => setResult(verifyReceipt(demoJournal, entryId, hash))}>
        Verify
      </button>
      {result === null ? null : <p className={result.ok ? "" : "bb-error"}>{result.message}</p>}
    </section>
  );
}

/** The page a donor gets: months, exact amounts, pseudonyms, no free text. */
function PublicLedgerTable({ records }: { records: readonly JournalRecord[] }): ReactNode {
  const shown = records.slice(-6).reverse();
  return (
    <section className="bb-card">
      <h2>
        What a donor sees — 6 of {records.length}
      </h2>
      <table className="bb-table">
        <thead>
          <tr>
            <th>Month</th>
            <th>Note</th>
            <th>Account</th>
            <th className="num">Amount</th>
            <th>Hash</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((record) => (
            <tr key={record.id}>
              <td>{record.date}</td>
              <td>{record.note}</td>
              <td>{record.postings.map((posting) => posting.accountId).join(" / ")}</td>
              <td className="num">{money(record.postings[0]?.amountMinor ?? 0)}</td>
              <td>
                <code>{record.hash.slice(0, 10)}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function PublishTab(): ReactNode {
  const index = lastDonationIndex(demoJournal);
  const kept = demoJournal.records[index];
  const shown = PUBLISHED.records[index];
  if (kept === undefined || shown === undefined) return <p className="bb-empty">Nothing to publish.</p>;
  const findings = auditPublic(demoJournal, PUBLISHED);
  return (
    <>
      <section className="bb-card">
        <h2>{t(LOCALE, "publish.title")}</h2>
        <div className="bb-grid-2">
          <EntryCard title={t(LOCALE, "publish.side")} record={kept} />
          <EntryCard title={t(LOCALE, "publish.public")} record={shown} />
        </div>
        <p className={findings.length === 0 ? "" : "bb-error"}>
          {findings.length === 0
            ? "Audit of the published entries: no party id, no evidence, no note. Nothing private got through."
            : findings.join(" · ")}
        </p>
      </section>
      <PublishLinkBox />
      <PublicLedgerTable records={PUBLISHED.records} />
      <ReceiptBox />
    </>
  );
}

function AuditTab(): ReactNode {
  const report = auditTrail(demoJournal, { from: FUND_START, to: FUND_END });
  const chain = verifyChain(demoJournal);
  return (
    <>
      <section className="bb-card">
        <h2>{t(LOCALE, "audit.title")}</h2>
        <p className={chain.ok ? "bb-pill" : "bb-error"}>
          {chain.ok
            ? `${demoJournal.records.length} records, one unbroken chain.`
            : `Broken at #${chain.index}: ${chain.reason}.`}
        </p>
        <p>
          {t(LOCALE, "audit.head")} <code>{report.headHash}</code>
        </p>
      </section>
      <AuditTrace report={report} locale={LOCALE} />
    </>
  );
}

function panel(tab: string): ReactNode {
  switch (tab) {
    case "ledger":
      return <LedgerTab />;
    case "publish":
      return <PublishTab />;
    case "audit":
      return <AuditTab />;
    default:
      return <FundTab />;
  }
}

export function App(): ReactNode {
  const [tab, setTab] = useState("fund");
  return (
    <Shell
      theme={"ink-paper"}
      title={mutualAid.name}
      subtitle="Public by default: every entry is hashed, every euro is traceable."
      locale={LOCALE}
      tabs={TABS}
      activeTab={tab}
      onTab={setTab}
    >
      {panel(tab)}
    </Shell>
  );
}
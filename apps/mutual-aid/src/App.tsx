/** Five screens: what came in, the journal, what is published, the annual report, the chain. */
import { useMemo, useState, type ReactNode } from "react";
import { LedgerError, append, auditTrail, formatMinor, headHash, verifyChain } from "@ledger/core";
import type { Entry, Journal, JournalRecord } from "@ledger/core";
import { AuditTrace, EntryForm, JournalTable, NumberBand, Shell, browserUlidFactory, errorSentence, publicPage, t } from "@ledger/ui";
import type { ShellTab } from "@ledger/ui";
import { FUND_END, FUND_START, PERIOD, UNIT, mutualAid } from "./ledger.config.js";
import { demoJournal, fundTotals, lastDonationIndex } from "./store.js";
import { auditPublic, publicJournal, verifyReceipt, type ReceiptResult } from "./publish.js";
import { DOES_NOT_PROVE, LIMITS_NOTE, PROVES, WHY_AN_ARGUMENT } from "./limits.js";
import { PRINT_CSS, moneyWords, monthlyRows } from "./report.js";

const TABS: readonly ShellTab[] = [
  { id: "fund", label: "Fund" },
  { id: "ledger", label: "Ledger" },
  { id: "publish", label: "Publish" },
  { id: "report", label: "Annual report" },
  { id: "audit", label: "Audit" },
];

const LOCALE = mutualAid.locale;
const money = (amountMinor: number): string => formatMinor(amountMinor, UNIT, LOCALE);

/** A donation credits income, an aid debits an aid account: two short lists, debit first. */
const KINDS = {
  donation: {
    label: "Donation",
    hint: "Money in: the bank is debited, the income account credited.",
    accounts: ["assets:bank:fund", "income:donations", "assets:cash", "income:grants"],
  },
  aid: {
    label: "Aid",
    hint: "Money out: the aid account is debited, the bank credited.",
    accounts: ["expenses:aid:food", "assets:bank:fund", "expenses:aid:rent", "expenses:aid:school", "expenses:aid:energy"],
  },
} as const;

type Kind = keyof typeof KINDS;

function Bullets({ title, lines }: { title: string; lines: readonly string[] }): ReactNode {
  return (
    <div>
      <h3>{title}</h3>
      <ul>{lines.map((line) => <li key={line}>{line}</li>)}</ul>
    </div>
  );
}

interface FundProps { journal: Journal; idFactory: () => string; onCreate: (entry: Entry) => void; error: string | null; notice: string | null }

/** Manual entry: a donation or an aid, appended to the chain as it is typed. */
function FundTab({ journal, idFactory, onCreate, error, notice }: FundProps): ReactNode {
  const [kind, setKind] = useState<Kind>("donation");
  const totals = fundTotals(journal, mutualAid.chart);
  const accounts = KINDS[kind].accounts.map((id) => {
    const account = mutualAid.chart.get(id);
    return { id, label: account?.label ?? id, type: account?.type ?? "" };
  });
  return (
    <>
      <div className="bb-grid-2">
        <NumberBand label="Total collected" valueMinor={totals.collectedMinor} unit={UNIT} locale={LOCALE} hint="Every donation received since January, in full." />
        <NumberBand label="Total granted" valueMinor={totals.grantedMinor} unit={UNIT} locale={LOCALE} hint="Every euro paid out to a household. Nothing is held back." />
      </div>
      <section className="bb-card">
        <h2>Record a donation or an aid</h2>
        <p>
          {KINDS[kind].hint} Then the date of the operation, the amount, a note, and the two accounts.
          The entry is hashed and chained when it is saved: nothing is ever edited afterwards.
        </p>
        <p>
          {(Object.keys(KINDS) as Kind[]).map((id) => (
            <button key={id} className="bb-btn" type="button" aria-pressed={kind === id} onClick={() => setKind(id)}>{KINDS[id].label}</button>
          ))}
        </p>
        {notice === null ? null : <p className="bb-pill" role="status">{notice}</p>}
      </section>
      <EntryForm key={kind} accounts={accounts} unit={UNIT} locale={LOCALE} idFactory={idFactory} onCreate={onCreate} error={error} />
      <section className="bb-card">
        <h2>Last 10 entries</h2>
        <JournalTable records={journal.records} locale={LOCALE} limit={10} />
      </section>
    </>
  );
}

function LedgerTab({ journal }: { journal: Journal }): ReactNode {
  return (
    <section className="bb-card">
      <h2>{t(LOCALE, "journal.title")} — {t(LOCALE, "journal.entries", { count: journal.records.length })}</h2>
      <JournalTable records={journal.records} locale={LOCALE} />
    </section>
  );
}

/** One entry, shown exactly as it stands: what the fund keeps, set beside what it publishes. */
function EntryTwin({ title, record }: { title: string; record: JournalRecord }): ReactNode {
  return (
    <article className="bb-card">
      <h2>{title}</h2>
      <table className="bb-table">
        <thead><tr><th>#{record.seq}</th><th>Account</th><th className="num">Amount</th><th>Party</th><th>Evidence</th></tr></thead>
        <tbody>
          <tr><td>{record.date}</td><td colSpan={4}>{record.note}</td></tr>
          {record.postings.map((posting) => (
            <tr key={posting.id}>
              <td /><td>{posting.accountId}</td><td className="num">{money(posting.amountMinor)}</td>
              <td>{posting.party === undefined ? "—" : posting.party.label}</td>
              <td>{posting.evidence === undefined ? "—" : posting.evidence.join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="bb-empty">hash <code>{record.hash.slice(0, 16)}</code></p>
    </article>
  );
}

/** The standalone document a donor keeps: delivered as a file, never served. */
function PublicPageCard({ published }: { published: Journal }): ReactNode {
  const [url, setUrl] = useState<string | null>(null);
  const publish = (): void => {
    const html = publicPage({
      title: mutualAid.presentation.printTitle, journal: published,
      period: PERIOD, unit: UNIT, locale: LOCALE, note: LIMITS_NOTE,
    });
    setUrl(URL.createObjectURL(new Blob([html], { type: "text/html" })));
  };
  return (
    <section className="bb-card">
      <h2>The public page</h2>
      <p>
        One standalone file: table, head hash, totals, box on limits. Inline CSS, no script, no network —
        a donor can save it, print it, or host it alone.
      </p>
      <button className="bb-btn" type="button" onClick={publish}>Publish</button>
      {url === null ? null : (
        <p>
          <a className="bb-btn" href={url} download="mutual-aid-public-page.html">Download the public page</a>{" "}
          <a href={url} target="_blank" rel="noreferrer">open it</a> — {published.records.length} entries.
        </p>
      )}
    </section>
  );
}

/** The donor's receipt: an entry id and a hash, answered offline, with the reason when it fails. */
function ReceiptBox({ journal }: { journal: Journal }): ReactNode {
  const last = journal.records.at(-1);
  const [entryId, setEntryId] = useState(last?.id ?? "");
  const [hash, setHash] = useState(last?.hash ?? "");
  const [result, setResult] = useState<ReceiptResult | null>(null);
  const verdict = result?.status === "verified" ? "Verified" : result?.status === "broken" ? "Chain broken" : "Not found";
  const refill = (): void => {
    setEntryId(last?.id ?? "");
    setHash(last?.hash ?? "");
    setResult(null);
  };
  return (
    <section className="bb-card">
      <h2>{t(LOCALE, "publish.check")}</h2>
      <p>
        A donor types the id of the entry and its hash; the ledger answers offline. Verdicts: <strong>verified</strong>
        (the hash matches the chain), <strong>not found</strong> (no such entry), <strong>chain broken</strong> (reason given).
      </p>
      <p><label>Entry id <input size={28} value={entryId} onChange={(event) => setEntryId(event.target.value)} /></label></p>
      <p><label>Hash <input size={62} value={hash} onChange={(event) => setHash(event.target.value)} /></label></p>
      <p>
        <button className="bb-btn" type="button" onClick={() => setResult(verifyReceipt(journal, entryId, hash))}>Verify</button>{" "}
        <button className="bb-btn" type="button" onClick={refill}>Use the last entry</button>
      </p>
      {result === null ? null : (
        <p className={result.ok ? "bb-pill" : "bb-error"} role="status"><strong>{verdict}</strong> — {result.message}</p>
      )}
    </section>
  );
}

function PublishTab({ journal, published }: { journal: Journal; published: Journal }): ReactNode {
  const index = lastDonationIndex(journal);
  const kept = journal.records[index];
  const shown = published.records[index];
  if (kept === undefined || shown === undefined) return <p className="bb-empty">Nothing to publish.</p>;
  const findings = auditPublic(journal, published);
  return (
    <>
      <section className="bb-card">
        <h2>{t(LOCALE, "publish.title")}</h2>
        <div className="bb-grid-2">
          <EntryTwin title={t(LOCALE, "publish.side")} record={kept} />
          <EntryTwin title={t(LOCALE, "publish.public")} record={shown} />
        </div>
        <p className={findings.length === 0 ? "" : "bb-error"}>
          {findings.length === 0
            ? "Audit of the published entries: no party id, no evidence, no note. Nothing private got through."
            : findings.join(" · ")}
        </p>
      </section>
      <section className="bb-card">
        <h2>What this chain proves — and what it does not prove</h2>
        <div className="bb-grid-2">
          <Bullets title="What it proves" lines={PROVES} />
          <Bullets title="What it does not prove" lines={DOES_NOT_PROVE} />
        </div>
        <Bullets title="Why this is an argument, not an excuse" lines={WHY_AN_ARGUMENT} />
      </section>
      <PublicPageCard published={published} />
      <section className="bb-card">
        <h2>What a donor reads — 5 of {published.records.length}</h2>
        <JournalTable records={published.records} locale={LOCALE} limit={5} />
      </section>
      <ReceiptBox journal={journal} />
    </>
  );
}

/** The bordereau (LED-F-23): one line per month, totals spelled out, head hash in the footer. */
function ReportTab({ journal }: { journal: Journal }): ReactNode {
  const rows = monthlyRows(journal, mutualAid.chart, FUND_START, FUND_END);
  const entries = rows.reduce((sum, row) => sum + row.entries, 0);
  const inMinor = rows.reduce((sum, row) => sum + row.inMinor, 0);
  const outMinor = rows.reduce((sum, row) => sum + row.outMinor, 0);
  return (
    <section className="bb-card ma-report">
      <style>{PRINT_CSS}</style>
      <h1>{mutualAid.presentation.printTitle} — {PERIOD}</h1>
      <p>
        From {FUND_START} to {FUND_END}, month by month. A4, black on white, readable without colour;
        the head hash repeats in the footer.
      </p>
      <table className="bb-table">
        <thead>
          <tr><th>Month</th><th className="num">Entries</th><th className="num">In</th><th className="num">Out</th><th className="num">Balance</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.month}>
              <td>{row.month}</td>
              <td className="num">{row.entries}</td>
              <td className="num">{money(row.inMinor)}</td>
              <td className="num">{money(row.outMinor)}</td>
              <td className="num">{money(row.balanceMinor)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total {PERIOD}</td>
            <td className="num">{entries}</td>
            <td className="num">{money(inMinor)}</td>
            <td className="num">{money(outMinor)}</td>
            <td className="num">{money(inMinor - outMinor)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="words">Total in, in words: {moneyWords(inMinor, UNIT)}.</p>
      <p className="words">Total out, in words: {moneyWords(outMinor, UNIT)}.</p>
      <p className="words">Balance of the year, in words: {moneyWords(inMinor - outMinor, UNIT)}.</p>
      <p className="ma-footer">Head hash <code>{headHash(journal)}</code> — {mutualAid.name}, annual report {PERIOD}, {entries} entries.</p>
    </section>
  );
}

function AuditTab({ journal }: { journal: Journal }): ReactNode {
  const report = auditTrail(journal, { from: FUND_START, to: FUND_END });
  const chain = verifyChain(journal);
  return (
    <>
      <section className="bb-card">
        <h2>{t(LOCALE, "audit.title")}</h2>
        <p className={chain.ok ? "bb-pill" : "bb-error"}>
          {chain.ok ? `${journal.records.length} records, one unbroken chain.` : `Broken at #${chain.index}: ${chain.reason}.`}
        </p>
        <p>{t(LOCALE, "audit.head")} <code>{report.headHash}</code></p>
      </section>
      <AuditTrace report={report} locale={LOCALE} />
    </>
  );
}

export function App(): ReactNode {
  const [tab, setTab] = useState("fund");
  const [journal, setJournal] = useState<Journal>(demoJournal);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const ids = useMemo(() => browserUlidFactory(), []);
  const published = useMemo(() => publicJournal(journal), [journal]);
  const onCreate = (entry: Entry): void => {
    const [debit, credit] = entry.postings.map((posting) => posting.accountId);
    if (debit === credit) {
      setError("A debit and a credit on the same account would say nothing: pick two different accounts.");
      return;
    }
    try {
      const next = append(journal, entry);
      setJournal(next);
      setError(null);
      setNotice(`Entry #${next.records.length - 1} added — ${entry.note}. The chain was recomputed.`);
    } catch (reason) {
      const failure: LedgerError | undefined = reason instanceof LedgerError ? reason : undefined;
      setError(errorSentence(failure?.code ?? "Unknown", failure?.detail ?? {}));
      setNotice(null);
    }
  };
  const screen = (): ReactNode => {
    switch (tab) {
      case "ledger": return <LedgerTab journal={journal} />;
      case "publish": return <PublishTab journal={journal} published={published} />;
      case "report": return <ReportTab journal={journal} />;
      case "audit": return <AuditTab journal={journal} />;
      default: return <FundTab journal={journal} idFactory={ids} onCreate={onCreate} error={error} notice={notice} />;
    }
  };
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
      {screen()}
    </Shell>
  );
}

/** Four screens of the « neighbourhood time bank »: record an hour, report it by
 * month, read the journal, check the chain. Rendering only: the core computes. */
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { append, auditTrail, LedgerError, trialBalance, verifyChain } from "@ledger/core";
import type { Entry, Journal } from "@ledger/core";
import { AuditTrace, browserUlidFactory, JournalTable, ReportViews, Shell } from "@ledger/ui";
import type { ShellTab } from "@ledger/ui";
import { MEMBERS, timeBank, UNIT } from "./ledger.config";
import { amountMinor, buildEntry, normaliseDate } from "./entry";
import type { Draft } from "./entry";
import { exampleEntries } from "./example";
import { hours } from "./format";
import { monthlyReport } from "./report";
import type { MonthReport } from "./report";
import { journalFrom, loadLedger, saveLedger, todayIso } from "./store";
import type { StoredLedger } from "./store";

const LOCALE = timeBank.locale;
const nextId = browserUlidFactory();

const TABS: readonly ShellTab[] = [
  { id: "record", label: "Record" },
  { id: "report", label: "Monthly report" },
  { id: "journal", label: "Journal" },
  { id: "audit", label: "Audit" },
];

interface Notice { readonly ok: boolean; readonly text: string }
interface Accepted { readonly ok: true; readonly entries: readonly Entry[]; readonly text: string }
interface Refused { readonly ok: false; readonly text: string }
type Outcome = Accepted | Refused;

interface FormProps { readonly draft: Draft; readonly setDraft: (draft: Draft) => void; readonly onRecord: () => void; readonly onExample: () => void; readonly empty: boolean }

interface RecordProps extends FormProps { readonly notice: Notice | null }

interface PanelProps extends Omit<RecordProps, "empty"> { readonly tab: string; readonly journal: Journal }

function initialDraft(): Draft {
  return {
    from: MEMBERS[0]?.accountId ?? "",
    to: MEMBERS[1]?.accountId ?? "",
    amount: "3",
    date: todayIso(),
    note: "",
    single: false,
  };
}

/** Why the core refused, in plain words: the message names the law, not the code. */
const REFUSALS: Record<string, string> = {
  TooFewPostings: "an entry needs at least two postings whose amounts sum to zero. One posting alone is not an entry.",
  UnbalancedEntry: "this entry does not sum to zero. Every hour given is an hour received.",
  MixedUnits: "an entry may not mix two units.",
  DuplicateEntry: "this entry is already in the book.",
};

function explain(error: unknown, sum?: number): string {
  const amount = sum === undefined ? "" : ` (Σ = ${hours(sum, LOCALE)}, not 0)`;
  if (error instanceof LedgerError) {
    const refusal = REFUSALS[error.code];
    if (refusal !== undefined) return `Refused: ${refusal}${amount}`;
    return `Refused (${error.code}): ${error.message}`;
  }
  return `Refused: ${String(error)}`;
}

/** One attempt at recording an entry: the new book, or the reason it was refused. */
function recordEntry(draft: Draft, journal: Journal, entries: readonly Entry[]): Outcome {
  const giver = MEMBERS.find((member) => member.accountId === draft.from);
  const receiver = MEMBERS.find((member) => member.accountId === draft.to);
  if (giver === undefined || receiver === undefined) {
    return { ok: false, text: "Choose a giver and a receiver." };
  }
  if (giver.accountId === receiver.accountId) {
    return { ok: false, text: "A member cannot give hours to themselves: pick two different members." };
  }
  const minor = amountMinor(draft.amount);
  if (minor === null) {
    return { ok: false, text: "Enter a positive number of hours, for example 3." };
  }
  const date = normaliseDate(draft.date);
  if (date === null) {
    return { ok: false, text: "The date must look like YYYY-MM-DD (YYYY-MM is accepted: first day of the month)." };
  }
  const entry = buildEntry(draft, nextId(), date, MEMBERS);
  const sum = entry.postings.reduce((total, posting) => total + posting.amountMinor, 0);
  try {
    append(journal, entry);
    return { ok: true, entries: [...entries, entry], text: `Recorded: ${giver.label} gave ${hours(minor, LOCALE)} to ${receiver.label} on ${date}.` };
  } catch (error) {
    return { ok: false, text: explain(error, sum) };
  }
}

/** The brief's example, loaded in one go. */
function loadExample(stored: StoredLedger, journal: Journal): Outcome {
  const entries = exampleEntries(stored.entries.length);
  try {
    for (const entry of entries) append(journal, entry);
  } catch (error) {
    return { ok: false, text: explain(error) };
  }
  return {
    ok: true,
    entries: [...stored.entries, ...entries],
    text: "Loaded the example: Marta gave 3 h to Ali in March, Ali gave 1 h back to Marta in April.",
  };
}

function EntryForm({ draft, setDraft, onRecord, onExample, empty }: FormProps): ReactNode {
  const options = MEMBERS.map((member) => (
    <option key={member.accountId} value={member.accountId}>{member.label}</option>
  ));
  return (
    <form onSubmit={(event) => { event.preventDefault(); onRecord(); }}>
      <p>
        <label>From (giver){" "}<select value={draft.from} onChange={(event) => setDraft({ ...draft, from: event.target.value })}>{options}</select></label>{" "}
        <label>To (receiver){" "}<select value={draft.to} onChange={(event) => setDraft({ ...draft, to: event.target.value })}>{options}</select></label>
      </p>
      <p>
        <label>Hours{" "}<input type="number" min="0" step="0.25" size={6} value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} /></label>{" "}
        <label>Date{" "}<input type="text" size={12} placeholder="YYYY-MM-DD" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label>
      </p>
      <p>
        <label>Note{" "}<input type="text" size={40} placeholder="shopping for a neighbour" value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} /></label>
      </p>
      <p>
        <label>
          <input type="checkbox" checked={draft.single} onChange={(event) => setDraft({ ...draft, single: event.target.checked })} />{" "}
          one posting only (unbalanced — the core must refuse it)
        </label>
      </p>
      <button className="bb-btn" type="submit">Record</button>{" "}
      {empty ? <button className="bb-btn" type="button" onClick={onExample}>Load the brief&rsquo;s example</button> : null}
    </form>
  );
}

function RecordScreen({ draft, setDraft, onRecord, onExample, notice, empty }: RecordProps): ReactNode {
  return (
    <section className="bb-card">
      <h2>Record hours given</h2>
      <p className="bb-empty">
        Every entry balances: the giver is debited, the receiver is credited.
        One posting alone is refused by the core — try the checkbox.
      </p>
      <EntryForm draft={draft} setDraft={setDraft} onRecord={onRecord} onExample={onExample} empty={empty} />
      {notice === null ? null : <p className={notice.ok ? "bb-pill" : "bb-error"}>{notice.text}</p>}
    </section>
  );
}

function MonthlyTable({ months }: { months: readonly MonthReport[] }): ReactNode {
  if (months.length === 0) return <p className="bb-empty">No hour recorded yet.</p>;
  return (
    <table className="bb-table">
      <thead>
        <tr>
          <th scope="col">Month</th>
          <th scope="col">Member</th>
          <th scope="col" className="num">Given</th>
          <th scope="col" className="num">Received</th>
          <th scope="col" className="num">Net this month</th>
          <th scope="col" className="num">Balance</th>
        </tr>
      </thead>
      <tbody>
        {months.flatMap((month) => month.members.map((row) => (
          <tr key={`${month.period}-${row.accountId}`}>
            <td>{month.period}</td>
            <td>{row.label}</td>
            <td className="num">{hours(row.givenMinor, LOCALE)}</td>
            <td className="num">{hours(row.receivedMinor, LOCALE)}</td>
            <td className="num">{hours(row.netMinor, LOCALE)}</td>
            <td className="num">{hours(row.balanceMinor, LOCALE)}</td>
          </tr>
        )))}
      </tbody>
    </table>
  );
}

function ReportScreen({ journal }: { journal: Journal }): ReactNode {
  const report = useMemo(() => monthlyReport(journal, MEMBERS), [journal]);
  const balance = useMemo(() => trialBalance(journal, timeBank.chart, { asOf: "9999-12-31", unit: UNIT }), [journal]);
  const [filter, setFilter] = useState("all");
  const shown = filter === "all" ? report : report.filter((month) => month.period === filter);
  return (
    <>
      <section className="bb-card">
        <h2>Monthly report — hours given and received</h2>
        <p>
          <label>Month{" "}
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">All months</option>
              {report.map((month) => <option key={month.period} value={month.period}>{month.period}</option>)}
            </select>
          </label>
        </p>
        <MonthlyTable months={shown} />
        <p className="bb-empty">
          Given = hours the member gave. Received = hours the member got.
          Net = given − received. Balance = received − given, cumulated: what the member
          still holds with the bank (a negative balance means the member owes hours).
        </p>
      </section>
      <ReportViews report={balance} locale={LOCALE} />
    </>
  );
}

function JournalScreen({ journal }: { journal: Journal }): ReactNode {
  return (
    <section className="bb-card">
      <h2>Journal</h2>
      <JournalTable records={journal.records} locale={LOCALE} />
    </section>
  );
}

function AuditScreen({ journal }: { journal: Journal }): ReactNode {
  const report = useMemo(() => auditTrail(journal, { from: "0000-01-01", to: "9999-12-31" }), [journal]);
  const chain = verifyChain(journal);
  return (
    <>
      <AuditTrace report={report} locale={LOCALE} />
      <p className={chain.ok ? "bb-pill" : "bb-error"}>
        {chain.ok
          ? `${journal.records.length} records, one unbroken chain.`
          : `Broken at #${chain.index + 1}: ${chain.reason}.`}
      </p>
    </>
  );
}

function Panels({ tab, journal, draft, setDraft, onRecord, onExample, notice }: PanelProps): ReactNode {
  return (
    <>
      {tab === "record" ? <RecordScreen draft={draft} setDraft={setDraft} onRecord={onRecord} onExample={onExample} notice={notice} empty={journal.records.length === 0} /> : null}
      {tab === "report" ? <ReportScreen journal={journal} /> : null}
      {tab === "journal" ? <JournalScreen journal={journal} /> : null}
      {tab === "audit" ? <AuditScreen journal={journal} /> : null}
    </>
  );
}

export function App(): ReactNode {
  const [stored, setStored] = useState<StoredLedger>(() => loadLedger());
  const [tab, setTab] = useState("record");
  const [draft, setDraft] = useState<Draft>(() => initialDraft());
  const [notice, setNotice] = useState<Notice | null>(null);
  const journal = useMemo(() => journalFrom(stored), [stored]);

  const apply = (outcome: Outcome): void => {
    if (!outcome.ok) {
      setNotice({ ok: false, text: outcome.text });
      return;
    }
    const next: StoredLedger = { createdAt: stored.createdAt, entries: outcome.entries };
    saveLedger(next);
    setStored(next);
    setNotice({ ok: true, text: outcome.text });
  };

  const record = (): void => {
    const outcome = recordEntry(draft, journal, stored.entries);
    if (outcome.ok) setDraft(initialDraft());
    apply(outcome);
  };

  const load = (): void => {
    apply(loadExample(stored, journal));
  };

  return (
    <Shell
      theme={"plain"}
      title={timeBank.name}
      subtitle={`${journal.records.length} entries · ${MEMBERS.length} members · unit: hour`}
      locale={LOCALE}
      tabs={TABS}
      activeTab={tab}
      onTab={setTab}
    >
      <Panels tab={tab} journal={journal} draft={draft} setDraft={setDraft} onRecord={record} onExample={load} notice={notice} />
    </Shell>
  );
}

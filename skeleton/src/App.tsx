/** Two buttons, two reports, no business law: everything below is the core's doing. */
import { useMemo, useState } from "react";
import {
  append, auditTrail, createJournal, trialBalance, verifyChain,
  type Entry, type Journal,
} from "@ledger/core";
import { AuditTrace, ReportViews, Shell, browserUlidFactory, t } from "@ledger/ui";
import { config } from "./ledger.config.js";

const chart = config.chart;

const nextId = browserUlidFactory();
const today = new Date().toISOString().slice(0, 10);

const sample = (direction: 1 | -1): Entry => {
  const amount = 1000 * direction;
  const id = nextId();
  return {
    id, date: today, note: direction > 0 ? "Coffee, paid cash" : "Refund, cash back",
    unit: "EUR", kind: "transaction", reverses: null, tags: [],
    postings: [
      { id: `${id}-a`, accountId: "expenses:general", amountMinor: amount, unit: "EUR" },
      { id: `${id}-b`, accountId: "assets:cash", amountMinor: -amount, unit: "EUR" },
    ],
  };
};

export function App() {
  const [journal, setJournal] = useState<Journal>(() => createJournal(today));
  const [tab, setTab] = useState("reports");
  const balance = useMemo(() => trialBalance(journal, chart, { asOf: today, unit: "EUR" }), [journal]);
  return (
    <Shell title="Ledger skeleton" subtitle={`${journal.records.length} entries · chain ${verifyChain(journal).ok ? "ok" : "broken"}`}
      locale="en" tabs={[{ id: "reports", label: t("en", "tab.reports") }, { id: "audit", label: t("en", "tab.audit") }]}
      activeTab={tab} onTab={setTab}
      actions={<><button className="bb-btn" type="button" onClick={() => setJournal((j) => append(j, sample(1)))}>Add entry</button>
        <button className="bb-btn" type="button" onClick={() => setJournal((j) => append(j, sample(-1)))}>Reverse</button></>}>
      {tab === "reports" ? <ReportViews report={balance} locale="en" />
        : <AuditTrace report={auditTrail(journal, { from: "0000-01-01", to: "9999-12-31" })} locale="en" />}
    </Shell>
  );
}

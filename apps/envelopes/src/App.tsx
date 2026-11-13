/** Les écrans de « Household envelopes ». Câblage seulement : le core calcule, l'app affiche. */
import { useMemo, useState } from "react";
import {
  LedgerError, auditTrail, contra, envelopeReport, formatMinor, leftTodayMinor, trialBalance, verifyChain,
  type Entry, type Journal,
} from "@ledger/core";
import { AuditTrace, EnvelopeBoard, EntryForm, ImportWizard, NumberBand, ReportViews, Shell, browserUlidFactory, errorSentence, t } from "@ledger/ui";
import type { Locale, ShellTab } from "@ledger/ui";
import { ClassifyScreen } from "./classify";
import { JournalScreen } from "./journal";
import ledger, { BANK_ACCOUNT, PERIOD, SALARY_ACCOUNT, UNIT, UNASSIGNED_ACCOUNT } from "./ledger.config";
import { HISTORY, daysLeftIn, projection } from "./projection";
import {
  assignedJournal, assign, exportJson, forgetRule, importJson, journalFrom, lastEntry, learnFor, loadLedger,
  proposals as pendingProposals, saveLedger, todayIso, withEntries, type Proposal, type StoredLedger,
} from "./store";

/** Un identifiant par geste : l'horloge et le hasard restent hors du core. */
const nextId = browserUlidFactory();
const options = () => ({ period: PERIOD, daysLeft: daysLeftIn(PERIOD, todayIso()) });

/** Le livre, ses dérivés et les cinq gestes : un seul endroit, lisible d'un coup d'œil. */
const useBook = () => {
  const [stored, setStored] = useState<StoredLedger>(loadLedger);
  const [tab, setTab] = useState("overview");
  const [notice, setNotice] = useState<string | null>(null);
  const recorded = useMemo(() => journalFrom(stored), [stored]);
  const journal = useMemo(() => assignedJournal(stored), [stored]);
  const todo = useMemo(() => pendingProposals(recorded, stored, ledger.rules), [recorded, stored]);
  const reversed = useMemo(() => new Set(recorded.records.flatMap((r) => (r.reverses === null ? [] : [r.reverses]))), [recorded]);
  const commit = (next: StoredLedger): void => { saveLedger(next); setStored(next); };

  const onImported = (entries: readonly Entry[]): void => {
    commit(withEntries(stored, entries));
    setNotice(`${entries.length} écriture(s) importée(s) : à affecter dans « À classer » avant de compter.`);
  };

  /** Une correction apprend une règle (`learnRule`) ; une confirmation nourrit le compteur d'usages. */
  const onDecide = (proposal: Proposal, accountId: string): void => {
    const corrected = accountId !== proposal.accountId;
    const next = assign(stored, proposal.entryId, accountId, corrected ? null : proposal.ruleId);
    commit(corrected ? learnFor(next, proposal.note, accountId, nextId()) : next);
    setNotice(corrected ? `Règle apprise : « ${proposal.note} » → ${accountId}.` : `Affectation confirmée : ${accountId}.`);
  };

  const onReverse = (targetId: string, note: string): string | null => {
    if (note.trim() === "") return "La note est obligatoire : elle dit pourquoi l'écriture est corrigée.";
    try {
      const after = contra(recorded, targetId, { id: nextId(), date: todayIso(), note: note.trim() });
      commit(withEntries(stored, [lastEntry(after)]));
      setNotice("Contre-passation ajoutée : l'originale et sa correction restent au journal.");
      return null;
    } catch (cause) {
      const code = cause instanceof LedgerError ? cause.code : "NotBalanced";
      return `${errorSentence(code, cause instanceof LedgerError ? cause.detail : {})} : rien n'a été écrit.`;
    }
  };

  const onForget = (ruleId: string): void => commit(forgetRule(stored, ruleId));

  /** Une écriture saisie à la main rejoint le livre, puis attend son affectation. */
  const onCreate = (entry: Entry): void => {
    const waiting = entry.postings.some((posting) => posting.accountId === UNASSIGNED_ACCOUNT);
    commit(withEntries(stored, [entry]));
    setNotice(waiting ? `Écriture ajoutée : « ${entry.note} » attend son affectation.` : `Écriture ajoutée : « ${entry.note} ».`);
  };

  const onExport = (): void => {
    const url = URL.createObjectURL(new Blob([exportJson(stored)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `foyer-${stored.createdAt}.ledger.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice("Livre exporté : c'est votre seule sauvegarde, gardez ce fichier.");
  };

  const onFile = (file: File): void => {
    void file.text().then((text) => {
      const outcome = importJson(text, stored);
      if (!outcome.ok) { setNotice(outcome.message); return; }
      commit(outcome.stored);
      const ignored = outcome.ignored > 0 ? `, ${outcome.ignored} illisible(s) ignorée(s)` : "";
      setNotice(`Livre reconstruit : ${outcome.stored.entries.length} écriture(s)${ignored}.`);
    });
  };

  return { tab, setTab, notice, recorded, journal, todo, reversed, learned: stored.rules, onImported, onDecide, onReverse, onForget, onCreate, onExport, onFile };
};

/** Les deux boutons de sauvegarde : le fichier exporté est la seule copie qui survit. */
const BackupBar = ({ onExport, onFile }: { onExport: () => void; onFile: (file: File) => void }) => (
  <>
    <button className="bb-btn" type="button" onClick={onExport}>Exporter</button>
    <label className="bb-pill">
      Importer{" "}
      <input type="file" accept=".json,application/json" hidden onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file !== undefined) onFile(file);
      }} />
    </label>
  </>
);

/** Le chiffre d'abord, la projection en fourchette juste à côté (LED-F-16, LED-F-17). */
function Overview({ journal, locale }: { journal: Journal; locale: Locale }) {
  const left = leftTodayMinor(journal, ledger.chart, ledger.envelopes, options());
  const band = projection(journal, PERIOD, todayIso(), ledger.envelopes.envelopes.map((env) => env.accountId));
  const months = band.periods.length === 0 ? "aucun mois exploitable" : band.periods.join(", ");
  return (
    <>
      <div className="bb-grid-2">
        <NumberBand
          label={t(locale, "leftToday")} valueMinor={left} unit={UNIT} locale={locale} hint={t(locale, "leftToday.hint")}
        />
        <section className="bb-card">
          <h2>Projection de fin de mois — une fourchette</h2>
          <p className="bb-band-value">{formatMinor(band.lowMinor, UNIT, locale)} – {formatMinor(band.highMinor, UNIT, locale)}</p>
          <p>Médiane {formatMinor(band.medianMinor, UNIT, locale)} ± {formatMinor(band.spreadMinor, UNIT, locale)}, sur {months}.</p>
          <p className="bb-sub">{band.periods.length < HISTORY
            ? `Historique insuffisant : ${band.periods.length} mois sur ${HISTORY}, fourchette large.`
            : "Médiane et écart des trois derniers mois : jamais un chiffre unique."}</p>
        </section>
      </div>
      <p className="bb-sub">Seule sauvegarde : le fichier « .ledger.json » exporté. Rien n'est envoyé sur un serveur.</p>
    </>
  );
}

export function App() {
  const book = useBook();
  const locale: Locale = ledger.locale;
  const tabs: ShellTab[] = [
    { id: "overview", label: t(locale, "tab.overview") }, { id: "envelopes", label: t(locale, "tab.envelopes") }, { id: "journal", label: t(locale, "tab.journal") },
    { id: "classify", label: `À classer (${book.todo.length})` }, { id: "import", label: t(locale, "tab.import") },
    { id: "reports", label: t(locale, "tab.reports") }, { id: "audit", label: t(locale, "tab.audit") },
  ];
  const chain = verifyChain(book.recorded);
  const window = { from: book.recorded.records[0]?.date ?? `${PERIOD}-01`, to: book.recorded.records.at(-1)?.date ?? PERIOD };
  return (
    <Shell
      theme="warm-paper" title={ledger.name} subtitle={`${t(locale, "report.period")} ${PERIOD}`} locale={locale}
      tabs={tabs} activeTab={book.tab} onTab={book.setTab} actions={<BackupBar onExport={book.onExport} onFile={book.onFile} />}
    >
      {book.notice === null ? null : <p className="bb-card" role="status">{book.notice}</p>}
      {book.tab === "overview" ? <Overview journal={book.journal} locale={locale} /> : null}
      {book.tab === "envelopes" ? (
        <EnvelopeBoard report={envelopeReport(book.journal, ledger.chart, ledger.envelopes, options())} locale={locale} />
      ) : null}
      {book.tab === "journal" ? (
        <JournalScreen records={book.recorded.records} reversed={book.reversed} locale={locale} onReverse={book.onReverse} />
      ) : null}
      {book.tab === "classify" ? (
        <>
          <ClassifyScreen proposals={book.todo} accounts={ledger.chart.accounts} learned={book.learned} unit={UNIT} locale={locale} onDecide={book.onDecide} onForget={book.onForget} />
          <EntryForm accounts={ledger.chart.accounts} unit={UNIT} locale={locale} idFactory={() => nextId()} onCreate={book.onCreate} error={null} />
        </>
      ) : null}
      {book.tab === "import" ? (
        <ImportWizard
          unit={UNIT} accountId={BANK_ACCOUNT} debitAccountId={UNASSIGNED_ACCOUNT} creditAccountId={SALARY_ACCOUNT}
          locale={locale} idFactory={() => nextId()} onImported={book.onImported}
          existingEvidence={book.recorded.records.flatMap((r) => r.postings.flatMap((p) => p.evidence ?? []))}
        />
      ) : null}
      {book.tab === "reports" ? (
        <ReportViews report={trialBalance(book.journal, ledger.chart, { asOf: window.to, unit: UNIT })} locale={locale} />
      ) : null}
      {book.tab === "audit" ? (
        <>
          <AuditTrace report={auditTrail(book.recorded, window)} locale={locale} />
          <p className="bb-sub">{chain.ok ? `Chaîne d'empreintes vérifiée : ${book.recorded.records.length} écriture(s).` : `Chaîne rompue à l'écriture n°${chain.index + 1}.`}</p>
        </>
      ) : null}
    </Shell>
  );
}

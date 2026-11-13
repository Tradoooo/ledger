/** Le journal tel qu'il est écrit, avec son seul geste : une contre-passation, jamais une retouche (LED-F-04). */
import { useState } from "react";
import { formatMinor } from "@ledger/core";
import type { JournalRecord } from "@ledger/core";
import { t } from "@ledger/ui";
import type { Locale } from "@ledger/ui";

const pairOf = (record: JournalRecord, byId: ReadonlyMap<string, JournalRecord>): string | null => {
  if (record.kind !== "reversal") return null;
  const original = record.reverses === null ? undefined : byId.get(record.reverses);
  return `corrige ${original === undefined ? "une écriture absente" : `${original.date} · ${original.note}`}`;
};

export interface JournalScreenProps {
  records: readonly JournalRecord[];
  /** Écritures déjà contre-passées. */
  reversed: ReadonlySet<string>;
  locale: Locale;
  /** Ajoute la contre-passation ; renvoie une phrase si elle est refusée, null sinon. */
  onReverse: (targetId: string, note: string) => string | null;
}

/** Le formulaire du bouton : la note est obligatoire, le core construit l'écriture opposée. */
function ReversalForm({ target, locale, error, onCancel, onSubmit }: {
  target: JournalRecord; locale: Locale; error: string | null;
  onCancel: () => void; onSubmit: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <section className="bb-card" aria-label="Contre-passation">
      <h2>Contre-passer : {target.date} · {target.note}</h2>
      <label>
        Note obligatoire (pourquoi cette correction){" "}
        <input type="text" size={44} value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      {error === null ? null : <p className="bb-error" role="alert">{error}</p>}
      <p><button className="bb-btn" type="button" onClick={() => onSubmit(note)}>{t(locale, "reversal")}</button>{" "}
        <button className="bb-btn" type="button" onClick={onCancel}>Renoncer</button></p>
    </section>
  );
}

export function JournalScreen({ records, reversed, locale, onReverse }: JournalScreenProps) {
  const [targetId, setTargetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const byId = new Map(records.map((record) => [record.id, record]));
  const target = targetId === null ? undefined : byId.get(targetId);
  const submit = (note: string): void => {
    if (targetId === null) return;
    const message = onReverse(targetId, note);
    setError(message);
    if (message === null) setTargetId(null);
  };
  if (records.length === 0) return <p className="bb-empty">{t(locale, "journal.empty")}</p>;
  return (
    <>
      <section className="bb-card">
        <h2>{t(locale, "journal.title")} — {t(locale, "journal.entries", { count: records.length })}</h2>
        <table className="bb-table">
          <thead>
            <tr>
              <th scope="col">{t(locale, "audit.date")}</th><th scope="col">{t(locale, "audit.note")}</th>
              <th scope="col">{t(locale, "audit.kind")}</th><th scope="col" className="num">{records[0]?.unit ?? "EUR"}</th>
            </tr>
          </thead>
          <tbody>
            {[...records].reverse().map((record) => {
              const pair = pairOf(record, byId);
              const locked = record.kind === "reversal" || reversed.has(record.id);
              const open = (): void => { setError(null); setTargetId(record.id); };
              return (
                <tr key={record.id}>
                  <td><time dateTime={record.date}>{record.date}</time></td>
                  <td>{record.note} {pair === null ? null : <span className="bb-pill">{pair}</span>}{reversed.has(record.id) ? <> <span className="bb-pill">contre-passée</span></> : null}</td>
                  <td>{t(locale, record.kind)} {locked ? null : <button className="bb-btn" type="button" onClick={open}>Contre-passer</button>}</td>
                  <td className="num">{formatMinor(record.postings.reduce((sum, p) => sum + Math.abs(p.amountMinor), 0) / 2, record.unit, locale)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      {target === undefined ? null : (
        <ReversalForm
          key={target.id} target={target} locale={locale} error={error}
          onCancel={() => { setTargetId(null); setError(null); }} onSubmit={submit}
        />
      )}
    </>
  );
}

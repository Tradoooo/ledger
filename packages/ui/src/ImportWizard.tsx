/** Statement import in three steps, one card. Nothing is imported before the confirm click (LED-F-09). */
import { useState } from "react";
import type { Detection, Entry, ImportResult } from "@ledger/core";
import { detectCsv, importStatement } from "@ledger/core";
import { t, type Locale, type MessageKey } from "./i18n.js";

export interface ImportWizardProps {
  unit: string;
  accountId: string;
  debitAccountId: string;
  creditAccountId: string;
  locale: Locale;
  existingEvidence: readonly string[];
  idFactory: (index: number) => string;
  onImported: (entries: readonly Entry[], rejected: number, duplicates: number) => void;
}

interface Picked { name: string; bytes: Uint8Array }

type DetectionFact = "encoding" | "separator" | "decimal" | "dateFormat";

const REJECTED_PREVIEW = 5;

/** The four guesses a reader must see before trusting the parse. */
const FACTS: readonly (readonly [MessageKey, DetectionFact])[] = [
  ["detection.encoding", "encoding"],
  ["detection.separator", "separator"],
  ["detection.decimal", "decimal"],
  ["detection.date", "dateFormat"],
];

/** The three accounts every imported row is posted to. */
function AccountsPanel({ accountId, debitAccountId, creditAccountId, locale }: {
  accountId: string; debitAccountId: string; creditAccountId: string; locale: Locale;
}) {
  return (
    <dl>
      <div><dt>{t(locale, "report.account")}</dt><dd><code>{accountId}</code></dd></div>
      <div><dt>{t(locale, "report.debit")}</dt><dd><code>{debitAccountId}</code></dd></div>
      <div><dt>{t(locale, "report.credit")}</dt><dd><code>{creditAccountId}</code></dd></div>
    </dl>
  );
}

/** What the core guessed from the bytes: encoding, separator, decimal, dates, header cells. */
function DetectionPanel({ detection, locale }: { detection: Detection; locale: Locale }) {
  return (
    <div>
      <p>{t(locale, "import.detected")}</p>
      <dl>
        {FACTS.map(([key, fact]) => (
          <div key={fact}>
            <dt>{t(locale, key)}</dt>
            <dd><code>{fact === "separator" ? JSON.stringify(detection[fact]) : detection[fact]}</code></dd>
          </div>
        ))}
      </dl>
      <ul>
        {detection.header.map((cell, index) => (
          <li key={`${index}-${cell}`}><span className="bb-pill">{cell}</span></li>
        ))}
      </ul>
    </div>
  );
}

/** Counts and up to five rejected lines, each with the code the core gave it. */
function ImportSummary({ result, locale }: { result: ImportResult; locale: Locale }) {
  const preview = result.rejected.slice(0, REJECTED_PREVIEW);
  return (
    <div>
      <p>{t(locale, "journal.entries", { count: result.entries.length })}</p>
      <p>{t(locale, "import.duplicates", { count: result.duplicates })}</p>
      {preview.length === 0 ? null : (
        <div>
          <p className="bb-error">{t(locale, "import.rejected", { count: result.rejected.length })}</p>
          <ul>
            {preview.map((row) => (
              <li key={row.line}><code>{row.line}</code> <code>{row.code}</code> {row.reason}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Step 1: the file itself. Reading the bytes is all that happens here. */
function ChooseStep({ picked, locale, onPick }: { picked: Picked | null; locale: Locale; onPick: (file: File) => void }) {
  return (
    <li>
      <label>
        {t(locale, "import.choose")}{" "}
        <input
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file !== undefined) onPick(file);
          }}
        />
      </label>
      {picked === null ? null : <p><code>{picked.name}</code></p>}
    </li>
  );
}

/** Step 2: the detection, then the click that allows the import (LED-F-09). */
function ConfirmStep({ detection, error, locale, onConfirm }: {
  detection: Detection | null; error: string | null; locale: Locale; onConfirm: () => void;
}) {
  return (
    <li>
      {detection === null ? null : <DetectionPanel detection={detection} locale={locale} />}
      {error === null ? null : <p className="bb-error">{error}</p>}
      <button className="bb-btn" type="button" onClick={onConfirm} disabled={detection === null}>
        {t(locale, "import.title")}
      </button>
    </li>
  );
}

/** Step 3: what the import produced, or the promise that nothing happened yet. */
function ResultStep({ result, locale }: { result: ImportResult | null; locale: Locale }) {
  return (
    <li>
      {result === null
        ? <p className="bb-empty">{t(locale, "import.none")}</p>
        : <ImportSummary result={result} locale={locale} />}
    </li>
  );
}

export function ImportWizard(props: ImportWizardProps) {
  const { unit, accountId, debitAccountId, creditAccountId, locale, existingEvidence, idFactory, onImported } = props;
  const [picked, setPicked] = useState<Picked | null>(null);
  const [detection, setDetection] = useState<Detection | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const choose = async (file: File): Promise<void> => {
    setResult(null);
    setDetection(null);
    setError(null);
    const bytes = new Uint8Array(await file.arrayBuffer());
    setPicked({ name: file.name, bytes });
    try {
      setDetection(detectCsv(bytes));
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const confirm = (): void => {
    if (picked === null || detection === null) return;
    const imported = importStatement(picked.bytes, {
      accountId, debitAccountId, creditAccountId, unit, idFactory, existingEvidence, detection,
    });
    setResult(imported);
    onImported(imported.entries, imported.rejected.length, imported.duplicates);
  };

  return (
    <section className="bb-card">
      <h2>{t(locale, "import.title")}</h2>
      <AccountsPanel
        accountId={accountId} debitAccountId={debitAccountId} creditAccountId={creditAccountId} locale={locale}
      />
      <ol>
        <ChooseStep picked={picked} locale={locale} onPick={(file) => void choose(file)} />
        <ConfirmStep detection={detection} error={error} locale={locale} onConfirm={confirm} />
        <ResultStep result={result} locale={locale} />
      </ol>
    </section>
  );
}
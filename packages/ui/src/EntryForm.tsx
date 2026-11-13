/** One entry, typed by hand: two postings, one amount, and a sum that must be zero.
 *
 * The form never decides what an entry means: it builds one that the core accepts
 * (the postings sum to zero, one unit, a transaction) and hands it over. The core
 * still has the last word, and its sentence comes back through `error`.
 */
import { useState } from "react";
import type { FormEvent } from "react";
import type { Entry, Posting } from "@ledger/core";
import { formatMinor, toMinor } from "@ledger/core";
import { t, type Locale } from "./i18n.js";

export interface EntryAccount { id: string; label: string; type: string }

export interface EntryFormProps {
  accounts: readonly EntryAccount[];
  unit: string;
  locale: Locale;
  idFactory: () => string;
  onCreate: (entry: Entry) => void;
  error: string | null;
}

interface Draft { date: string; note: string; amount: string; debit: string; credit: string }

interface Amounts { debit: number; credit: number }

type FieldKind = "text" | "date" | "number";

interface TextFieldProps {
  label: string;
  kind: FieldKind;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  step?: string;
}

/** The amount as minor units, or null when the field does not hold a number. */
function amountsOf(text: string, unit: string): Amounts | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return null;
  const minor = toMinor(value, unit);
  if (!Number.isSafeInteger(minor)) return null;
  const magnitude = Math.abs(minor);
  return { debit: magnitude, credit: -magnitude };
}

/** The accounts on offer, plus the one that was chosen and is not on offer any more. */
function accountOptions(accounts: readonly EntryAccount[], value: string): readonly EntryAccount[] {
  if (value === "" || accounts.some((account) => account.id === value)) return accounts;
  return [...accounts, { id: value, label: value, type: "" }];
}

/** The entry the core will receive: one id per posting, derived from the entry id. */
function buildEntry(draft: Draft, unit: string, idFactory: () => string, amounts: Amounts): Entry {
  const id = idFactory();
  const postings: Posting[] = [
    { id: `${id}-1`, accountId: draft.debit, amountMinor: amounts.debit, unit },
    { id: `${id}-2`, accountId: draft.credit, amountMinor: amounts.credit, unit },
  ];
  return {
    id, date: draft.date, note: draft.note.trim(), unit,
    kind: "transaction", postings, reverses: null, tags: [],
  };
}

function TextField({ label, kind, value, onChange, maxLength, step }: TextFieldProps) {
  return (
    <label>
      {label}{" "}
      <input
        type={kind}
        value={value}
        maxLength={maxLength}
        step={step}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function AccountSelect({ label, accounts, value, onChange }: {
  label: string; accounts: readonly EntryAccount[]; value: string; onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}{" "}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {value === "" ? <option value="">—</option> : null}
        {accountOptions(accounts, value).map((account) => (
          <option key={account.id} value={account.id}>{account.label}</option>
        ))}
      </select>
    </label>
  );
}

/** The sum, as it stands: it must be zero, and it says so before the click. */
function SumRow({ sum, unit, locale }: { sum: number | null; unit: string; locale: Locale }) {
  return (
    <table className="bb-table">
      <tbody>
        <tr>
          <th scope="row">Σ</th>
          <td className={sum === 0 ? "num" : "num bb-error"} aria-live="polite">
            {sum === null ? "—" : formatMinor(sum, unit, locale)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function EntryForm({ accounts, unit, locale, idFactory, onCreate, error }: EntryFormProps) {
  const [draft, setDraft] = useState<Draft>(() => ({
    date: "", note: "", amount: "",
    debit: accounts[0]?.id ?? "",
    credit: accounts[1]?.id ?? "",
  }));

  const update = (patch: Partial<Draft>): void => setDraft((current) => ({ ...current, ...patch }));
  const amounts = amountsOf(draft.amount, unit);
  const sum = amounts === null ? null : amounts.debit + amounts.credit;
  const complete =
    sum === 0 && draft.date !== "" && draft.note.trim() !== "" && draft.debit !== "" && draft.credit !== "";

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!complete || amounts === null) return;
    onCreate(buildEntry(draft, unit, idFactory, amounts));
  };

  return (
    <form className="bb-card" onSubmit={submit}>
      <h2>New entry</h2>
      <p>
        <TextField label={t(locale, "audit.date")} kind="date" value={draft.date}
          onChange={(value) => update({ date: value })} />
      </p>
      <p>
        <TextField label={t(locale, "audit.note")} kind="text" maxLength={200} value={draft.note}
          onChange={(value) => update({ note: value })} />
      </p>
      <p>
        <TextField label="Amount" kind="number" step="0.01" value={draft.amount}
          onChange={(value) => update({ amount: value })} />
      </p>
      <p>
        <AccountSelect label={t(locale, "report.debit")} accounts={accounts} value={draft.debit}
          onChange={(value) => update({ debit: value })} />
      </p>
      <p>
        <AccountSelect label={t(locale, "report.credit")} accounts={accounts} value={draft.credit}
          onChange={(value) => update({ credit: value })} />
      </p>
      <SumRow sum={sum} unit={unit} locale={locale} />
      {error === null ? null : <p className="bb-error" role="alert">{error}</p>}
      <button className="bb-btn" type="submit" disabled={!complete}>Save entry</button>
    </form>
  );
}

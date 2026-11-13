/** The journal, rendered as it is stored: append-only, newest first. */
import type { JournalRecord } from "@ledger/core";
import { formatMinor } from "@ledger/core";
import { t, type Locale } from "./i18n.js";

export interface JournalTableProps {
  records: readonly JournalRecord[];
  locale: Locale;
  limit?: number;
}

const HASH_PREFIX = 8;

/** Debit side of one entry; a reversal only carries negatives, so it falls back to the credit side. */
function entryAmount(record: JournalRecord): number {
  let debit = 0;
  let credit = 0;
  for (const posting of record.postings) {
    if (posting.amountMinor > 0) debit += posting.amountMinor;
    else credit -= posting.amountMinor;
  }
  return debit === 0 ? credit : debit;
}

/** Newest first: `records` is append-only, so the last record is the last thing that happened. */
export function JournalTable({ records, locale, limit }: JournalTableProps) {
  const newest = [...records].reverse();
  const shown = limit === undefined ? newest : newest.slice(0, Math.max(limit, 0));
  if (shown.length === 0) return <p className="bb-empty">{t(locale, "journal.empty")}</p>;
  const unit = shown[0]?.unit ?? "";
  return (
    <table className="bb-table">
      <thead>
        <tr>
          <th scope="col">{t(locale, "audit.date")}</th>
          <th scope="col">{t(locale, "audit.note")}</th>
          <th scope="col">{t(locale, "audit.kind")}</th>
          <th scope="col" className="num">{unit}</th>
          <th scope="col">{t(locale, "audit.hash")}</th>
        </tr>
      </thead>
      <tbody>
        {shown.map((record) => (
          <tr key={record.id}>
            <td><time dateTime={record.date}>{record.date}</time></td>
            <td>{record.note}</td>
            <td>{t(locale, record.kind)}</td>
            <td className="num">{formatMinor(entryAmount(record), record.unit, locale)}</td>
            <td><code>{record.hash.slice(0, HASH_PREFIX)}</code></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
/** Audit trail: the head hash you publish, then the hashed records it covers. */
import { useState } from "react";
import type { Report } from "@ledger/core";
import { t, type Locale } from "./i18n.js";

type AuditReport = Extract<Report, { kind: "audit-trail" }>;

export interface AuditTraceProps {
  report: AuditReport;
  locale: Locale;
}

const HASH_PREFIX = 8;

export function AuditTrace({ report, locale }: AuditTraceProps) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const clipboard = globalThis.navigator?.clipboard;
    if (clipboard === undefined) return;
    // Silent on purpose: a blocked clipboard must never break the page.
    void clipboard.writeText(report.headHash).then(() => setCopied(true), () => setCopied(false));
  };
  return (
    <section className="bb-card">
      <h2>{t(locale, "audit.title")}</h2>
      <p>
        <span>{t(locale, "audit.head")}</span> <code>{report.headHash}</code>{" "}
        <button className="bb-btn" type="button" onClick={copy}>{t(locale, "audit.head")}</button>
        {copied ? <>{" "}<span className="bb-pill">{t(locale, "share.copied")}</span></> : null}
      </p>
      {report.rows.length === 0 ? (
        <p className="bb-empty">{t(locale, "audit.empty")}</p>
      ) : (
        <table className="bb-table">
          <thead>
            <tr>
              <th scope="col" className="num">{t(locale, "audit.seq")}</th>
              <th scope="col">{t(locale, "audit.date")}</th>
              <th scope="col">{t(locale, "audit.note")}</th>
              <th scope="col">{t(locale, "audit.kind")}</th>
              <th scope="col">{t(locale, "audit.hash")}</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr key={row.hash}>
                <td className="num">{row.seq}</td>
                <td><time dateTime={row.date}>{row.date}</time></td>
                <td>{row.note}</td>
                <td>{t(locale, row.kind)}</td>
                <td><code>{row.hash.slice(0, HASH_PREFIX)}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
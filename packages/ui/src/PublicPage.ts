/** The public page: a standalone document a donor can save, print or host.
 *
 * One file, no script, no external resource, no web font: the document IS the
 * artefact. Everything that comes from the journal is escaped, so a note that
 * contains markup stays a note.
 */
import type { Journal, JournalRecord } from "@ledger/core";
import { formatMinor, headHash } from "@ledger/core";
import { t, type Locale } from "./i18n.js";

export interface PublicPageOptions {
  title: string;
  journal: Journal;
  period: string;
  unit: string;
  locale: Locale;
  note?: string;
}

interface Sides { debit: number; credit: number }

const ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
};

/** System fonts, no download: the page must work offline, on a USB stick. */
const CSS = [
  ":root{color-scheme:light dark;--ink:#1e1c17;--ink-soft:#59544a;--paper:#f7f5ef;--paper-alt:#efece2;--rule:#d8d2c0;--accent:#8a4b16;--bad:#8c2b1f;font:16px/1.55 ui-serif,Georgia,'Iowan Old Style',serif}",
  "@media (prefers-color-scheme:dark){:root{--ink:#eee9dc;--ink-soft:#b5ae9c;--paper:#16150f;--paper-alt:#1f1d16;--rule:#3a3629;--accent:#e0a06a;--bad:#e08a7f}}",
  "body{margin:0;background:var(--paper);color:var(--ink)}",
  ".bb-card{background:var(--paper-alt);border:1px solid var(--rule);border-radius:.55rem;padding:1rem;margin:1rem auto;max-width:72rem}",
  ".bb-card h1,.bb-card h2{margin:0 0 .6rem;font-size:1.05rem}",
  "table.bb-table{width:100%;border-collapse:collapse;font-size:.95rem}",
  ".bb-table th,.bb-table td{text-align:left;padding:.35rem .5rem;border-bottom:1px solid var(--rule);vertical-align:top}",
  ".bb-table td.num,.bb-table th.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}",
  ".bb-empty{color:var(--ink-soft);font-style:italic}",
  ".bb-error{color:var(--bad)}",
  "code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.85em;word-break:break-all}",
  "@media print{body{background:#fff;color:#000}.bb-card{border-color:#999;break-inside:avoid}}",
].join("");

/** The five characters that would break the document. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

/** Debit and credit sides of one entry: the two halves of a sum that is zero. */
function sidesOf(record: JournalRecord): Sides {
  let debit = 0;
  let credit = 0;
  for (const posting of record.postings) {
    if (posting.amountMinor >= 0) debit += posting.amountMinor;
    else credit -= posting.amountMinor;
  }
  return { debit, credit };
}

/** Totals per unit: a journal may hold more than one. */
function totalsByUnit(records: readonly JournalRecord[]): Map<string, Sides> {
  const totals = new Map<string, Sides>();
  for (const record of records) {
    const sides = sidesOf(record);
    const current = totals.get(record.unit) ?? { debit: 0, credit: 0 };
    totals.set(record.unit, { debit: current.debit + sides.debit, credit: current.credit + sides.credit });
  }
  return totals;
}

/** One row: what was written, when, and the hash that seals it. */
function rowHtml(record: JournalRecord, locale: Locale): string {
  const sides = sidesOf(record);
  const cells = [
    `<td class="num">${String(record.seq)}</td>`,
    `<td><time datetime="${escapeHtml(record.date)}">${escapeHtml(record.date)}</time></td>`,
    `<td>${escapeHtml(record.note)}</td>`,
    `<td>${escapeHtml(t(locale, record.kind))}</td>`,
    `<td class="num">${escapeHtml(formatMinor(sides.debit, record.unit, locale))}</td>`,
    `<td class="num">${escapeHtml(formatMinor(sides.credit, record.unit, locale))}</td>`,
    `<td><code>${escapeHtml(record.id)}</code></td>`,
    `<td><code>${escapeHtml(record.hash)}</code></td>`,
  ];
  return `<tr>${cells.join("")}</tr>`;
}

/** The totals a reader checks: what went in, what came out. */
function totalsHtml(records: readonly JournalRecord[], locale: Locale): string {
  const rows: string[] = [];
  for (const [unit, sides] of totalsByUnit(records)) {
    const cells = [
      `<th scope="row">${escapeHtml(t(locale, "report.total"))} ${escapeHtml(unit)}</th>`,
      `<td class="num">${escapeHtml(formatMinor(sides.debit, unit, locale))}</td>`,
      `<td class="num">${escapeHtml(formatMinor(sides.credit, unit, locale))}</td>`,
      "<td></td><td></td><td></td><td></td><td></td>",
    ];
    rows.push(`<tr>${cells.join("")}</tr>`);
  }
  return rows.join("");
}

/** The table of entries, or the promise that there is none yet. */
function tableHtml(records: readonly JournalRecord[], locale: Locale): string {
  const head = [
    `<th scope="col" class="num">${t(locale, "audit.seq")}</th>`,
    `<th scope="col">${t(locale, "audit.date")}</th>`,
    `<th scope="col">${t(locale, "audit.note")}</th>`,
    `<th scope="col">${t(locale, "audit.kind")}</th>`,
    `<th scope="col" class="num">${t(locale, "report.debit")}</th>`,
    `<th scope="col" class="num">${t(locale, "report.credit")}</th>`,
    "<th scope=\"col\">Entry id</th>",
    `<th scope="col">${t(locale, "audit.hash")}</th>`,
  ].join("");
  if (records.length === 0) return `<p class="bb-empty">${escapeHtml(t(locale, "journal.empty"))}</p>`;
  const body = records.map((record) => rowHtml(record, locale)).join("");
  return [
    `<table class="bb-table"><thead><tr>${head}</tr></thead>`,
    `<tbody>${body}</tbody>`,
    `<tfoot>${totalsHtml(records, locale)}</tfoot></table>`,
  ].join("");
}

/** Title, period and the head hash: the two things a donor compares. */
function headerHtml(options: PublicPageOptions): string {
  const { title, journal, period, unit, locale } = options;
  return [
    '<section class="bb-card">',
    `<h1>${escapeHtml(title)}</h1>`,
    `<p>${escapeHtml(t(locale, "report.period"))}: ${escapeHtml(period)} · ${escapeHtml(unit)}</p>`,
    `<p>${escapeHtml(t(locale, "journal.entries", { count: journal.records.length }))}</p>`,
    `<p>${escapeHtml(t(locale, "audit.head"))}: <code>${escapeHtml(headHash(journal))}</code></p>`,
    "</section>",
  ].join("");
}

/** The note, printed under the table: what the chain proves, and what it does not. */
function noteHtml(options: PublicPageOptions): string {
  const note = options.note;
  if (note === undefined || note.trim() === "") return "";
  return `<section class="bb-card"><h2>${escapeHtml(t(options.locale, "audit.note"))}</h2><p>${escapeHtml(note)}</p></section>`;
}

/** A standalone document: inline CSS, no script, no external resource. */
export function publicPage(options: PublicPageOptions): string {
  const { title, journal, locale } = options;
  return [
    "<!DOCTYPE html>",
    `<html lang="${escapeHtml(locale)}">`,
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    `<style>${CSS}</style>`,
    "</head>",
    "<body>",
    headerHtml(options),
    `<section class="bb-card">${tableHtml(journal.records, locale)}</section>`,
    noteHtml(options),
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

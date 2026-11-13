/** Statement import: detect the shape, parse, reject the rest.
 *
 * Everything here is *pure*: same bytes in, same result out. No clock, no RNG, no
 * network, and no float ever reaches an amount — digits are read, never divided.
 * Detection is a heuristic, so it lives in `detectCsv` alone and a caller may pass
 * a confirmed `Detection` back in to skip the guessing.
 */
import type { Entry, Posting } from "./schema.js";
import { sha256Hex } from "./hash.js";
import { LedgerError } from "./journal.js";
import { minorDigits } from "./units.js";

export interface Detection {
  encoding: "utf-8" | "windows-1252"; separator: ";" | "," | "\t"; decimal: "," | ".";
  thousands: " " | "." | "," | null; dateFormat: "DD/MM/YYYY" | "YYYY-MM-DD"; header: string[];
  columns: { date: string; label: string; debit: string | null; credit: string | null; amount: string | null; currency: string | null };
}

export interface RejectedRow { line: number; raw: string; code: "BadDate" | "BadAmount" | "MissingLabel" | "BadColumns"; reason: string }

export interface ImportResult { detection: Detection; entries: Entry[]; rejected: RejectedRow[]; duplicates: number }

export interface ImportOptions {
  accountId: string; debitAccountId: string; creditAccountId: string; unit: string;
  idFactory: (index: number) => string; existingEvidence?: readonly string[]; detection?: Detection;
}

type Encoding = Detection["encoding"];
type Separator = Detection["separator"];
type Decimal = Detection["decimal"];
type Thousands = Detection["thousands"];
type DateFormat = Detection["dateFormat"];
type Columns = Detection["columns"];
type Role = "date" | "label" | "debit" | "credit" | "amount" | "currency";
interface Row { line: number; raw: string; cells: string[] }
interface Context { header: readonly string[]; columns: Columns; detection: Detection; options: ImportOptions }
type RowResult = { ok: true; entry: Entry } | { ok: false; rejected: RejectedRow };

const SEPARATORS: readonly Separator[] = [";", ",", "\t"];
const SAMPLE_LINES = 20;
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const CANDIDATES: Readonly<Record<Decimal, readonly Thousands[]>> = { ",": [" ", "."], ".": [" ", ","] };

/** BOM wins; otherwise a fatal UTF-8 decode decides, windows-1252 is the fallback. */
function decode(bytes: Uint8Array): { text: string; encoding: Encoding } {
  const bom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  if (bom) return { text: new TextDecoder("utf-8").decode(bytes.subarray(3)), encoding: "utf-8" };
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), encoding: "utf-8" };
  } catch {
    return { text: new TextDecoder("windows-1252").decode(bytes), encoding: "windows-1252" };
  }
}

function pushRow(rows: Row[], line: number, raw: string, cells: string[]): void {
  if (!cells.every((cell) => cell.trim() === "")) rows.push({ line, raw: raw.replace(/\r+$/, ""), cells });
}

/** RFC4180-ish tokenizer: a quoted field keeps its separator, newline and quotes. */
function records(text: string, separator: string): Row[] {
  const rows: Row[] = [];
  let cells: string[] = [], cell = "", rawStart = 0, line = 1, rowStart = 1, quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index]!;
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { cell += '"'; index++; }
      else if (char === '"') quoted = false;
      else { if (char === "\n") line++; cell += char; }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === separator) { cells.push(cell); cell = ""; }
    else if (char === "\n") {
      cells.push(cell);
      pushRow(rows, rowStart, text.slice(rawStart, index), cells);
      cells = []; cell = ""; rawStart = index + 1; rowStart = ++line;
    } else if (char !== "\r") cell += char;
  }
  if (cell !== "" || cells.length > 0) { cells.push(cell); pushRow(rows, rowStart, text.slice(rawStart), cells); }
  return rows;
}

/** How stable the field count is for one separator over the first 20 lines. */
function separatorScore(text: string, separator: Separator): number {
  const counts = new Map<number, number>();
  for (const row of records(text, separator).slice(0, SAMPLE_LINES)) {
    counts.set(row.cells.length, (counts.get(row.cells.length) ?? 0) + 1);
  }
  let modal = 0, stable = 0;
  for (const [count, seen] of counts) if (seen > stable || (seen === stable && count > modal)) { modal = count; stable = seen; }
  return modal >= 2 ? stable * 100 + modal : 0;
}

/** The separator whose field count is the most constant; ties keep `;`, then `,`. */
function pickSeparator(text: string): Separator {
  return SEPARATORS.reduce((best, next) => (separatorScore(text, next) > separatorScore(text, best) ? next : best));
}

/** Case- and accent-insensitive, punctuation-free: "Libellé" -> "libelle". */
function fold(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

const ROLES: readonly (readonly [Role, readonly string[]])[] = [
  ["credit", ["credit", "deposit", "versement", "encaissement", "recette"]],
  ["debit", ["debit", "withdraw", "retrait", "sortie", "depense"]],
  ["currency", ["devise", "currency", "monnaie"]],
  ["amount", ["montant", "amount", "valeur", "somme", "total"]],
  ["date", ["date"]],
  ["label", ["libell", "label", "intitul", "descript", "memo", "wording", "operation", "nature", "detail"]],
];

function roleOf(cell: string): Role | null {
  const folded = fold(cell);
  for (const [role, words] of ROLES) if (words.some((word) => folded.includes(word))) return role;
  return null;
}

function detectColumns(header: readonly string[]): Columns {
  const found = new Map<Role, string>();
  for (const cell of header) {
    const role = roleOf(cell);
    if (role !== null && !found.has(role)) found.set(role, cell);
  }
  const pick = (role: Role): string | null => found.get(role) ?? null;
  const detail = { header: [...header] };
  if (!found.has("date")) throw new LedgerError("NotBalanced", "no date column in the header", detail);
  if (!found.has("label")) throw new LedgerError("NotBalanced", "no label column in the header", detail);
  if (!found.has("amount") && !found.has("debit") && !found.has("credit")) {
    throw new LedgerError("NotBalanced", "no amount, debit or credit column in the header", detail);
  }
  return { date: pick("date")!, label: pick("label")!, debit: pick("debit"), credit: pick("credit"), amount: pick("amount"), currency: pick("currency") };
}

const escape = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Integer minor units, or null. `(123,45)` is negative, `-12,50` too, zero stays zero. */
function parseMoney(raw: string, decimal: Decimal, thousands: Thousands, scale: number): number | null {
  let text = raw.trim();
  if (text === "") return null;
  let negative = false;
  if (text.startsWith("(") && text.endsWith(")")) { negative = true; text = text.slice(1, -1).trim(); }
  text = text.replace(/[^\d.,\s+-]/g, "").trim();
  if (text.startsWith("-")) { negative = !negative; text = text.slice(1).trim(); }
  else if (text.startsWith("+")) text = text.slice(1).trim();
  if (text === "" || text.endsWith("-") || text.endsWith("+")) return null;
  const group = thousands === null ? null : `(?:\\d{1,3}(?:${escape(thousands)}\\d{3})+)`;
  const head = group === null ? "\\d+" : `(?:${group}|\\d+)`;
  if (!new RegExp(`^${head}(?:${escape(decimal)}\\d{1,2})?$`).test(text)) return null;
  const plain = thousands === null ? text : text.split(thousands).join("");
  const [whole = "", fraction = ""] = plain.split(decimal);
  if (fraction.length > scale) return null;
  const minor = Number(whole) * 10 ** scale + (fraction === "" ? 0 : Number(fraction.padEnd(scale, "0")));
  return Number.isSafeInteger(minor) ? (negative ? -minor : minor) : null;
}

function scoreDecimal(cells: readonly string[], decimal: Decimal): number {
  let score = 0;
  for (const cell of cells) {
    if (!cell.includes(",") && !cell.includes(".")) continue;
    if (CANDIDATES[decimal].some((thousands) => parseMoney(cell, decimal, thousands, 2) !== null)) score++;
  }
  return score;
}

function pickThousands(cells: readonly string[], decimal: Decimal): Thousands {
  let best: Thousands = null, bestHits = 0;
  for (const thousands of CANDIDATES[decimal]) {
    const hits = cells.filter((cell) => cell.includes(thousands)).length;
    if (hits === 0 || hits <= bestHits) continue;
    if (cells.every((cell) => parseMoney(cell, decimal, thousands, 2) !== null)) { best = thousands; bestHits = hits; }
  }
  return best;
}

function detectDecimal(cells: readonly string[]): { decimal: Decimal; thousands: Thousands } {
  const decimal: Decimal = scoreDecimal(cells, ",") >= scoreDecimal(cells, ".") ? "," : ".";
  return { decimal, thousands: pickThousands(cells, decimal) };
}

/** Real calendar day as YYYY-MM-DD, or null: 31/02 is not a date, it is a typo. */
function toIsoDate(value: string, format: DateFormat): string | null {
  const match = (format === "DD/MM/YYYY" ? /^(\d{2})\/(\d{2})\/(\d{4})$/ : /^(\d{4})-(\d{2})-(\d{2})$/).exec(value.trim());
  if (match === null) return null;
  const [year, month, day] = format === "DD/MM/YYYY" ? [match[3]!, match[2]!, match[1]!] : [match[1]!, match[2]!, match[3]!];
  const y = Number(year), m = Number(month), d = Number(day);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const last = m === 2 && leap ? 29 : (MONTH_DAYS[m - 1] ?? 0);
  return m < 1 || m > 12 || d < 1 || d > last ? null : `${year}-${month}-${day}`;
}

function detectDateFormat(rows: readonly Row[], header: readonly string[], name: string): DateFormat {
  const index = header.indexOf(name);
  const values = rows.map((row) => (row.cells[index] ?? "").trim()).filter((value) => value !== "");
  const dayFirst = values.filter((value) => toIsoDate(value, "DD/MM/YYYY") !== null).length;
  const iso = values.filter((value) => toIsoDate(value, "YYYY-MM-DD") !== null).length;
  return dayFirst > 0 && dayFirst >= iso ? "DD/MM/YYYY" : "YYYY-MM-DD";
}

function amountCells(rows: readonly Row[], header: readonly string[], columns: Columns): string[] {
  const indices = [columns.amount, columns.debit, columns.credit]
    .filter((name): name is string => name !== null)
    .map((name) => header.indexOf(name))
    .filter((index) => index >= 0);
  const cells: string[] = [];
  for (const row of rows) {
    for (const index of indices) {
      const cell = (row.cells[index] ?? "").trim();
      if (cell !== "") cells.push(cell);
    }
  }
  return cells;
}

function detectFromText(text: string, encoding: Encoding): Detection {
  const separator = pickSeparator(text);
  const rows = records(text, separator);
  const header = (rows[0]?.cells ?? []).map((cell) => cell.trim());
  const columns = detectColumns(header);
  const sample = rows.slice(1, SAMPLE_LINES + 1);
  const { decimal, thousands } = detectDecimal(amountCells(sample, header, columns));
  return { encoding, separator, decimal, thousands, dateFormat: detectDateFormat(sample, header, columns.date), header, columns };
}

export function detectCsv(bytes: Uint8Array): Detection {
  const decoded = decode(bytes);
  return detectFromText(decoded.text, decoded.encoding);
}

function rowAmount(cells: readonly string[], context: Context): number | null {
  const { header, columns, detection, options } = context;
  const scale = minorDigits(options.unit);
  const at = (name: string | null): string => (name === null ? "" : (cells[header.indexOf(name)] ?? "")).trim();
  const money = (value: string): number | null => (value === "" ? 0 : parseMoney(value, detection.decimal, detection.thousands, scale));
  if (columns.amount !== null) return at(columns.amount) === "" ? null : money(at(columns.amount));
  if (at(columns.debit) === "" && at(columns.credit) === "") return null;
  const debit = money(at(columns.debit)), credit = money(at(columns.credit));
  return debit === null || credit === null ? null : credit - debit;
}

function buildRow(row: Row, context: Context, index: number): RowResult {
  const reject = (code: RejectedRow["code"], reason: string): RowResult =>
    ({ ok: false, rejected: { line: row.line, raw: row.raw, code, reason } });
  const { header, columns, detection, options } = context;
  if (row.cells.length !== header.length) return reject("BadColumns", `expected ${header.length} fields, found ${row.cells.length}`);
  const at = (name: string | null): string => (name === null ? "" : (row.cells[header.indexOf(name)] ?? ""));
  const label = at(columns.label).trim().slice(0, 200);
  if (label === "") return reject("MissingLabel", "label is empty");
  const rawDate = at(columns.date);
  const date = toIsoDate(rawDate, detection.dateFormat);
  if (date === null) return reject("BadDate", `unreadable date "${rawDate.trim()}" for ${detection.dateFormat}`);
  const amount = rowAmount(row.cells, context);
  if (amount === null) return reject("BadAmount", `unreadable amount "${[columns.amount, columns.debit, columns.credit].map(at).join(" ")}"`);
  if (amount === 0) return reject("BadAmount", "amount is zero");
  const id = options.idFactory(index);
  const evidence = sha256Hex(row.raw);
  const posting = (suffix: string, accountId: string, amountMinor: number): Posting =>
    ({ id: `${id}:${suffix}`, accountId, amountMinor, unit: options.unit, evidence: [evidence] });
  const postings = amount > 0
    ? [posting("1", options.accountId, amount), posting("2", options.creditAccountId, -amount)]
    : [posting("1", options.debitAccountId, -amount), posting("2", options.accountId, amount)];
  return { ok: true, entry: { id, date, note: label, unit: options.unit, kind: "transaction", reverses: null, tags: [], postings } };
}

/** Parse a whole statement. Bad rows are data, not exceptions: they land in `rejected`. */
export function importStatement(bytes: Uint8Array, options: ImportOptions): ImportResult {
  const decoded = decode(bytes);
  const detection = options.detection ?? detectFromText(decoded.text, decoded.encoding);
  const context: Context = { header: detection.header, columns: detection.columns, detection, options };
  const known = new Set(options.existingEvidence ?? []);
  const entries: Entry[] = [], rejected: RejectedRow[] = [];
  let duplicates = 0;
  for (const row of records(decoded.text, detection.separator).slice(1)) {
    if (known.has(sha256Hex(row.raw))) { duplicates++; continue; }
    const result = buildRow(row, context, entries.length);
    if (result.ok) entries.push(result.entry);
    else rejected.push(result.rejected);
  }
  return { detection, entries, rejected, duplicates };
}
/** Reports: pure folds on the journal and the chart. No clock, no randomness, no I/O.
 *
 * A report is a *view*: it recomputes from the append-only journal every time, so
 * it can never disagree with the records it was built from.
 */
import type { Journal, Report } from "./schema.js";
import type { Chart } from "./chart.js";
import { balances } from "./ledger.js";
import { GENESIS } from "./hash.js";

export interface Range { from: string; to: string; unit: string }

type TrialBalance = Extract<Report, { kind: "trial-balance" }>;
type IncomeStatement = Extract<Report, { kind: "income-statement" }>;
type AuditTrail = Extract<Report, { kind: "audit-trail" }>;
type Row = TrialBalance["rows"][number];

const PNL: ReadonlySet<string> = new Set(["income", "expense"]);

/** One row per account with a non-zero signed amount, sorted by account id. */
function rowsFrom(amounts: Map<string, number>, chart: Chart): Row[] {
  const rows: Row[] = [];
  for (const accountId of [...amounts.keys()].sort()) {
    const balance = amounts.get(accountId) ?? 0;
    if (balance === 0) continue;
    rows.push({
      accountId,
      label: chart.get(accountId)?.label ?? accountId,
      debit: balance > 0 ? balance : 0,
      credit: balance < 0 ? -balance : 0,
      balance,
    });
  }
  return rows;
}

/** Signed movements of income and expense accounts only: dates inclusive, one unit. */
function pnlMovements(journal: Journal, chart: Chart, range: Range): Map<string, number> {
  const amounts = new Map<string, number>();
  for (const record of journal.records) {
    if (record.date < range.from || record.date > range.to) continue;
    for (const posting of record.postings) {
      if (posting.unit !== range.unit) continue;
      const account = chart.get(posting.accountId);
      if (!account || !PNL.has(account.type)) continue;
      const previous = amounts.get(posting.accountId) ?? 0;
      amounts.set(posting.accountId, previous + posting.amountMinor);
    }
  }
  return amounts;
}

/** Income positive when credited, expense positive when debited; net = income - expense. */
function netFrom(amounts: Map<string, number>, chart: Chart): number {
  let net = 0;
  for (const [accountId, amount] of amounts) {
    const account = chart.get(accountId);
    if (!account) continue;
    const normal = account.normalBalance === "debit" ? amount : -amount;
    net += account.type === "income" ? normal : -normal;
  }
  return net;
}

/** Trial balance: every non-zero account balance, split into debit and credit columns.
 * `totals.debit === totals.credit` is the double-entry invariant, not a coincidence.
 */
export function trialBalance(
  journal: Journal,
  chart: Chart,
  options: { asOf: string; unit: string },
): TrialBalance {
  const rows = rowsFrom(balances(journal, { asOf: options.asOf, unit: options.unit }), chart);
  let debit = 0;
  let credit = 0;
  for (const row of rows) {
    debit += row.debit;
    credit += row.credit;
  }
  return { kind: "trial-balance", asOf: options.asOf, unit: options.unit, rows, totals: { debit, credit } };
}

/** Income statement: movements of income and expense accounts inside [from, to]. */
export function incomeStatement(journal: Journal, chart: Chart, options: Range): IncomeStatement {
  const amounts = pnlMovements(journal, chart, options);
  return {
    kind: "income-statement",
    from: options.from,
    to: options.to,
    unit: options.unit,
    rows: rowsFrom(amounts, chart),
    netMinor: netFrom(amounts, chart),
  };
}

/** Audit trail: the hashed records themselves, plus the head hash you publish.
 * An empty selection has no head: it is GENESIS, exactly like an empty journal.
 */
export function auditTrail(journal: Journal, options: { from: string; to: string }): AuditTrail {
  const rows: AuditTrail["rows"] = [];
  for (const record of journal.records) {
    if (record.date < options.from || record.date > options.to) continue;
    rows.push({
      seq: record.seq,
      date: record.date,
      note: record.note,
      kind: record.kind,
      hash: record.hash,
      reverses: record.reverses,
    });
  }
  const last = rows.at(-1);
  return {
    kind: "audit-trail",
    from: options.from,
    to: options.to,
    headHash: last === undefined ? GENESIS : last.hash,
    rows,
  };
}
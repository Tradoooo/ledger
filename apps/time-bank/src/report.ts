/** The monthly report of the time bank: hours given and received, per member.
 *
 * The core folds the balances; this folds the very same postings by month — a
 * report of the application, not a new law in the core.
 */
import type { Journal } from "@ledger/core";
import { UNIT } from "./ledger.config";
import { periodOf } from "./format";

export interface MemberRef {
  readonly accountId: string;
  readonly label: string;
}

export interface MemberMonth {
  readonly accountId: string;
  readonly label: string;
  readonly givenMinor: number;
  readonly receivedMinor: number;
  readonly netMinor: number;
  readonly balanceMinor: number;
}

export interface MonthReport {
  readonly period: string;
  readonly members: readonly MemberMonth[];
}

interface Pair { given: number; received: number }

/** One row per (month, member): given, received, net of the month, balance at its end. */
export function monthlyReport(journal: Journal, members: readonly MemberRef[]): MonthReport[] {
  const buckets = new Map<string, Map<string, Pair>>();
  for (const record of journal.records) {
    const period = periodOf(record.date);
    let bucket = buckets.get(period);
    if (bucket === undefined) {
      bucket = new Map();
      buckets.set(period, bucket);
    }
    for (const posting of record.postings) {
      const pair = bucket.get(posting.accountId) ?? { given: 0, received: 0 };
      if (posting.amountMinor > 0) pair.given += posting.amountMinor;
      else pair.received -= posting.amountMinor;
      bucket.set(posting.accountId, pair);
    }
  }
  const cumulative = new Map<string, Pair>();
  return [...buckets.keys()].sort().map((period) => {
    const bucket = buckets.get(period);
    const rows = members.map((member) => {
      const pair = bucket?.get(member.accountId) ?? { given: 0, received: 0 };
      const sum = cumulative.get(member.accountId) ?? { given: 0, received: 0 };
      sum.given += pair.given;
      sum.received += pair.received;
      cumulative.set(member.accountId, sum);
      return {
        accountId: member.accountId,
        label: member.label,
        givenMinor: pair.given,
        receivedMinor: pair.received,
        netMinor: pair.given - pair.received,
        balanceMinor: sum.received - sum.given,
      };
    });
    return { period, members: rows };
  });
}



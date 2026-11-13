/** The brief's example, ready to load: Marta gives 3 h to Ali in March, then Ali
 * gives 1 h back to Marta in April. Deterministic ids: no clock, no randomness. */
import { toMinor, ulidFrom } from "@ledger/core";
import type { Entry, Posting } from "@ledger/core";
import { MEMBERS, UNIT } from "./ledger.config";

const BASE_MS = 1_772_000_000_000; // 2026-03-01, fixed: the example never reads the clock

/** The two entries of the brief, in March and April. */
export function exampleEntries(count: number): Entry[] {
  const marta = MEMBERS[0];
  const ali = MEMBERS[1];
  if (marta === undefined || ali === undefined) return [];
  const plans: readonly { from: string; to: string; toLabel: string; hours: number; date: string }[] = [
    { from: marta.accountId, to: ali.accountId, toLabel: ali.label, hours: 3, date: "2026-03-15" },
    { from: ali.accountId, to: marta.accountId, toLabel: marta.label, hours: 1, date: "2026-04-10" },
  ];
  return plans.map((plan, index) => {
    const id = ulidFrom(BASE_MS + index, new Array<number>(10).fill((count + index + 1) % 256));
    const minor = toMinor(plan.hours, UNIT);
    const postings: Posting[] = [
      { id: `${id}-g`, accountId: plan.from, amountMinor: minor, unit: UNIT },
      { id: `${id}-r`, accountId: plan.to, amountMinor: -minor, unit: UNIT },
    ];
    const entry: Entry = {
      id, date: plan.date, note: `${plan.hours} h given to ${plan.toLabel}`, unit: UNIT,
      kind: "transaction", reverses: null, tags: ["example"], postings,
    };
    return entry;
  });
}

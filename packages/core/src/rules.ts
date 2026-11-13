/** Rules: extension point #2. A rule *proposes* a posting; it never writes one.
 *
 * Matching is pure and total: a bad regex is a non-match, never an exception.
 * Splitting is conservative: the legs always sum to the amount, to the minor unit.
 */
import type { Rule } from "./schema.js";
import { Rule as RuleSchema } from "./schema.js";
import { deepFreeze, LedgerError } from "./journal.js";

/** Guards against a pathological pattern or a huge memo. Bounded on purpose. */
const MAX_PATTERN_LENGTH = 200;
const MAX_HAYSTACK_LENGTH = 2000;

export type RuleInput = Omit<Rule, "origin" | "uses"> & Partial<Pick<Rule, "origin" | "uses">>;

export interface RuleSet {
  readonly rules: readonly Rule[];
}

export type MatchRow = { memo: string; amountMinor: number };

/** Validate every rule (zod applies the defaults), refuse duplicate ids, freeze. */
export function defineRules(inputs: readonly RuleInput[]): RuleSet {
  const seen = new Set<string>();
  const rules = inputs.map((input) => {
    const rule = RuleSchema.parse({ ...input, origin: input.origin ?? "authored", uses: input.uses ?? 0 });
    if (seen.has(rule.id)) {
      throw new LedgerError("DuplicateEntry", `rule ${rule.id} is declared twice`, { ruleId: rule.id });
    }
    seen.add(rule.id);
    return rule;
  });
  return deepFreeze({ rules });
}

/** `amountBetween`, when present, filters on the magnitude of the amount (inclusive). */
function amountHits(rule: Rule, amountMinor: number): boolean {
  const range = rule.when.amountBetween;
  if (range === undefined) return true;
  const low = Math.min(range[0], range[1]);
  const high = Math.max(range[0], range[1]);
  const value = Math.abs(amountMinor);
  return value >= low && value <= high;
}

function regexHits(pattern: string, text: string): boolean {
  if (pattern.length > MAX_PATTERN_LENGTH) return false;
  try {
    return new RegExp(pattern).test(text.slice(0, MAX_HAYSTACK_LENGTH));
  } catch {
    return false; // an invalid pattern simply does not match
  }
}

function textHits(rule: Rule, memo: string): boolean {
  const haystack = memo.slice(0, MAX_HAYSTACK_LENGTH);
  const needle = rule.when.value;
  switch (rule.when.op) {
    case "contains":
      return haystack.toLowerCase().includes(needle.toLowerCase());
    case "equals":
      return haystack.toLowerCase() === needle.toLowerCase();
    case "startsWith":
      return haystack.startsWith(needle);
    case "regex":
      return regexHits(needle, memo);
  }
}

/** First rule that matches, in declaration order. Only `memo` is matchable today. */
export function matchRules(set: RuleSet, row: MatchRow): Rule | undefined {
  return set.rules.find(
    (rule) => rule.when.field === "memo" && amountHits(rule, row.amountMinor) && textHits(rule, row.memo),
  );
}

/** Proportional split that never loses a minor unit; the remainder lands on the first leg. */
export function splitAmount(totalMinor: number, weights: readonly number[]): number[] {
  if (weights.length === 0) return totalMinor === 0 ? [] : [totalMinor];
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (!(totalWeight > 0)) return weights.map((_, index) => (index === 0 ? totalMinor : 0));
  const sign = totalMinor < 0 ? -1 : 1;
  const magnitude = Math.abs(totalMinor);
  const parts = weights.map((weight) => Math.floor((magnitude * weight) / totalWeight));
  const allocated = parts.reduce((sum, part) => sum + part, 0);
  parts[0] = (parts[0] ?? 0) + (magnitude - allocated);
  return parts.map((part) => sign * part);
}

/** The legs a rule proposes for a total: its split if it has one, else a single leg. */
export function applySplit(rule: Rule, totalMinor: number): { accountId: string; amountMinor: number }[] {
  const split = rule.then.split;
  if (split === undefined || split.length === 0) {
    return [{ accountId: rule.then.accountId, amountMinor: totalMinor }];
  }
  const amounts = splitAmount(totalMinor, split.map((leg) => leg.weight));
  return split.map((leg, index) => ({ accountId: leg.accountId, amountMinor: amounts[index] ?? 0 }));
}

/** Teaching by example: one `contains` rule, learned once no matter how often seen. */
export function learnRule(set: RuleSet, learned: { id: string; memo: string; accountId: string }): RuleSet {
  const value = learned.memo.slice(0, MAX_PATTERN_LENGTH);
  const known = set.rules.some(
    (rule) =>
      rule.origin === "learned" &&
      rule.when.op === "contains" &&
      rule.when.value === value &&
      rule.then.accountId === learned.accountId,
  );
  if (known) return set;
  const fresh: RuleInput = {
    id: learned.id,
    when: { field: "memo", op: "contains", value },
    then: { accountId: learned.accountId },
    origin: "learned",
    frequency: "on-import",
    uses: 0,
  };
  return defineRules([...set.rules, fresh]);
}
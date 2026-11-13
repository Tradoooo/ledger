import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { LedgerError } from "./journal.js";
import type { Rule } from "./schema.js";
import { applySplit, defineRules, learnRule, matchRules, splitAmount, type RuleInput, type RuleSet } from "./rules.js";

const SEED = 20261113;
const MEMO = "memo";
const FOOD = "expenses:food";
const RENT = "expenses:rent";

const codeOf = (fn: () => unknown): string => {
  try {
    fn();
    return "no-error";
  } catch (error) {
    return error instanceof LedgerError ? error.code : "not-a-ledger-error";
  }
};

const rule = (id: string, when: RuleInput["when"], then: RuleInput["then"], extra: Partial<RuleInput> = {}): RuleInput => ({
  id,
  when,
  then,
  frequency: "on-import",
  ...extra,
});

/** A rule input as a caller would write it: zod supplies the defaults. */
const raw = (value: unknown): RuleInput => value as RuleInput;

const contains = (id: string, value: string, accountId = FOOD, extra: Partial<RuleInput> = {}): RuleInput =>
  rule(id, { field: "memo", op: "contains", value }, { accountId }, extra);

const only = (inputs: readonly RuleInput[]): RuleSet => defineRules(inputs);

describe("defineRules", () => {
  it("applies the defaults: on-import, uses 0, origin authored", () => {
    const set = only([raw({ id: "r1", when: { field: "memo", op: "contains", value: "loyer" }, then: { accountId: RENT } })]);
    const [first] = set.rules;
    expect(first).toMatchObject({ id: "r1", frequency: "on-import", uses: 0, origin: "authored" });
  });

  it("keeps declaration order and deep-freezes the set", () => {
    const set = only([contains("r1", "a"), contains("r2", "b")]);
    expect(set.rules.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(Object.isFrozen(set)).toBe(true);
    expect(Object.isFrozen(set.rules)).toBe(true);
    expect(Object.isFrozen(set.rules[0])).toBe(true);
    expect(() => {
      (set.rules[0] as { id: string }).id = "edited";
    }).toThrow();
  });

  it("refuses two rules with the same id", () => {
    expect(codeOf(() => only([contains("dup", "a"), contains("dup", "b")]))).toBe("DuplicateEntry");
  });

  it("accepts an empty set", () => {
    expect(only([]).rules).toEqual([]);
  });
});

describe("matchRules: text operators", () => {
  it("contains is case-insensitive", () => {
    const set = only([contains("r1", "CARREFOUR", FOOD)]);
    expect(matchRules(set, { memo: "carte carrefour market", amountMinor: -1200 })?.id).toBe("r1");
  });

  it("equals compares the whole memo, case-insensitively", () => {
    const set = only([rule("r1", { field: "memo", op: "equals", value: "Loyer" }, { accountId: RENT })]);
    expect(matchRules(set, { memo: "loyer", amountMinor: 0 })?.id).toBe("r1");
    expect(matchRules(set, { memo: "loyer octobre", amountMinor: 0 })).toBeUndefined();
  });

  it("startsWith is case-sensitive and anchored at the front", () => {
    const set = only([rule("r1", { field: "memo", op: "startsWith", value: "CB " }, { accountId: FOOD })]);
    expect(matchRules(set, { memo: "CB 1234", amountMinor: 0 })?.id).toBe("r1");
    expect(matchRules(set, { memo: "cb 1234", amountMinor: 0 })).toBeUndefined();
    expect(matchRules(set, { memo: "paiement CB 1234", amountMinor: 0 })).toBeUndefined();
  });

  it("amountBetween filters on the magnitude of the amount", () => {
    const set = only([
      rule("r1", { field: "memo", op: "contains", value: "sncf", amountBetween: [1000, 5000] }, { accountId: FOOD }),
    ]);
    expect(matchRules(set, { memo: "SNCF billet", amountMinor: -2000 })?.id).toBe("r1");
    expect(matchRules(set, { memo: "SNCF billet", amountMinor: 5000 })?.id).toBe("r1");
    expect(matchRules(set, { memo: "SNCF billet", amountMinor: -6000 })).toBeUndefined();
  });

  it("ignores rules on a field it has no data for", () => {
    const set = only([rule("r1", { field: "party", op: "contains", value: "sncf" }, { accountId: FOOD })]);
    expect(matchRules(set, { memo: "sncf", amountMinor: 0 })).toBeUndefined();
  });

  it("returns the first match in declaration order", () => {
    const set = only([contains("general", "super", FOOD), contains("specific", "superette", RENT)]);
    expect(matchRules(set, { memo: "superette du coin", amountMinor: 0 })?.id).toBe("general");
  });

  it("never throws on an invalid regex pattern, it just does not match", () => {
    const set = only([rule("r1", { field: "memo", op: "regex", value: "(" }, { accountId: FOOD })]);
    expect(() => matchRules(set, { memo: "anything", amountMinor: 0 })).not.toThrow();
    expect(matchRules(set, { memo: "anything", amountMinor: 0 })).toBeUndefined();
  });

  it("refuses a pattern longer than 200 chars at definition time", () => {
    expect(codeOf(() => only([rule("r1", { field: "memo", op: "regex", value: "a".repeat(201) }, { accountId: FOOD })]))).toBe(
      "not-a-ledger-error",
    );
  });

  it("bounds the pattern to 200 chars and the memo to 2000 chars", () => {
    const base = only([rule("r1", { field: "memo", op: "regex", value: "a" }, { accountId: FOOD })]).rules[0]!;
    const tooLong: RuleSet = { rules: [{ ...base, when: { ...base.when, value: "a".repeat(201) } }] };
    expect(matchRules(tooLong, { memo: "a".repeat(400), amountMinor: 0 })).toBeUndefined();
    const bounded = only([rule("r2", { field: "memo", op: "regex", value: "z" }, { accountId: FOOD })]);
    expect(matchRules(bounded, { memo: `${"a".repeat(2000)}z`, amountMinor: 0 })).toBeUndefined();
    expect(matchRules(bounded, { memo: `z${"a".repeat(2000)}`, amountMinor: 0 })?.id).toBe("r2");
  });

  it("supports a valid regex", () => {
    const set = only([rule("r1", { field: "memo", op: "regex", value: "^loyer \\d{2}/\\d{4}$" }, { accountId: RENT })]);
    expect(matchRules(set, { memo: "loyer 10/2026", amountMinor: 0 })?.id).toBe("r1");
    expect(matchRules(set, { memo: "loyer", amountMinor: 0 })).toBeUndefined();
  });
});

describe("splitAmount", () => {
  it("is conservative and puts the rounding remainder on the first leg", () => {
    expect(splitAmount(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(splitAmount(1, [1, 1])).toEqual([1, 0]);
    expect(splitAmount(0, [2, 1])).toEqual([0, 0]);
  });

  it("handles a negative total by splitting its magnitude", () => {
    expect(splitAmount(-100, [1, 1, 1])).toEqual([-34, -33, -33]);
  });

  it("degrades gracefully on empty or degenerate weights", () => {
    expect(splitAmount(0, [])).toEqual([]);
    expect(splitAmount(25, [])).toEqual([25]);
    expect(splitAmount(25, [0, 0])).toEqual([25, 0]);
  });
});

describe("applySplit", () => {
  it("uses a single leg when the rule has no split", () => {
    const rule0 = only([contains("r1", "x", RENT)]).rules[0]!;
    expect(applySplit(rule0, -9000)).toEqual([{ accountId: RENT, amountMinor: -9000 }]);
  });

  it("uses the rule weights and stays conservative", () => {
    const rule0 = only([
      rule("r1", { field: "memo", op: "contains", value: "courses" }, {
        accountId: FOOD,
        split: [{ accountId: FOOD, weight: 2 }, { accountId: RENT, weight: 1 }],
      }),
    ]).rules[0]!;
    const legs = applySplit(rule0, 1000);
    expect(legs.map((leg) => leg.accountId)).toEqual([FOOD, RENT]);
    expect(legs.map((leg) => leg.amountMinor)).toEqual([667, 333]);
  });
});

describe("learnRule", () => {
  it("adds a learned contains rule", () => {
    const set = learnRule(only([]), { id: "l1", memo: "boulangerie", accountId: FOOD });
    expect(set.rules).toHaveLength(1);
    expect(set.rules[0]).toMatchObject({
      id: "l1",
      origin: "learned",
      frequency: "on-import",
      uses: 0,
      when: { field: "memo", op: "contains", value: "boulangerie" },
      then: { accountId: FOOD },
    });
    expect(matchRules(set, { memo: "BOULANGERIE du coin", amountMinor: -450 })?.id).toBe("l1");
  });

  it("is idempotent: the same pattern and account are learned once", () => {
    const first = learnRule(only([]), { id: "l1", memo: "boulangerie", accountId: FOOD });
    const second = learnRule(first, { id: "l2", memo: "boulangerie", accountId: FOOD });
    expect(second.rules).toHaveLength(1);
    expect(second).toBe(first);
  });

  it("still learns the same pattern for another account", () => {
    const first = learnRule(only([]), { id: "l1", memo: "boulangerie", accountId: FOOD });
    const second = learnRule(first, { id: "l2", memo: "boulangerie", accountId: RENT });
    expect(second.rules.map((r) => r.then.accountId)).toEqual([FOOD, RENT]);
  });

  it("does not treat an authored rule as already learned", () => {
    const authored = only([contains("authored", "boulangerie", FOOD)]);
    const learned = learnRule(authored, { id: "l1", memo: "boulangerie", accountId: FOOD });
    expect(learned.rules).toHaveLength(2);
  });
});

describe("properties", () => {
  const weights = fc.array(fc.integer({ min: 1, max: 1_000 }), { minLength: 2, maxLength: 6 });
  const total = fc.integer({ min: -100_000_000, max: 100_000_000 });

  it("property: splitAmount sums to the total, with parts of the total's sign", () => {
    fc.assert(
      fc.property(total, weights, (amount, legs) => {
        const parts = splitAmount(amount, legs);
        expect(parts).toHaveLength(legs.length);
        expect(parts.reduce((sum, part) => sum + part, 0)).toBe(amount);
        for (const part of parts) expect(part * amount).toBeGreaterThanOrEqual(0);
      }),
      { seed: SEED },
    );
  });

  const legArb = fc.record({ accountId: fc.constantFrom(FOOD, RENT, "assets:bank"), weight: fc.integer({ min: 1, max: 1_000 }) });
  const splitArb = fc.option(fc.array(legArb, { minLength: 1, maxLength: 5 }), { nil: undefined });

  const ruleWith = (split: readonly { accountId: string; weight: number }[] | undefined): Rule => {
    const then: RuleInput["then"] = split === undefined ? { accountId: FOOD } : { accountId: FOOD, split: [...split] };
    return defineRules([rule("r1", { field: "memo", op: "contains", value: "x" }, then)]).rules[0]!;
  };

  it("property: applySplit is conservative for any rule and any total", () => {
    fc.assert(
      fc.property(total, splitArb, (amount, split) => {
        const r = ruleWith(split);
        const legs = applySplit(r, amount);
        expect(legs.reduce((sum, leg) => sum + leg.amountMinor, 0)).toBe(amount);
        expect(legs).toHaveLength(r.then.split?.length ?? 1);
        for (const leg of legs) expect(leg.accountId).toMatch(/^[a-z][a-z0-9]*(?::[a-z0-9-]+)*$/);
      }),
      { seed: SEED },
    );
  });

  const memoArb = fc.string({ maxLength: 40 });
  const keyword = fc.constantFrom("loyer", "Loyer", "cafe", "SNCF", "super", "a", "");
  const learningArb = fc.array(fc.tuple(keyword, fc.constantFrom(FOOD, RENT)), { minLength: 1, maxLength: 5 });

  it("property: matchRules always returns the first matching rule, in order", () => {
    fc.assert(
      fc.property(memoArb, fc.integer({ min: -50_000, max: 50_000 }), learningArb, (memo, amount, learned) => {
        const set = only(learned.map(([value, accountId], index) => contains(`r${index}`, value, accountId)));
        const expected = set.rules.find((r) => memo.toLowerCase().includes(r.when.value.toLowerCase()));
        expect(matchRules(set, { memo, amountMinor: amount })).toBe(expected);
      }),
      { seed: SEED },
    );
  });

  const nasty = fc.oneof(fc.constantFrom("(", "[a-", "*", "\\", "+", "a{3,1}", "(?<", "a+)+*"), fc.string({ maxLength: 12 }));
  const haystack = fc.string({ maxLength: 60 });

  it("property: an invalid regex never throws, it simply does not match", () => {
    fc.assert(
      fc.property(nasty, haystack, (pattern, memo) => {
        const set = only([
          rule("r1", { field: "memo", op: "regex", value: pattern.slice(0, 200) }, { accountId: FOOD }),
        ]);
        const found = matchRules(set, { memo, amountMinor: 0 });
        expect(found === undefined || found.id === "r1").toBe(true);
        if (pattern.length > 0) {
          let expected = false;
          try {
            expected = new RegExp(pattern).test(memo.slice(0, 2000));
          } catch {
            expected = false;
          }
          expect(found !== undefined).toBe(expected);
        }
      }),
      { seed: SEED },
    );
  });
});

describe("the set is data", () => {
  it("a learned set is frozen too", () => {
    const set = learnRule(only([]), { id: "l1", memo: MEMO, accountId: FOOD });
    expect(Object.isFrozen(set)).toBe(true);
    expect(Object.isFrozen(set.rules[0])).toBe(true);
  });
});
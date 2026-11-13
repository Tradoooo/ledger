/** The ledger contract: shapes only.
 *
 * Zod validates *shape* (types, patterns, ranges). The *laws* of double entry
 * (sum to zero, one unit per entry, reversal consistency) live in journal.ts and
 * raise typed `LedgerError`s, so that property tests can exercise them instead of
 * catching a ZodError. See .kiro/steering/accounting.md.
 */
import { z } from "zod";

const SafeInt = z.number().int().refine(Number.isSafeInteger, { message: "must be a safe integer" });

export const UnitCode = z.string().regex(/^[A-Z]{3}$/, "unit code is 3 upper-case letters");
export const AccountId = z.string().regex(/^[a-z][a-z0-9]*(?::[a-z0-9-]+)*$/, "account id is a:b:c");
export const EntryId = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, "entry id is a ULID");
export const HashHex = z.string().regex(/^[0-9a-f]{64}$/, "hash is 64 lower-case hex chars");
export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date is YYYY-MM-DD");
export const Period = z.string().regex(/^\d{4}-\d{2}$/, "period is YYYY-MM");
export const MinorUnits = SafeInt;
export const AccountType = z.enum(["asset", "liability", "equity", "income", "expense"]);
export const NormalSide = z.enum(["debit", "credit"]);
export const EntryKind = z.enum(["transaction", "opening", "reversal", "conversion"]);

export const Unit = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("currency"), code: z.string().regex(/^[A-Z]{3}$/) }),
  z.strictObject({ kind: z.literal("quantity"), label: z.string().min(1).max(24) }),
]);

export const Account = z.strictObject({
  id: AccountId,
  type: AccountType,
  normalBalance: NormalSide,
  unit: Unit,
  label: z.string().min(1).max(120),
  parent: AccountId.nullable().default(null),
  archived: z.boolean().default(false),
  daily: z.boolean().default(false),
});

export const PartyRef = z.strictObject({
  id: z.string().min(1),
  label: z.string().max(120),
  publicLabel: z.string().max(120),
  disclosed: z.boolean().default(false),
});

export const Posting = z.strictObject({
  id: z.string().min(1),
  accountId: AccountId,
  amountMinor: MinorUnits,
  unit: UnitCode,
  memo: z.string().max(200).optional(),
  party: PartyRef.optional(),
  evidence: z.array(z.string()).optional(),
});

export const Entry = z.strictObject({
  id: EntryId,
  date: IsoDate,
  note: z.string().min(1).max(200),
  unit: UnitCode,
  kind: EntryKind.default("transaction"),
  postings: z.array(Posting),
  reverses: EntryId.nullable().default(null),
  tags: z.array(z.string()).default([]),
});

export const JournalRecord = Entry.extend({ seq: z.number().int().nonnegative(), prevHash: HashHex, hash: HashHex });

export const Journal = z.strictObject({
  version: z.literal(1),
  createdAt: IsoDate,
  records: z.array(JournalRecord),
});

export const Rule = z.strictObject({
  id: z.string().min(1),
  when: z.strictObject({
    field: z.enum(["memo", "party", "reference"]).default("memo"),
    op: z.enum(["contains", "equals", "startsWith", "regex"]),
    value: z.string().max(200),
    amountBetween: z.tuple([MinorUnits, MinorUnits]).optional(),
  }),
  then: z.strictObject({
    accountId: AccountId,
    envelopeId: z.string().optional(),
    note: z.string().max(200).optional(),
    split: z.array(z.strictObject({ accountId: AccountId, weight: z.number().int().min(1) })).optional(),
  }),
  frequency: z.enum(["on-import", "weekly", "monthly", "once"]).default("on-import"),
  origin: z.enum(["authored", "learned"]),
  uses: z.number().int().nonnegative().default(0),
  confidence: z.number().min(0).max(1).optional(),
});

export const Envelope = z.strictObject({
  id: z.string().min(1),
  label: z.string().min(1).max(80),
  accountId: AccountId,
  period: Period,
  budgetMinor: SafeInt,
  rollover: z.enum(["none", "carry", "carry-deficit"]).default("carry"),
  capMinor: SafeInt.nullable().default(null),
  unit: UnitCode,
});

const Row = z.strictObject({
  accountId: AccountId, label: z.string(), debit: MinorUnits, credit: MinorUnits, balance: MinorUnits,
});
const EnvelopeRow = z.strictObject({
  envelopeId: z.string(), label: z.string(), budgetMinor: MinorUnits, spentMinor: MinorUnits,
  carriedMinor: MinorUnits, availableMinor: MinorUnits, leftTodayMinor: MinorUnits,
});
const AuditRow = z.strictObject({
  seq: z.number().int(), date: IsoDate, note: z.string(), kind: EntryKind, hash: HashHex,
  reverses: EntryId.nullable(),
});

export const Report = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("trial-balance"), asOf: IsoDate, unit: UnitCode, rows: z.array(Row),
    totals: z.strictObject({ debit: MinorUnits, credit: MinorUnits }),
  }),
  z.strictObject({
    kind: z.literal("income-statement"), from: IsoDate, to: IsoDate, unit: UnitCode,
    rows: z.array(Row), netMinor: MinorUnits,
  }),
  z.strictObject({
    kind: z.literal("envelopes"), period: Period, unit: UnitCode,
    totalLeftTodayMinor: MinorUnits, daysLeft: z.number().int().nonnegative(), rows: z.array(EnvelopeRow),
  }),
  z.strictObject({
    kind: z.literal("audit-trail"), from: IsoDate, to: IsoDate, headHash: HashHex, rows: z.array(AuditRow),
  }),
]);

export const RedactionPolicy = z.strictObject({
  parties: z.enum(["named", "pseudonymised", "aggregate"]),
  dates: z.enum(["exact", "month"]),
  amounts: z.enum(["exact", "bucket10"]),
  memo: z.enum(["as-is", "whitelist"]),
  minGroupSize: z.number().int().min(1).default(3),
});

export const ViewName = z.enum(["trial-balance", "income-statement", "envelopes", "audit-trail", "public-ledger"]);

export const View = z.strictObject({
  v: z.literal(1),
  app: z.string().min(1).max(40), // the core does not know the applications it serves
  report: ViewName,
  params: z.strictObject({
    from: IsoDate.optional(), to: IsoDate.optional(), period: Period.optional(),
    accounts: z.array(AccountId).default([]), tags: z.array(z.string()).default([]),
  }),
  redaction: RedactionPolicy.optional(),
});

export type Unit = z.infer<typeof Unit>;
export type Account = z.infer<typeof Account>;
export type PartyRef = z.infer<typeof PartyRef>;
export type Posting = z.infer<typeof Posting>;
export type EntryKind = z.infer<typeof EntryKind>;
export type Entry = z.infer<typeof Entry>;
export type JournalRecord = z.infer<typeof JournalRecord>;
export type Journal = z.infer<typeof Journal>;
export type Rule = z.infer<typeof Rule>;
export type Envelope = z.infer<typeof Envelope>;
export type Report = z.infer<typeof Report>;
export type RedactionPolicy = z.infer<typeof RedactionPolicy>;
export type ViewName = z.infer<typeof ViewName>;
export type View = z.infer<typeof View>;
export type AccountType = z.infer<typeof AccountType>;
export type NormalSide = z.infer<typeof NormalSide>;

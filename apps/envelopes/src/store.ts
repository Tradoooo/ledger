/** Persistance locale : le livre, ses règles apprises, ses affectations (rien ne quitte le navigateur). */
import { append, createJournal, defineRules, learnRule, matchRules } from "@ledger/core";
import type { Entry, Journal, Rule, RuleSet } from "@ledger/core";
import { demoEntries } from "./demo.js";
import { UNASSIGNED_ACCOUNT } from "./ledger.config";

const KEY = "ledger:envelopes:v1";

export interface StoredLedger {
  readonly createdAt: string; readonly entries: readonly Entry[]; readonly rules: readonly Rule[];
  /** Ce que l'utilisateur a confirmé : le journal, lui, n'est jamais retouché. */
  readonly assignments: Readonly<Record<string, string>>;
}

export interface Proposal {
  readonly entryId: string; readonly date: string; readonly note: string; readonly amountMinor: number;
  readonly accountId: string | null; readonly ruleId: string | null; readonly learned: boolean;
}

export type ImportOutcome = { ok: true; stored: StoredLedger; ignored: number } | { ok: false; message: string };

export const todayIso = (): string => new Date().toISOString().slice(0, 10);
const store = (): Storage | undefined => { try { return globalThis.localStorage; } catch { return undefined; } };

const readList = <T,>(value: unknown, shaped: (item: Record<string, unknown>) => boolean): T[] =>
  (Array.isArray(value) ? value : []).filter((item): item is T => shaped(item as Record<string, unknown>));
const isEntry = (c: Record<string, unknown>): boolean =>
  typeof c.id === "string" && typeof c.date === "string" && Array.isArray(c.postings);
const isRule = (c: Record<string, unknown>): boolean =>
  typeof c.id === "string" && typeof c.when === "object" && typeof c.then === "object";

const readAssignments = (value: unknown): Record<string, string> => {
  if (typeof value !== "object" || value === null) return {};
  return Object.fromEntries(Object.entries(value).filter((p): p is [string, string] => typeof p[1] === "string"));
};

export const emptyLedger = (): StoredLedger => ({ createdAt: todayIso(), entries: [], rules: [], assignments: {} });

/** Reconstruit le journal : `createJournal` puis un `append` par écriture, dans l'ordre. */
export function journalFrom(stored: StoredLedger): Journal {
  let journal = createJournal(stored.createdAt);
  for (const entry of stored.entries) {
    try { journal = append(journal, entry); } catch { continue; } // une écriture abîmée ne cache pas les autres
  }
  return journal;
}

/** Ce que lisent les rapports : une affectation confirmée déplace la jambe « à classer ». */
export const assignedJournal = (stored: StoredLedger): Journal => journalFrom({
  ...stored,
  entries: stored.entries.map((entry) => {
    const accountId = stored.assignments[entry.id];
    if (accountId === undefined || accountId === UNASSIGNED_ACCOUNT) return entry;
    const postings = entry.postings.map((p) => (p.accountId === UNASSIGNED_ACCOUNT ? { ...p, accountId } : p));
    return { ...entry, postings };
  }),
});

export function loadLedger(): StoredLedger {
  const local = store();
  if (local === undefined) return emptyLedger();
  try {
    const raw = local.getItem(KEY);
    if (raw === null) return { ...emptyLedger(), entries: demoEntries() };
    const p = JSON.parse(raw) as { createdAt?: unknown; entries?: unknown; rules?: unknown; assignments?: unknown };
    const createdAt = typeof p.createdAt === "string" ? p.createdAt : todayIso();
    const entries = readList<Entry>(p.entries, isEntry);
    return { createdAt, entries, rules: readList<Rule>(p.rules, isRule), assignments: readAssignments(p.assignments) };
  } catch {
    return emptyLedger();
  }
}

export function saveLedger(stored: StoredLedger): void {
  try { store()?.setItem(KEY, JSON.stringify(stored)); } catch { return; } // quota : la mémoire suffit
}

export const withEntries = (stored: StoredLedger, entries: readonly Entry[]): StoredLedger =>
  ({ ...stored, entries: [...stored.entries, ...entries] });

/** Une correction devient une règle (`learnRule`), apprise une fois quel que soit le nombre de clics. */
export function learnFor(stored: StoredLedger, memo: string, accountId: string, id: string): StoredLedger {
  let set = defineRules([]);
  for (const rule of stored.rules) { try { set = defineRules([...set.rules, rule]); } catch { continue; } }
  const grown = learnRule(set, { id: `learned-${id}`, memo, accountId });
  return grown === set ? stored : { ...stored, rules: grown.rules };
}

export const forgetRule = (stored: StoredLedger, ruleId: string): StoredLedger =>
  ({ ...stored, rules: stored.rules.filter((rule) => rule.id !== ruleId) });

/** Enregistre la décision ; une règle apprise confirmée voit son compteur d'usages grandir. */
export function assign(stored: StoredLedger, entryId: string, accountId: string, ruleId: string | null): StoredLedger {
  const assignments = { ...stored.assignments, [entryId]: accountId };
  if (ruleId === null) return { ...stored, assignments };
  const rules = stored.rules.map((rule) => (rule.id === ruleId ? { ...rule, uses: rule.uses + 1 } : rule));
  return { ...stored, assignments, rules };
}

/** Tout ce qui reste sur « à classer », avec le compte que les règles proposent. */
export function proposals(journal: Journal, stored: StoredLedger, authored: RuleSet): Proposal[] {
  const set = defineRules([...stored.rules, ...authored.rules]); // l'apprise passe devant
  return journal.records.flatMap((record) => {
    const leg = record.postings.find((posting) => posting.accountId === UNASSIGNED_ACCOUNT);
    if (leg === undefined || stored.assignments[record.id] !== undefined) return [];
    const match = matchRules(set, { memo: record.note, amountMinor: leg.amountMinor });
    return [{
      entryId: record.id, date: record.date, note: record.note, amountMinor: leg.amountMinor,
      accountId: match?.then.accountId ?? null, ruleId: match?.id ?? null, learned: match?.origin === "learned",
    }];
  });
}

/** Le fichier de sauvegarde : `{ version, createdAt, entries }`, la seule chose qu'un utilisateur garde. */
export const exportJson = (stored: StoredLedger): string =>
  JSON.stringify({ version: 1, createdAt: stored.createdAt, entries: stored.entries }, null, 2);

/** Relit une sauvegarde via `createJournal` + `append` ; un fichier invalide répond une phrase. */
export function importJson(text: string, current: StoredLedger): ImportOutcome {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return { ok: false, message: "Ce fichier n'est pas du JSON lisible : rien n'a changé." }; }
  const p = parsed as { version?: unknown; createdAt?: unknown; entries?: unknown };
  if (p?.version !== 1) return { ok: false, message: "Version de fichier inconnue : ce livre attend la version 1." };
  if (!Array.isArray(p.entries)) return { ok: false, message: "Ce fichier ne contient aucune écriture." };
  const createdAt = typeof p.createdAt === "string" ? p.createdAt : todayIso();
  const kept: Entry[] = [];
  let journal = createJournal(createdAt);
  for (const candidate of readList<Entry>(p.entries, isEntry)) { try { journal = append(journal, candidate); kept.push(candidate); } catch { continue; } }  if (kept.length === 0 && p.entries.length > 0) {
    return { ok: false, message: "Aucune écriture de ce fichier n'est valide : le livre actuel est conservé." };
  }
  const stored = { createdAt, entries: kept, rules: current.rules, assignments: {} };
  return { ok: true, ignored: p.entries.length - kept.length, stored };
}

/** L'écriture que le core vient d'ajouter, sans ses champs de chaîne. */
export function lastEntry(journal: Journal): Entry {
  const record = journal.records.at(-1);
  if (record === undefined) throw new Error("journal vide");
  const { id, date, note, unit, kind, reverses, tags, postings } = record;
  return { id, date, note, unit, kind, reverses, tags, postings };
}

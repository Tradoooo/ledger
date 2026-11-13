#!/usr/bin/env node
/** The refusals the guards made, counted. A discipline is only real if it bit.
 *
 * `node .github/checks/budget-refusals.mjs`                            → the total, per guard
 * `node .github/checks/budget-refusals.mjs --refuse <guard> "<reason>"` → one more refusal, written back
 *
 * The ledger is `docs/budget-refusals.json`; `LEDGER_REFUSALS=<path>` moves it (the CI writes the
 * runner's copy and uploads it as an artefact). A guard that never had to say no proves nothing:
 * this file is the count of the times it did.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const LEDGER = process.env.LEDGER_REFUSALS ?? "docs/budget-refusals.json";
/** The guards whose refusals are counted, and what each one protects. */
const GUARDS = {
  "loc-budget": "the line ceiling (it never goes up)",
  "purity": "the skeleton holds no application concept",
  "fixture-privacy": "fictional data only, no IBAN, no valid card number",
  "url-registry": "three published URLs, one index, one proof page",
  "e2e": "the built site, driven like a visitor",
};
const HISTORY = 50;

const EMPTY = {
  version: 1,
  about: "Every refusal a guard made, counted. Appended by the CI when a guard says no.",
  total: 0,
  guards: {},
  refusals: [],
};

const today = () => new Date().toISOString().slice(0, 19) + "Z";

function load() {
  if (!existsSync(LEDGER)) return { ...EMPTY, guards: {}, refusals: [] };
  const text = readFileSync(LEDGER, "utf8");
  try {
    const parsed = JSON.parse(text);
    return {
      ...EMPTY,
      ...parsed,
      guards: parsed.guards ?? {},
      refusals: Array.isArray(parsed.refusals) ? parsed.refusals : [],
      total: Number(parsed.total ?? 0),
    };
  } catch (cause) {
    console.error(`FAIL ${LEDGER} is not valid JSON: ${cause instanceof Error ? cause.message : String(cause)}`);
    process.exit(1);
  }
}

function save(ledger) {
  mkdirSync(dirname(resolve(LEDGER)), { recursive: true });
  writeFileSync(LEDGER, `${JSON.stringify(ledger, null, 2)}\n`);
}

/** One more refusal: the counter, the guard's counter, and a bounded history. */
function refuse(guard, reason) {
  const ledger = load();
  const at = today();
  const known = ledger.guards[guard] ?? { count: 0, lastAt: null, lastReason: null };
  ledger.total += 1;
  ledger.guards[guard] = { count: known.count + 1, lastAt: at, lastReason: reason };
  ledger.refusals = [...ledger.refusals, { at, guard, reason }].slice(-HISTORY);
  save(ledger);
  return ledger;
}

function report(ledger) {
  const rows = Object.entries(GUARDS).map(([guard, what]) => {
    const known = ledger.guards[guard];
    const count = known?.count ?? 0;
    return { guard, what, count, lastAt: known?.lastAt ?? null, lastReason: known?.lastReason ?? null };
  });
  const unknown = Object.keys(ledger.guards).filter((guard) => !(guard in GUARDS));
  for (const guard of unknown) rows.push({ guard, what: "(guard not declared here)", count: ledger.guards[guard].count, lastAt: ledger.guards[guard].lastAt ?? null, lastReason: ledger.guards[guard].lastReason ?? null });
  console.log(`refusals recorded in ${LEDGER}`);
  console.log("guard             count  last refusal");
  for (const row of rows.sort((a, b) => b.count - a.count || a.guard.localeCompare(b.guard))) {
    console.log(`${row.guard.padEnd(16)} ${String(row.count).padStart(5)}  ${row.lastAt ?? "—"}  ${row.lastReason ?? row.what}`);
  }
  const refused = rows.filter((row) => row.count > 0).length;
  console.log(`\ntotal: ${ledger.total} refusal(s) over ${refused}/${rows.length} guard(s) — the discipline bit ${ledger.total === 0 ? "not yet" : "here"}`);
  if (ledger.refusals.length > 0) {
    const last = ledger.refusals.at(-1);
    console.log(`last: ${last.at} · ${last.guard} · ${last.reason}`);
  }
  return ledger.total;
}

const args = process.argv.slice(2);
const refuseAt = args.indexOf("--refuse");

if (refuseAt !== -1) {
  const guard = args[refuseAt + 1];
  const reason = args.slice(refuseAt + 2).join(" ").trim();
  if (guard === undefined) {
    console.error('usage: node .github/checks/budget-refusals.mjs --refuse <guard> "<reason>"');
    process.exit(1);
  }
  if (!(guard in GUARDS)) console.log(`note   ${guard} is not a declared guard; counted anyway`);
  const ledger = refuse(guard, reason === "" ? "no reason given" : reason);
  console.log(`REFUSED  ${guard} · ${reason === "" ? "no reason given" : reason}`);
  report(ledger);
  process.exit(0);
}

report(load());
process.exit(0);

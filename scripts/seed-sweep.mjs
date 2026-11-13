#!/usr/bin/env node
/** Seed sweep: the properties are only useful if they hold for other seeds too. */
import { spawnSync } from "node:child_process";

const seeds = process.argv.slice(2).map(Number).filter((n) => Number.isFinite(n));
const list = seeds.length > 0 ? seeds : Array.from({ length: 20 }, (_, index) => 20261100 + index * 37);
const runs = Number(process.env.LEDGER_RUNS ?? 200);
const failures = [];
for (const seed of list) {
  const result = spawnSync("npx", ["vitest", "run", "packages/core/src"], {
    encoding: "utf8", env: { ...process.env, LEDGER_SEED: String(seed), LEDGER_RUNS: String(runs) }, timeout: 300_000,
  });
  const bad = result.status !== 0;
  if (bad) {
    const line = (result.stdout + result.stderr).split("\n").filter((l) => /AssertionError|Property failed|Counterexample|seed:/.test(l)).slice(0, 6).join(" | ");
    failures.push({ seed, line });
  }
  console.log(`${bad ? "FAIL" : "ok  "}  seed ${seed} · ${runs} runs`);
}
console.log(`\n${list.length - failures.length}/${list.length} seeds green`);
for (const failure of failures) console.log(`FAIL seed ${failure.seed}: ${failure.line}`);
process.exit(failures.length === 0 ? 0 : 1);

#!/usr/bin/env node
/** Every claim gets a proof. Writes docs/proofs.json and fails on the first red line. */
import { spawnSync } from "node:child_process";
import { gzipSync } from "node:zlib";
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const TIMEOUT_MS = 240_000;
const startedAt = new Date().toISOString();
const run = (command, args) => spawnSync(command, args, { encoding: "utf8", timeout: TIMEOUT_MS });
const firstLine = (text) => (text ?? "").trim().split("\n").filter(Boolean).at(-1) ?? "";

const proofs = [];
const add = (id, passed, detail) => proofs.push({ id, passed, detail });

const guard = (id, script, label) => {
  const result = run("node", [script]);
  add(id, result.status === 0, result.status === 0 ? firstLine(result.stdout) : `${label} failed: ${firstLine(result.stderr)}`);
};

guard("purity", ".github/checks/purity.mjs", "purity");
guard("fixture-privacy", ".github/checks/fixture-privacy.mjs", "fixtures");
guard("line-budgets", ".github/checks/loc-budget.mjs", "budgets");
guard("lint", "scripts/lint.mjs", "lint");

const tests = run("npx", ["vitest", "run", "--reporter=dot"]);
add("unit-tests", tests.status === 0, tests.status === 0 ? firstLine(tests.stdout) : firstLine(tests.stderr));

const contestMissing = [];
if (!statSync(".kiro").isDirectory()) contestMissing.push(".kiro/ missing");
if (readFileSync(".gitignore", "utf8").split("\n").some((line) => line.trim() === ".kiro/" || line.trim() === "/.kiro")) contestMissing.push(".kiro is gitignored");
if (!readFileSync("LICENSE", "utf8").includes("MIT License")) contestMissing.push("MIT license missing");
add("contest", contestMissing.length === 0, contestMissing.length === 0 ? ".kiro tracked, MIT licence present" : contestMissing.join("; "));

const budget = run("node", [".github/checks/loc-budget.mjs"]);
add("line-budgets-json", budget.status === 0, firstLine(budget.stdout));

const sizes = [];
for (const site of ["skeleton", "envelopes", "mutual-aid"]) {
  const dir = join("dist", site);
  try {
    statSync(dir);
    let total = 0;
    for (const name of readdirSync(join(dir, "assets"))) {
      const file = join(dir, "assets", name);
      if (name.endsWith(".js") || name.endsWith(".css")) total += gzipSync(readFileSync(file)).length;
    }
    sizes.push({ site, gzipKb: Math.round(total / 102.4) / 10 });
  } catch { sizes.push({ site, gzipKb: null }); }
}
const measured = sizes.filter((s) => s.gzipKb !== null);
const over = measured.filter((s) => s.gzipKb > 220);
add("bundle-budget", measured.length > 0 && over.length === 0, measured.length === 0 ? "not built yet" : measured.map((s) => `${s.site} ${s.gzipKb} kB`).join(" · "));

const report = { startedAt, finishedAt: new Date().toISOString(), proofs, passed: proofs.filter((p) => p.passed).length, total: proofs.length };
mkdirSync("docs", { recursive: true });
writeFileSync("docs/proofs.json", `${JSON.stringify(report, null, 2)}\n`);
for (const proof of proofs) console.log(`${proof.passed ? "PASS" : "FAIL"}  ${proof.id.padEnd(20)} ${proof.detail}`);
console.log(`${report.passed}/${report.total} proofs passed — written to docs/proofs.json`);
process.exit(report.passed === report.total ? 0 : 1);

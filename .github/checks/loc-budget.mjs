#!/usr/bin/env node
/** The ceiling never goes up. Enforced here and in .kiro/hooks/loc-budget.json. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const BUDGETS = [
  { name: "core", dir: "packages/core/src", max: 1500 },
  { name: "ui", dir: "packages/ui/src", max: 1500 },
  { name: "skeleton", dir: "skeleton/src", max: 200 },
  { name: "app:envelopes", dir: "apps/envelopes/src", max: 600 },
  { name: "app:mutual-aid", dir: "apps/mutual-aid/src", max: 600 },
];
const SKELETON_TOTAL = 3200;

const walk = (dir) => {
  try { statSync(dir); } catch { return []; }
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return /\.(ts|tsx|css)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
};

const countLines = (file) => readFileSync(file, "utf8").split("\n").filter((line) => line.trim().length > 0).length;

let failed = false;
const rows = [];
for (const budget of BUDGETS) {
  const lines = walk(budget.dir).reduce((total, file) => total + countLines(file), 0);
  const pct = Math.round((lines / budget.max) * 100);
  if (lines > budget.max) failed = true;
  rows.push({ name: budget.name, lines, max: budget.max, over: lines > budget.max, text: `${lines > budget.max ? "FAIL" : "ok  "} ${budget.name.padEnd(15)} ${String(lines).padStart(5)}/${budget.max} (${pct}%)` });
}
const skeleton = rows.filter((r) => ["core", "ui", "skeleton"].includes(r.name)).reduce((t, r) => t + r.lines, 0);
if (skeleton > SKELETON_TOTAL) failed = true;
console.log(rows.map((r) => r.text).join("\n"));
console.log(`${skeleton > SKELETON_TOTAL ? "FAIL" : "ok  "} ${"skeleton total".padEnd(15)} ${String(skeleton).padStart(5)}/${SKELETON_TOTAL}`);
if (failed) {
  console.error("\nloc-budget: over budget. The ceiling does not move: remove code instead.");
  process.exit(1);
}

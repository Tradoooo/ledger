#!/usr/bin/env node
/** The skeleton must not contain application concepts, and nothing may import across the boundary. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const APPLICATION_WORDS = [
  ["mutual-aid", "apps/mutual-aid"], ["mutualAid", "apps/mutual-aid"], ["household", "apps/envelopes"],
  ["groceries", "apps/envelopes"], ["carrefour", "apps/envelopes"], ["foodbank", "apps/foodbank-rota"],
  ["tournament", "apps/tournament-fixtures"], ["time-bank", "apps/time-bank"], ["foyer", "apps/envelopes"],
];

const walk = (dir) => {
  try { statSync(dir); } catch { return []; }
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
};

const problems = [];
for (const file of walk("packages")) {
  const source = readFileSync(file, "utf8");
  const lower = source.toLowerCase();
  const lines = source.split("\n");
  lines.forEach((line, index) => {
    if (line.includes("purity-ok")) return; // justified exception, written next to the code
    for (const [word, owner] of APPLICATION_WORDS) {
      if (line.toLowerCase().includes(word.toLowerCase())) {
        problems.push(`${file}:${index + 1}: "${word}" is an application concept — it belongs to ${owner}`);
      }
    }
  });
  for (const match of source.matchAll(/from\s+"(\.\.\/)+(apps|skeleton)\//g)) problems.push(`${file}: imports from an application (${match[0]})`);
  for (const match of source.matchAll(/from\s+"@ledger\/core\/src\//g)) problems.push(`${file}: deep import of @ledger/core internals`);
}
if (problems.length > 0) {
  console.error(problems.join("\n"));
  console.error("\npurity: the skeleton is application-free. Move the concept to its application.");
  process.exit(1);
}
console.log("ok   purity: no application concept in packages/**");

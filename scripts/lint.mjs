#!/usr/bin/env node
/** Repository rules that a type checker cannot see. Fast, no dependencies. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const problems = [];
const walk = (dir) => {
  try { statSync(dir); } catch { return []; }
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
};
const files = [...walk("packages"), ...walk("apps"), ...walk("skeleton")];

const FORBIDDEN_CORE = [
  [/\bDate\.now\s*\(/, "Date.now() is banned in the core: inject the clock (LED-N-04)"],
  [/\bnew Date\s*\(/, "new Date() is banned in the core: dates are strings (LED-N-04)"],
  [/\bMath\.random\s*\(/, "Math.random() is banned everywhere: seed it (LED-N-04)"],
  [/new Function\s*\(/, "eval-like code is banned (LED-N-06)"],
];
const FORBIDDEN_ALL = [
  [/\bfetch\s*\(/, "network access is banned: the ledger is local (LED-N-05)"],
  [/XMLHttpRequest|WebSocket|sendBeacon/, "network access is banned (LED-N-05)"],
  [/:\s*any\s*(?=[,;)\]}=>]|$)/m, "no `any`: use a real type"],
  [/\bas any\b/, "no `as any`: model the type properly"],
  [/as unknown as/, "no double cast: model the type properly"],
  [/@ledger\/core\/src\//, "deep import of the core is banned: use the package entry"],
];

/** Rough function length check: counts lines from a declaration to its closing brace at column 0. */
const checkFunctions = (file, lines) => {
  let start = -1;
  let depth = 0;
  lines.forEach((line, index) => {
    if (start < 0 && /^(export )?(async )?function \w+/.test(line)) { start = index; depth = 0; }
    if (start >= 0) { depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length; if (depth <= 0 && index > start) { if (index - start > 50) problems.push(`${file}:${start + 1}: function spans ${index - start + 1} lines (max 50)`); start = -1; } }
  });
};

for (const file of files) {
  const source = readFileSync(file, "utf8");
  const lines = source.split("\n");
  if (lines.length > 500) problems.push(`${file}: ${lines.length} lines (max 500 per file)`);
  checkFunctions(file, lines);
  const isCore = file.startsWith("packages/core/");
  for (const [pattern, message] of [...FORBIDDEN_ALL, ...(isCore ? FORBIDDEN_CORE : [])]) {
    if (pattern.test(source) && !source.includes(`lint-ok:${String(pattern)}`)) problems.push(`${file}: ${message}`);
  }
}
if (problems.length > 0) { console.error(problems.join("\n")); process.exit(1); }
console.log(`ok   lint: ${files.length} files, no forbidden pattern`);

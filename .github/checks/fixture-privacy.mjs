#!/usr/bin/env node
/** Fixtures are fictional, and the file says so. No IBAN, no valid card number. */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const IBAN = /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g;
const CARD = /\b(?:\d[ -]?){12,19}\b/g;
const luhn = (digits) => {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit;
  }
  return sum % 10 === 0;
};
const walk = (dir) => {
  try { statSync(dir); } catch { return []; }
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
};

const problems = [];
const declared = existsSync("fixtures/FICTIONAL.md") && readFileSync("fixtures/FICTIONAL.md", "utf8").includes("FIXTURE: FICTIONAL DATA");
for (const file of walk("fixtures")) {
  const text = readFileSync(file, "utf8");
  if (/\.csv$/.test(file) && !declared && !text.startsWith("# FIXTURE: FICTIONAL DATA")) problems.push(`${file}: declare "FIXTURE: FICTIONAL DATA" in fixtures/FICTIONAL.md`);
  for (const match of text.matchAll(IBAN)) problems.push(`${file}: IBAN-like value ${match[0]}`);
  for (const match of text.matchAll(CARD)) {
    const digits = match[0].replace(/[ -]/g, "");
    if (digits.length >= 13 && luhn(digits)) problems.push(`${file}: valid card number ${match[0]}`);
  }
}
if (problems.length > 0) { console.error(problems.join("\n")); process.exit(1); }
console.log("ok   fixture privacy: fictional data only");

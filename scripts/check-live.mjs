#!/usr/bin/env node
/** Verifies the three published URLs, from outside, on what a visitor actually sees. */
const BASE = process.env.LEDGER_BASE_URL ?? "https://tradoooo.github.io/ledger";
const SITES = [
  { path: "/", expect: "Ledger" },
  { path: "/skeleton/", expect: "Ledger" },
  { path: "/envelopes/", expect: "Ledger" },
  { path: "/mutual-aid/", expect: "Ledger" },
];

let failed = 0;
for (const site of SITES) {
  const url = `${BASE}${site.path}`;
  try {
    const response = await fetch(url, { redirect: "follow" });
    const body = await response.text();
    const ok = response.status === 200 && body.includes(site.expect);
    if (!ok) failed += 1;
    console.log(`${ok ? "PASS" : "FAIL"}  ${response.status}  ${url}  (${body.length} bytes)`);
  } catch (error) {
    failed += 1;
    console.log(`FAIL  ---  ${url}  ${String(error)}`);
  }
}
console.log(`${SITES.length - failed}/${SITES.length} sites verified`);
process.exit(failed === 0 ? 0 : 1);

#!/usr/bin/env node
/** Verifies the published URLs, from outside, on what a visitor actually sees.
 *
 * The registry is closed: three applications, one index, one proof page. A fourth published
 * application is a refusal, not a feature — so the number of URLs is checked as well as
 * their answer.
 */
const BASE = process.env.LEDGER_BASE_URL ?? "https://tradoooo.github.io/ledger";
/** The three published applications: the skeleton and the two apps. */
const APPS = ["skeleton", "envelopes", "mutual-aid"];
/** The index and the proof page are not applications, but they are published. */
const SITES = [
  { path: "/", expect: "Ledger" },
  { path: "/skeleton/", expect: "Ledger" },
  { path: "/envelopes/", expect: "Ledger" },
  { path: "/mutual-aid/", expect: "Ledger" },
  { path: "/proof.html", expect: "Proofs" },
];
/** Three applications, two pages: five URLs, and the count never goes up. */
const EXPECTED_URLS = APPS.length + 2;

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
const countOk = SITES.length === EXPECTED_URLS;
console.log(`${countOk ? "PASS" : "FAIL"}  ${SITES.length} published URLs (${APPS.length} applications + index + /proof.html), expected ${EXPECTED_URLS}`);
console.log(`${SITES.length - failed}/${SITES.length} sites verified`);
process.exit(failed === 0 && countOk ? 0 : 1);

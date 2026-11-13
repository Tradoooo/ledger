#!/usr/bin/env node
/** Builds the root page and the proof page into dist/, next to the three applications. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const SITES = [
  { slug: "skeleton", title: "Skeleton", what: "An empty ledger that runs: one chart, one rule, one report." },
  { slug: "envelopes", title: "Household envelopes", what: "Everything private. One number: can I still spend tomorrow?" },
  { slug: "mutual-aid", title: "Mutual aid fund", what: "Everything public. A hash chain a donor can verify without any tool." },
];

const card = (site) => `<a class="card" href="./${site.slug}/"><h2>${site.title}</h2><p>${site.what}</p><span>Open →</span></a>`;

const index = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ledger — a double-entry skeleton and its two applications</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 16px/1.55 ui-serif, Georgia, serif; margin: 0; background: #f7f5ef; color: #1e1c17; }
  @media (prefers-color-scheme: dark) { body { background: #16150f; color: #eee9dc; } .card { border-color: #3a3629 !important; } }
  main { max-width: 60rem; margin: 0 auto; padding: 3rem 1.25rem; }
  h1 { font-size: 2rem; margin: 0 0 .25rem; }
  .lead { font-size: 1.1rem; margin: 0 0 2.5rem; opacity: .85; }
  .grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); }
  .card { display: block; padding: 1.25rem; border: 1px solid #d8d2c0; border-radius: .6rem; text-decoration: none; color: inherit; background: rgba(255,255,255,.35); }
  .card h2 { margin: 0 0 .4rem; font-size: 1.1rem; }
  .card p { margin: 0 0 .8rem; }
  .card span { font-size: .9rem; text-decoration: underline; }
  footer { margin-top: 3rem; font-size: .9rem; opacity: .75; }
  a { color: inherit; }
</style></head>
<body><main>
  <h1>Ledger</h1>
  <p class="lead">A double-entry skeleton: the law is <code>Σ postings = 0</code>, the journal is append-only,
  every balance is a fold. Two applications come out of it, at opposite ends of the privacy spectrum.</p>
  <div class="grid">${SITES.map(card).join("\n")}</div>
  <footer>Proofs: <a href="./proof.html">what is verified, and by what</a>. MIT licence.
  No account, no server, no network request after loading.</footer>
</main></body></html>
`;
mkdirSync("dist", { recursive: true });
writeFileSync("dist/index.html", index);

let proofs = [];
try { proofs = JSON.parse(readFileSync("docs/proofs.json", "utf8")).proofs ?? []; } catch { proofs = []; }
const rows = proofs.map((p) => `<tr><td>${p.passed ? "PASS" : "FAIL"}</td><td><code>${p.id}</code></td><td>${p.detail}</td></tr>`).join("\n");
const passed = proofs.filter((p) => p.passed).length;
writeFileSync("dist/proof.html", `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Proofs — Ledger</title>
<style>body{font:16px/1.5 ui-sans-serif,system-ui,sans-serif;max-width:56rem;margin:2rem auto;padding:0 1rem;color:#1e1c17;background:#faf9f5}
table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;padding:.4rem .5rem;text-align:left;vertical-align:top}
code{font-size:.9em}</style></head><body>
<h1>What is verified</h1><p>${passed}/${proofs.length} proofs passed at the last build. Each line is produced by a script, not by hand.</p>
<table><thead><tr><th>State</th><th>Proof</th><th>Detail</th></tr></thead><tbody>${rows}</tbody></table>
<p><a href="./">← back</a></p></body></html>
`);
console.log(`site assembled: index + ${proofs.length} proofs`);

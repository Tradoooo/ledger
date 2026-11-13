#!/usr/bin/env node
/** Smoke test of the BUILT site, in a headless browser: what a visitor actually gets.
 *
 * The lesson from a previous project: never trust a green unit suite to prove a page renders.
 * Here we open dist/, read the DOM, and fail on a console error or a single foreign request.
 */
import { createServer } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };
const server = createServer((request, response) => {
  const path = normalize(decodeURIComponent((request.url ?? "/").split("?")[0]));
  const file = path.endsWith("/") ? join("dist", path, "index.html") : join("dist", path);
  try {
    statSync(file);
    response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    response.end(readFileSync(file));
  } catch {
    response.writeHead(404).end("not found");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const PAGES = [
  { path: "/", expect: "Ledger" },
  { path: "/skeleton/", expect: "Ledger skeleton" },
  { path: "/envelopes/", expect: "Reste à dépenser" },
  { path: "/mutual-aid/", expect: "Mutual aid" },
];

const browser = await chromium.launch();
let failures = 0;
for (const page of PAGES) {
  const tab = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  const foreign = [];
  tab.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  tab.on("request", (request) => { if (!request.url().startsWith(base) && !request.url().startsWith("data:")) foreign.push(request.url()); });
  const response = await tab.goto(`${base}${page.path}`, { waitUntil: "networkidle" });
  const text = await tab.locator("body").innerText();
  const ok = response?.status() === 200 && text.toLowerCase().includes(page.expect.toLowerCase()) && errors.length === 0 && foreign.length === 0;
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${page.path.padEnd(14)} ${response?.status()} · ${text.replace(/\s+/g, " ").slice(0, 60)}… ${errors.length ? `· console: ${errors[0]}` : ""}${foreign.length ? ` · foreign: ${foreign[0]}` : ""}`);
  await tab.close();
}
await browser.close();
server.close();
console.log(`${PAGES.length - failures}/${PAGES.length} pages rendered, no console error, no foreign request`);
process.exit(failures === 0 ? 0 : 1);

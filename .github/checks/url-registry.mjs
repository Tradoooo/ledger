#!/usr/bin/env node
/** The registry of published URLs: three applications, one index, one proof page. Nothing else.
 *
 * Three checks, each one a refusal:
 *   1. exactly three published applications (the skeleton and the two apps), plus the index and
 *      `/proof.html` — a fourth published URL fails;
 *   2. every URL mentioned in `README.md` and `docs/*.md` answers 200 — a URL that does not exist
 *      yet must be marked `TODO` (or removed), never published as if it were live;
 *   3. the skeleton is published exactly once: no other URL carries it and no other source tree
 *      copies it.
 *
 * `node .github/checks/url-registry.mjs`          — the registry and the live checks.
 * `node .github/checks/url-registry.mjs --offline` — the registry alone, no fetch (air-gapped).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const BASE = (process.env.LEDGER_BASE_URL ?? "https://tradoooo.github.io/ledger").replace(/\/+$/, "");
const HOST = new URL(BASE).host;
/** The site is served under a sub-path (`/ledger`); a published path is what comes after it. */
const BASE_PATH = new URL(BASE).pathname.replace(/\/+$/, "");

/** The three published applications. The count is the rule: it never goes up. */
const APPS = ["envelopes", "mutual-aid", "skeleton"];
/** The two pages that are not an application. */
const EXTRA_PAGES = ["/", "/proof.html"];
/** Everything the site may answer on: five paths, no more. */
const ALLOWED_PATHS = new Set([...EXTRA_PAGES, ...APPS.map((app) => `/${app}/`)]);

/** Hosts the project legitimately points at, beyond the published one. */
const KNOWN_HOSTS = new Set([HOST, "github.com", "kiroween.devpost.com"]);

const OFFLINE = process.argv.includes("--offline");
const FETCH_TIMEOUT_MS = 10_000;
const FETCH_ATTEMPTS = 3;

const problems = [];
const notes = [];

const read = (file) => readFileSync(file, "utf8");
const problem = (message) => problems.push(message);
const note = (message) => notes.push(message);

function docFiles() {
  const files = ["README.md"];
  if (existsSync("docs")) {
    for (const name of readdirSync("docs").sort()) {
      if (name.endsWith(".md")) files.push(join("docs", name));
    }
  }
  return files;
}

/* 1 — the registry itself. */

function assembleSiteApps() {
  const source = read("scripts/assemble-site.mjs");
  return [...source.matchAll(/slug:\s*"([^"]+)"/g)].map((match) => match[1]);
}

function builtApps() {
  const source = read("scripts/build.mjs");
  return [...source.matchAll(/name:\s*"[^"]+"\s*,\s*dir:\s*"([^"]+)"/g)]
    .map((match) => match[1].split("/").at(-1));
}

function livePaths() {
  const source = read("scripts/check-live.mjs");
  return [...source.matchAll(/path:\s*"([^"]+)"/g)].map((match) => match[1]);
}

function checkRegistry() {
  const assembled = assembleSiteApps().sort();
  const built = builtApps().sort();
  const expected = [...APPS].sort();
  if (assembled.length !== 3) problem(`the site assembles ${assembled.length} applications (${assembled.join(", ")}) — exactly 3 are allowed`);
  if (assembled.join(",") !== expected.join(",")) problem(`the site assembles [${assembled.join(", ")}] — the published applications are [${expected.join(", ")}]`);
  if (built.join(",") !== expected.join(",")) problem(`the build builds [${built.join(", ")}] — the published applications are [${expected.join(", ")}]`);
  const paths = livePaths();
  const extra = paths.filter((path) => !ALLOWED_PATHS.has(path));
  if (extra.length > 0) problem(`check-live.mjs watches paths outside the registry: ${extra.join(", ")}`);
  for (const path of ALLOWED_PATHS) {
    if (!paths.includes(path)) problem(`check-live.mjs does not watch ${path} — every published path must be checked`);
  }
  note(`registry: ${APPS.length} applications (${APPS.join(", ")}) + ${EXTRA_PAGES.join(", ")}`);
}

/** Every URL of a path, without the trailing punctuation a sentence leaves behind. */
function cleanUrl(raw) {
  return raw.replace(/[.,;:!?)\]}'"`]+$/, "");
}

function extractUrls(text) {
  const found = [];
  for (const match of text.matchAll(/https?:\/\/[^\s<>()[\]"']+/g)) found.push(cleanUrl(match[0]));
  for (const match of text.matchAll(/\b(?:[a-z0-9-]+\.)+(?:github\.com|github\.io|devpost\.com)\/[^\s<>()[\]"'`,;]*/gi)) {
    found.push(cleanUrl(`https://${match[0]}`));
  }
  return [...new Set(found)];
}

/** A URL is "to come" when its line says so: `TODO` is the only accepted marker. */
function pendingUrls(text) {
  const pending = new Set();
  for (const line of text.split("\n")) {
    if (!/todo/i.test(line)) continue;
    for (const url of extractUrls(line)) pending.add(url);
  }
  return pending;
}

/** The path of a URL under the published host, relative to the site root, or null elsewhere.
 *  A directory URL keeps one trailing slash (`/envelopes/`), a file URL keeps none (`/proof.html`). */
function publishedPath(url) {
  let parsed;
  try { parsed = new URL(url); } catch { return null; }
  if (parsed.host !== HOST) return null;
  if (BASE_PATH !== "" && !parsed.pathname.startsWith(`${BASE_PATH}/`) && parsed.pathname !== BASE_PATH) return null;
  const within = BASE_PATH === "" ? parsed.pathname : parsed.pathname.slice(BASE_PATH.length);
  if (within === "" || within === "/") return "/";
  const last = within.split("/").filter(Boolean).at(-1) ?? "";
  const isFile = last.includes(".");
  const path = within.endsWith("/") || isFile ? within : `${within}/`;
  return path.startsWith("/") ? path : `/${path}`;
}

async function fetchStatus(url) {
  let last = "no answer";
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (response.status === 200) return 200;
      last = `HTTP ${response.status}`;
      if (response.status < 500) return response.status;
    } catch (cause) {
      last = cause instanceof Error ? cause.message : String(cause);
    }
    if (attempt < FETCH_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return last;
}

async function checkUrlsAnswer() {
  const pending = new Set();
  const urls = new Set();
  for (const file of docFiles()) {
    const text = read(file);
    for (const url of pendingUrls(text)) pending.add(url);
    for (const url of extractUrls(text)) urls.add(url);
  }
  for (const path of ALLOWED_PATHS) urls.add(`${BASE}${path}`);
  for (const url of pending) urls.delete(url);
  const sorted = [...urls].sort();
  if (OFFLINE) {
    note(`offline: ${sorted.length} URLs not fetched (${sorted.join(", ")})`);
    return sorted;
  }
  for (const url of sorted) {
    const status = await fetchStatus(url);
    if (status !== 200) problem(`${url} does not answer 200 (${status})`);
    else note(`200  ${url}`);
  }
  return sorted;
}

/* 2 — a published page outside the registry, or a skeleton published twice. */

function checkPublishedUrls(urls) {
  for (const url of urls) {
    const path = publishedPath(url);
    if (path !== null) {
      if (!ALLOWED_PATHS.has(path)) problem(`${url} is a published URL outside the registry (${path}) — the site answers ${[...ALLOWED_PATHS].join(", ")} only`);
      continue;
    }
    let host;
    try { host = new URL(url).host; } catch { continue; }
    if (!KNOWN_HOSTS.has(host)) problem(`${url} points outside the known hosts (${[...KNOWN_HOSTS].join(", ")})`);
  }
}

function checkSkeletonPublishedOnce(urls) {
  for (const url of urls) {
    const path = publishedPath(url);
    if (path === null) continue;
    if (!path.split("/").some((segment) => segment.includes("skeleton"))) continue;
    if (path !== "/skeleton/") problem(`the skeleton is published at ${url} — it lives at ${BASE}/skeleton/ only`);
  }
}

/** Every directory named `skeleton` that carries an application: one, the canonical one. */
function skeletonSourceTrees() {
  const found = [];
  const walk = (dir, depth) => {
    if (depth > 4) return;
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (["node_modules", ".git", "dist", "scratch", "coverage", ".kiro", ".github"].includes(entry.name)) continue;
      const path = join(dir, entry.name);
      if (entry.name === "skeleton") {
        const hasApp = existsSync(join(path, "package.json")) || existsSync(join(path, "src", "main.tsx"));
        if (hasApp) found.push(path);
      }
      walk(path, depth + 1);
    }
  };
  walk(".", 0);
  return found;
}

function checkSkeletonTree() {
  const trees = skeletonSourceTrees();
  if (trees.length === 0) problem("no skeleton application found in the repository — the template must exist");
  for (const tree of trees) {
    if (tree !== join(".", "skeleton")) problem(`${tree} is a second skeleton — the template lives in ./skeleton only`);
  }
  if (!trees.includes(join(".", "skeleton"))) problem("./skeleton is missing — the template must exist");
  note(`skeleton source trees: ${trees.length}`);
}

function checkDist() {
  if (!existsSync("dist")) {
    note("dist/ is absent — the build artefacts are not checked");
    return;
  }
  const apps = readdirSync("dist", { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name !== "assets");
  const extra = apps.filter((name) => !APPS.includes(name));
  if (extra.length > 0) problem(`dist/ publishes [${extra.join(", ")}] — the three applications are [${APPS.join(", ")}]`);
  const skeletons = apps.filter((name) => name.includes("skeleton"));
  if (skeletons.length > 1) problem(`dist/ publishes ${skeletons.length} skeletons — one only`);
  note(`dist/ applications: ${apps.sort().join(", ") || "none"}`);
}

/* The verdict. */

await checkRegistry();
const urls = await checkUrlsAnswer();
checkPublishedUrls(urls);
checkSkeletonPublishedOnce(urls);
checkSkeletonTree();
checkDist();

for (const line of notes) console.log(`ok   ${line}`);
if (problems.length > 0) {
  console.error("");
  for (const line of problems) console.error(`FAIL ${line}`);
  console.error(`\nurl-registry: ${problems.length} problem(s). Three published URLs, one index, one proof page.`);
  process.exit(1);
}
console.log("ok   url-registry: three published applications, one index, one proof page");

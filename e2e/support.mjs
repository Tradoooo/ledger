/** Shared plumbing of the e2e suite: one browser, one page per test, the build on a static server.
 *
 * The suite runs with `node --test e2e/` against `dist/` — never against the sources. Every test
 * that touches the household app starts from an empty `localStorage`, so a stored book never
 * leaks from one test to the next.
 */
import { existsSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { startServer } from "./server.mjs";

/** The phone the video is filmed on, and the desktop framing of the repository shots. */
export const PHONE = { width: 390, height: 844 };
export const DESKTOP = { width: 1440, height: 900 };

/** Every published view, as a tab id and the label the shell renders. */
export const ENVELOPES_TABS = ["overview", "envelopes", "journal", "import", "reports", "audit"];
export const FUND_TABS = ["fund", "ledger", "publish", "report", "audit"];

/** Boot the server and the browser once per test file; the caller closes both. */
export async function start() {
  if (!existsSync("dist/index.html")) {
    throw new Error("dist/ is missing: run `pnpm build` before the e2e suite");
  }
  const site = await startServer("dist");
  const browser = await chromium.launch();
  return {
    browser,
    base: site.base,
    async close() {
      await browser.close();
      await site.close();
    },
  };
}

/** A fresh context: empty storage, the viewport the test asks for, the motion preference it names. */
export async function openPage(browser, base, path, options = {}) {
  const context = await browser.newContext({
    viewport: options.viewport ?? PHONE,
    reducedMotion: options.reducedMotion ?? "no-preference",
    locale: options.locale ?? "fr-FR",
  });
  const page = await context.newPage();
  const errors = [];
  const foreign = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("request", (request) => {
    const url = request.url();
    if (!url.startsWith(base) && !url.startsWith("data:") && !url.startsWith("blob:")) foreign.push(url);
  });
  await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
  return { context, page, errors, foreign };
}

/** Close a context without leaving a page behind. */
export async function closePage(opened) {
  await opened.context.close();
}

/** The single figure of the band, as text: `6,44 €`. */
export async function bandValue(page) {
  const band = page.locator(".bb-band-value").first();
  await band.waitFor({ state: "visible" });
  return (await band.innerText()).replace(/\s+/g, " ").trim();
}

/** The book the browser holds, parsed: the app stores entries, never the chain. */
export async function storedEntries(page) {
  const raw = await page.evaluate(() => localStorage.getItem("ledger:envelopes:v1"));
  if (raw === null) return [];
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed.entries) ? parsed.entries : [];
}

/** An element that carries a correction gesture, if the app ships one. */
export async function correctionControls(page) {
  return page.evaluate(() => {
    const named = [...document.querySelectorAll("button, select, [role='button']")];
    const matches = named.filter((element) => {
      const text = `${element.getAttribute("aria-label") ?? ""} ${element.innerText ?? ""}`;
      return /corrig|reclass|affect|classer|apprend|learn|règle|rule/i.test(text);
    });
    return matches.map((element) => `${element.tagName.toLowerCase()} "${(element.innerText ?? "").trim()}"`);
  });
}

/** The correction gesture, when the app ships one: pick a new account, then read the learned rule.
 *
 * The shape is not fixed yet — the app may offer a select per line, or a button that opens one —
 * so the test drives whatever it finds and reads the rule that appears afterwards. It returns
 * null when the app offers no correction at all.
 */
export async function correctAnAssignment(page) {
  const opened = page.getByRole("button", { name: /corrig|réaffect|affect|classer/i }).first();
  if (await opened.count() > 0) {
    await opened.click();
    await page.waitForTimeout(300);
  }
  const select = page.locator("main select").first();
  if (await select.count() === 0) return null;
  const options = await select.locator("option").evaluateAll((nodes) => nodes.map((node) => node.value).filter(Boolean));
  if (options.length < 2) return null;
  await select.selectOption(options[1]);
  await page.waitForTimeout(400);
  const text = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  return text;
}

/** Horizontal overflow of the document: scrollWidth above clientWidth means something spilled. */
export async function overflow(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const wide = [...document.querySelectorAll("body *")]
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.right > root.clientWidth + 1;
      })
      .slice(0, 6)
      .map((element) => {
        const box = element.getBoundingClientRect();
        const label = `${element.tagName.toLowerCase()}${element.className ? `.${String(element.className).split(" ").join(".")}` : ""}`;
        return `${label} → ${Math.round(box.right)}px`;
      });
    return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth, wide };
  });
}

/** The measured overflow debt, written down: `<path>#<tab>` → the widest the layout is today. */
export function knownOverflows() {
  const file = "e2e/known-overflows.json";
  if (!existsSync(file)) return { views: {} };
  return JSON.parse(readFileSync(file, "utf8"));
}

#!/usr/bin/env node
/** The raw material of the contest film: one video per page, per framing.
 *
 * Four pages (the index, the skeleton, the household app, the fund app), two framings
 * (the phone 390×844 the applications were built for, the desktop 1440×900 for the repository
 * and the proofs). Each video shows the gesture, not a slideshow: the import wizard on the
 * phone, the entry and the receipt on the fund.
 *
 * `node scripts/record-demo.mjs` → `artifacts/demo-<page>-<width>x<height>.webm`.
 * The film itself stays human: this writes the shots, nobody writes the voice-over.
 */
import { mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { startServer } from "../e2e/server.mjs";

const OUT = "artifacts";
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };
const FRAMINGS = [
  { name: "phone", viewport: PHONE },
  { name: "desktop", viewport: DESKTOP },
];

/** The four published pages, and what the camera does on each. */
const SHOTS = [
  { page: "index", path: "/", gesture: async () => {} },
  { page: "skeleton", path: "/skeleton/", gesture: async (page) => {
    await page.getByRole("button", { name: "Add entry" }).click();
    await page.waitForTimeout(900);
  } },
  { page: "envelopes", path: "/envelopes/", gesture: async (page) => {
    await page.getByRole("tab", { name: /classer/i }).click();
    await page.waitForTimeout(900);
    const item = page.locator("main ul li").first();
    const select = item.locator("select");
    const proposed = await select.locator("option:checked").innerText();
    const target = (await select.locator("option").allInnerTexts()).find((label) => label !== proposed && label !== "À classer");
    if (target !== undefined) {
      await select.selectOption({ label: target });
      await item.getByRole("button", { name: /Corriger/ }).click();
      await page.waitForTimeout(1500);
    }
    await page.getByRole("tab", { name: "Import" }).click();
    await page.locator('main input[type="file"]').setInputFiles("fixtures/household-3y.csv");
    await page.waitForFunction(() => /séparateur/.test(document.querySelector("main")?.innerText ?? ""), null, { timeout: 30_000 });
    await page.waitForTimeout(1500);
    await page.locator("main button").filter({ hasText: /^Importer/ }).first().click({ timeout: 60_000 });
    await page.waitForFunction(() => /12\s?000 écriture\(s\) importée\(s\)/.test(document.querySelector("main")?.innerText ?? ""), null, { timeout: 180_000 });
    await page.waitForTimeout(1500);
    await page.getByRole("tab", { name: "Vue d'ensemble" }).click();
    await page.waitForTimeout(1500);
  } },
  { page: "mutual-aid", path: "/mutual-aid/", gesture: async (page) => {
    await page.getByRole("button", { name: "Aid", exact: true }).click();
    const form = page.locator("form.bb-card").first();
    await form.getByLabel("Date").fill("2026-11-13");
    await form.getByLabel("Note").fill("Food voucher — household 07");
    await form.getByLabel("Amount").fill("42.50");
    await form.locator("select").nth(0).selectOption({ index: 0 });
    await form.locator("select").nth(1).selectOption({ index: 1 });
    await form.getByRole("button", { name: "Save entry" }).click({ timeout: 60_000 });
    await page.waitForTimeout(1200);
    await page.getByRole("tab", { name: "Publish" }).click();
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: "Verify" }).click();
    await page.waitForTimeout(1200);
  } },
];

/** The file Playwright wrote for one context, once the context is closed. */
function recordedVideo(dir) {
  const files = readdirSync(dir).filter((name) => name.endsWith(".webm"));
  return files.length === 0 ? undefined : join(dir, files[0]);
}

/** One shot: a fresh context with the camera on, the page, the gesture, then the file. */
async function record(browser, base, shot, framing, workDir) {
  const context = await browser.newContext({
    viewport: framing.viewport,
    recordVideo: { dir: workDir, size: framing.viewport },
  });
  const page = await context.newPage();
  await page.goto(`${base}${shot.path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await shot.gesture(page);
  await page.waitForTimeout(1200);
  await context.close();
  const source = recordedVideo(workDir);
  if (source === undefined) throw new Error(`no video was written for ${shot.page} (${framing.name})`);
  const target = join(OUT, `demo-${shot.page}-${framing.viewport.width}x${framing.viewport.height}.webm`);
  renameSync(source, target);
  console.log(`recorded ${target}`);
}

const site = await startServer("dist");
const browser = await chromium.launch();
mkdirSync(OUT, { recursive: true });
try {
  for (const framing of FRAMINGS) {
    for (const shot of SHOTS) {
      // The camera writes its file first, in a scratch directory outside the repository.
      const workDir = mkdtempSync(join(tmpdir(), `ledger-demo-${shot.page}-`));
      try {
        await record(browser, site.base, shot, framing, workDir);
      } finally {
        rmSync(workDir, { recursive: true, force: true });
      }
    }
  }
} finally {
  await browser.close();
  await site.close();
}
console.log(`\n${SHOTS.length * FRAMINGS.length} shots in ${OUT}/ — the film is still to be edited, by a human.`);

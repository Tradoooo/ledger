/** The phone framing: 390×844, no horizontal overflow, and the motion preference honoured.
 *
 * The overflow debt is written down in `e2e/known-overflows.json`, with its reason, the way the
 * accounting deviations are written down in `docs/recette.json`: a view may not exceed what it
 * measures today, and a view that is not on the list must fit inside 390 px. The list only ever
 * shrinks — the fix lives in `packages/ui/src/styles.css` (a scroll container around the tables,
 * `overflow-wrap` on the hashes, `min-width: 0` on the grid children), not here.
 */
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { DESKTOP, PHONE, closePage, knownOverflows, openPage, overflow, start } from "./support.mjs";

/** The published views, and the tabs each one has. Discovered from the shell, never hard-coded twice. */
const PAGES = ["/", "/proof.html", "/skeleton/", "/envelopes/", "/mutual-aid/"];

let app;
before(async () => { app = await start(); });
after(async () => { await app.close(); });

/** Every tab of a page, opened one by one; the measurement is taken on each state. */
async function measure(page, base, path) {
  await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
  const labels = await page.locator('[role="tab"]').allInnerTexts();
  const views = [];
  if (labels.length === 0) {
    views.push({ key: `${path}#`, ...(await overflow(page)) });
    return views;
  }
  for (const label of labels) {
    await page.getByRole("tab", { name: label.trim(), exact: true }).click();
    await page.waitForTimeout(150);
    views.push({ key: `${path}#${stableLabel(label.trim())}`, ...(await overflow(page)) });
  }
  return views;
}

/** The key of a view: the label without its count, so the debt survives a growing book. */
function stableLabel(label) {
  return label.replace(/\(\d+\)/g, "(n)").replace(/\s+/g, " ");
}

test("390×844 : aucun écran ne déborde horizontalement au-delà de la dette mesurée", { timeout: 120_000 }, async (t) => {
  const debt = knownOverflows().views ?? {};
  const opened = await openPage(app.browser, app.base, "/", { viewport: PHONE });
  const { page } = opened;

  const views = [];
  for (const path of PAGES) views.push(...(await measure(page, app.base, path)));
  await closePage(opened);

  const offenders = views.filter((view) => view.scrollWidth > view.clientWidth);
  const regressions = [];
  const paying = [];
  for (const view of views) {
    const allowed = debt[view.key] ?? view.clientWidth;
    if (view.scrollWidth > allowed) regressions.push({ ...view, allowed });
    else if (view.scrollWidth > view.clientWidth) paying.push({ ...view, allowed });
  }

  assert.deepEqual(
    regressions.map((view) => `${view.key} at ${view.scrollWidth}px (allowed ${view.allowed}px)`), [],
    "a view overflows more than the debt written down in e2e/known-overflows.json",
  );
  assert.equal(views.filter((view) => view.scrollWidth <= view.clientWidth).length + paying.length, views.length,
    "every view is either inside 390 px or on the debt list");

  if (paying.length > 0) {
    t.diagnostic(
      `${paying.length}/${views.length} view(s) still overflow at 390×844, recorded in e2e/known-overflows.json: `
      + paying.map((view) => `${view.key} ${view.scrollWidth}px`).join(", "),
    );
  }
  const repaid = Object.keys(debt).filter((key) => {
    const view = views.find((candidate) => candidate.key === key);
    return view !== undefined && view.scrollWidth <= view.clientWidth;
  });
  if (repaid.length > 0) {
    t.diagnostic(`debt repaid, remove these keys from e2e/known-overflows.json: ${repaid.join(", ")}`);
  }
  t.diagnostic(`${views.length - offenders.length}/${views.length} views fit inside 390 px`);
});

test("390×844 : les deux applications gardent leur figure et leurs commandes à l'écran", { timeout: 60_000 }, async (t) => {
  const opened = await openPage(app.browser, app.base, "/envelopes/", { viewport: PHONE });
  const { page } = opened;
  const band = page.locator(".bb-band").first();
  await band.waitFor({ state: "visible" });
  const box = await band.boundingBox();
  assert.ok(box !== null && box.x >= 0 && box.x + box.width <= PHONE.width, "the one figure fits the phone width");
  assert.ok(box.height > 40, "the figure is the largest thing on screen");
  const size = await page.locator(".bb-band-value").first().evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  assert.ok(size >= 32, `the figure is at least 32px tall, got ${size}`);

  const print = page.getByRole("button", { name: "Imprimer" });
  const printBox = await print.boundingBox();
  assert.ok(printBox !== null && printBox.x >= 0 && printBox.x + printBox.width <= PHONE.width, "the print command stays reachable");
  assert.ok(printBox.height >= 24, "a command is at least 24px tall (touch target)");
  t.diagnostic(`band ${Math.round(box.width)}px wide, figure ${size}px, print button ${Math.round(printBox.width)}×${Math.round(printBox.height)}`);
  await closePage(opened);
});

test("prefers-reduced-motion: reduce est respecté", { timeout: 60_000 }, async (t) => {
  const opened = await openPage(app.browser, app.base, "/mutual-aid/", { reducedMotion: "reduce" });
  const { page } = opened;
  const motion = await page.evaluate(() => {
    const moves = [];
    for (const element of document.querySelectorAll("*")) {
      const style = getComputedStyle(element);
      if (style.transitionDuration !== "0s" && style.transitionDuration !== "") {
        moves.push({ what: `transition ${style.transitionDuration}`, element: element.tagName.toLowerCase() });
      }
      if (style.animationName !== "none" && style.animationDuration !== "0s") {
        moves.push({ what: `animation ${style.animationName} ${style.animationDuration}`, element: element.tagName.toLowerCase() });
      }
      if (style.scrollBehavior === "smooth") moves.push({ what: "smooth scrolling", element: element.tagName.toLowerCase() });
    }
    return { asked: matchMedia("(prefers-reduced-motion: reduce)").matches, moves: moves.slice(0, 8) };
  });
  assert.equal(motion.asked, true, "the browser reports the reduced-motion preference to the page");
  assert.deepEqual(motion.moves, [], `nothing moves when the visitor asks for less motion: ${JSON.stringify(motion.moves)}`);

  /* The other direction: on a desktop framing, the page still renders and stays put. */
  await page.setViewportSize(DESKTOP);
  await page.getByRole("tab", { name: "Ledger", exact: true }).click();
  assert.ok((await page.locator('[role="tabpanel"]').innerText()).trim().length > 50, "the desktop framing renders the ledger too");
  t.diagnostic(`${motion.moves.length} moving element(s) under prefers-reduced-motion: reduce`);
  await closePage(opened);
});

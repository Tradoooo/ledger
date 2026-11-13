/** Keyboard all the way: reach every screen with Tab, open it with Enter, check a receipt with Enter.
 *
 * A gesture that needs a mouse is not finished. This test never calls `click()`: the tab list is
 * walked with Tab, activated with the keyboard, and the focus ring is measured at every stop —
 * a visible outline (`:focus-visible`, 2px) is what makes the walk possible at all.
 */
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { closePage, openPage, start } from "./support.mjs";

let app;
before(async () => { app = await start(); });
after(async () => { await app.close(); });

/** What has the focus right now, as the browser sees it. */
async function focus(page) {
  return page.evaluate(() => {
    const element = document.activeElement;
    if (element === null || element === document.body) return { tag: "body", label: "", outline: "0px", role: "" };
    const style = getComputedStyle(element);
    return {
      tag: element.tagName.toLowerCase(),
      role: element.getAttribute("role") ?? "",
      label: (element.innerText ?? element.getAttribute("aria-label") ?? element.getAttribute("name") ?? "")
        .replace(/\s+/g, " ").trim().slice(0, 40),
      outline: style.outlineWidth,
      outlineStyle: style.outlineStyle,
    };
  });
}

/** Tab until the predicate matches, and refuse to loop forever. */
async function tabTo(page, matches, limit = 60) {
  for (let press = 0; press < limit; press++) {
    await page.keyboard.press("Tab");
    const at = await focus(page);
    if (matches(at)) return at;
  }
  throw new Error(`no focusable element matched within ${limit} Tab presses`);
}

/** The keyboard walk has to start somewhere clean: the body, not a remembered field. */
async function resetFocus(page) {
  await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
}

/** The tabs of the shell, in the order a visitor meets them. */
async function tabLabels(page) {
  return (await page.locator('[role="tab"]').allInnerTexts()).map((label) => label.trim());
}

test("clavier : chaque écran du foyer s'atteint et s'ouvre sans souris", { timeout: 90_000 }, async (t) => {
  const opened = await openPage(app.browser, app.base, "/envelopes/");
  const { page, errors } = opened;
  await resetFocus(page);

  const labels = await tabLabels(page);
  assert.ok(labels.length >= 6, `the shell has its screens, got ${labels.join(", ")}`);
  for (const label of labels) {
    const at = await tabTo(page, (stop) => stop.role === "tab" && stop.label === label);
    assert.equal(at.outlineStyle, "solid", `the focus ring is visible on "${label}"`);
    assert.equal(at.outline, "2px", `the focus ring is 2px on "${label}" (got ${at.outline})`);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
    const selected = (await page.locator('[role="tab"][aria-selected="true"]').innerText()).trim();
    assert.equal(selected, label, `Enter opens "${label}"`);
    const selectedId = await page.locator('[role="tab"][aria-selected="true"]').getAttribute("id");
    const panel = await page.locator('[role="tabpanel"]').getAttribute("id");
    assert.equal(panel, selectedId?.replace(/^tab-/, "panel-"), `the panel of "${label}" is the one that is shown`);
    assert.ok((await page.locator('[role="tabpanel"]').innerText()).trim().length > 20, `"${label}" renders content`);
  }

  /** The file field of the import wizard is reachable too: the gesture starts on the keyboard. */
  const importTab = labels.find((label) => /import/i.test(label));
  assert.ok(importTab !== undefined, "the shell has an import screen");
  await tabTo(page, (stop) => stop.role === "tab" && stop.label === importTab);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  const field = await tabTo(page, (stop) => stop.tag === "input" && stop.role !== "tab", 30);
  assert.equal(field.tag, "input", "the file field is reachable by Tab alone");

  assert.deepEqual(errors, [], `no console error, got ${errors[0] ?? "none"}`);
  t.diagnostic(`${labels.length} screens opened with Enter, file field reached with Tab`);
  await closePage(opened);
});

test("clavier : le reçu du fonds se vérifie et la page se publie sans souris", { timeout: 90_000 }, async (t) => {
  const opened = await openPage(app.browser, app.base, "/mutual-aid/");
  const { page, errors } = opened;
  await resetFocus(page);

  const publishTab = await tabTo(page, (stop) => stop.role === "tab" && /publish/i.test(stop.label));
  assert.equal(publishTab.outline, "2px", "the focus ring is visible on the tab");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);

  const verify = await tabTo(page, (stop) => stop.tag === "button" && stop.role !== "tab" && stop.label.startsWith("Verify"));
  assert.equal(verify.outline, "2px", "the focus ring is visible on Verify");
  await page.keyboard.press("Enter");
  const verdict = page.getByRole("status").first();
  await verdict.waitFor({ state: "visible" });
  assert.match(await verdict.innerText(), /Verified — Entry #\d+ confirmed/, "Enter verifies the prefilled receipt");

  const publish = await tabTo(page, (stop) => stop.tag === "button" && stop.role !== "tab" && stop.label === "Publish");
  await page.keyboard.press("Enter");
  await page.locator("a[download]").waitFor({ state: "visible" });
  assert.match(await page.locator("a[download]").getAttribute("href"), /^blob:/, "Enter publishes the page");

  assert.deepEqual(errors, [], `no console error, got ${errors[0] ?? "none"}`);
  t.diagnostic("receipt verified and page published with Enter only");
  await closePage(opened);
});

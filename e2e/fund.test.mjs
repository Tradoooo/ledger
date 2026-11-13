/** The fund gesture, on the BUILT site: type an entry, check a receipt, publish the public page.
 *
 * The three acts of the video's second half: a hand-written aid, the donor's receipt answered
 * offline, and the standalone page a donor keeps.
 */
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { closePage, openPage, start } from "./support.mjs";

let app;
before(async () => { app = await start(); });
after(async () => { await app.close(); });

/** The demo book the fund ships: 214 chained entries, built in the browser, no request. */
const DEMO_ENTRIES = 214;

test("fonds : saisir une écriture, vérifier un reçu, publier", { timeout: 120_000 }, async (t) => {
  const opened = await openPage(app.browser, app.base, "/mutual-aid/");
  const { page, errors, foreign } = opened;

  const form = page.locator("form.bb-card").first();
  await form.waitFor({ state: "visible" });
  /* 1 — the entry, typed by hand: an aid paid out of the fund. */
  await page.getByRole("button", { name: "Aid", exact: true }).click();
  await form.getByLabel("Date").fill("2026-11-13");
  await form.getByLabel("Note").fill("Aide alimentaire — e2e");
  await form.getByLabel("Amount").fill("42.50");
  const selects = form.locator("select");
  await selects.nth(0).selectOption({ index: 0 });
  await selects.nth(1).selectOption({ index: 1 });
  assert.match((await form.locator("table.bb-table").innerText()).replace(/\s+/g, " "), /Σ €0\.00/, "the sum is zero before the click");
  await form.getByRole("button", { name: "Save entry" }).click();

  const notice = page.getByRole("status").first();
  await notice.waitFor({ state: "visible" });
  assert.match(await notice.innerText(), new RegExp(`Entry #${DEMO_ENTRIES} added`), "the entry is appended, and the chain recomputed");

  await page.getByRole("tab", { name: "Ledger" }).click();
  assert.match(await page.locator("main h2").first().innerText(), new RegExp(`— ${DEMO_ENTRIES + 1} entries`), "the ledger holds one more entry");

  /* 2 — the donor's receipt: two strings, one verifiable answer, offline. */
  await page.getByRole("tab", { name: "Publish" }).click();
  const publish = page.locator("main");
  await publish.getByRole("button", { name: "Verify" }).click();
  const verdict = page.getByRole("status").first();
  await verdict.waitFor({ state: "visible" });
  const verified = await verdict.innerText();
  assert.match(verified, /Verified — Entry #\d+ confirmed/, `the receipt answers by the chain: ${verified}`);

  /* A wrong hash must be refused with its reason, not silently accepted. */
  const hashField = page.locator("main input").nth(1);
  await hashField.fill("0".repeat(64));
  await publish.getByRole("button", { name: "Verify" }).click();
  await page.waitForTimeout(150);
  const refused = await page.getByRole("status").first().innerText();
  assert.match(refused, /Not found/, `a forged receipt is not found: ${refused}`);

  /* 3 — publication: one standalone file, delivered as a blob, no server. */
  await publish.getByRole("button", { name: "Publish", exact: true }).click();
  const download = page.locator("a[download]");
  await download.waitFor({ state: "visible" });
  assert.equal(await download.getAttribute("download"), "mutual-aid-public-page.html");
  assert.match(await download.getAttribute("href"), /^blob:/, "the public page is built in the browser, never fetched");

  assert.deepEqual(errors, [], `no console error, got ${errors[0] ?? "none"}`);
  assert.deepEqual(foreign, [], `no foreign request, got ${foreign[0] ?? "none"}`);
  t.diagnostic(`receipt: ${verified.replace(/\s+/g, " ")}`);
  await closePage(opened);
});

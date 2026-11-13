/** The household gesture, on the BUILT site: correct an assignment, see the learned rule, read the number.
 *
 * The fixture is the real one (`fixtures/household-3y.csv`, 12 000 lines, Windows-1252, `;`,
 * decimal comma): the same file the video shows being dropped on the phone. Nothing is uploaded,
 * nothing is fetched: the test watches the network too.
 */
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { bandValue, closePage, openPage, start } from "./support.mjs";

const IMPORT_TIMEOUT = 180_000;
const BOOK_KEY = "ledger:envelopes:v1";

let app;
before(async () => { app = await start(); });
after(async () => { await app.close(); });

/** `6,44 €` → 644 : the figure is read as a visitor reads it, then compared as a number. */
function euros(text) {
  const digits = text.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  return Math.round(Number(digits) * 100);
}

/** The tab that holds the proposals to classify, whatever its count is today. */
async function classifyTab(page) {
  return page.getByRole("tab", { name: /classer/i });
}

/** How many proposals are waiting, read on the tab itself. */
async function pendingCount(page) {
  const label = await (await classifyTab(page)).innerText();
  const match = label.match(/\((\d+)\)/);
  return match === null ? 0 : Number(match[1]);
}

test("foyer : corriger une affectation, voir la règle apprise, lire leftToday", { timeout: 60_000 }, async (t) => {
  const opened = await openPage(app.browser, app.base, "/envelopes/");
  const { page, errors, foreign } = opened;

  /* 1 — the one number, before anything else. */
  const before = await bandValue(page);
  assert.match(before, /^-?[\d\s.,]+€$/, `leftToday is a single figure, got "${before}"`);

  /* 2 — the correction: the app proposes, the user decides, the app learns. */
  await (await classifyTab(page)).click();
  await page.waitForTimeout(300);
  const pending = await pendingCount(page);
  assert.ok(pending > 0, `the demo book has proposals waiting, got ${pending}`);

  const items = page.locator("main ul li");
  const item = items.first();
  const text = (await item.innerText()).replace(/\s+/g, " ");
  const select = item.locator("select");
  const proposed = await select.locator("option:checked").innerText();
  const options = await select.locator("option").evaluateAll((nodes) => nodes.map((node) => ({ label: node.textContent.trim(), value: node.value })));
  const target = options.find((option) => option.label !== proposed && option.label !== "À classer");
  assert.ok(target !== undefined, "another account can be chosen");
  await select.selectOption({ label: target.label });
  await item.getByRole("button", { name: /Corriger/ }).click();

  const notice = page.getByRole("status").first();
  await notice.waitFor({ state: "visible" });
  const learned = (await notice.innerText()).replace(/\s+/g, " ");
  assert.match(learned, /Règle apprise/, `the app says it learned a rule: ${learned}`);
  assert.ok(learned.includes(target.value), `the learned rule names the account ${target.value}: ${learned}`);

  const rules = page.locator("main section", { hasText: "Règles apprises" }).first();
  assert.match((await rules.innerText()).replace(/\s+/g, " "), /Règles apprises \(1\)/, "the learned rule is listed, not hidden");
  assert.equal(await pendingCount(page), pending - 1, "one proposal less: the decision is recorded");

  /* 3 — the rule is kept: the book carries it, so the next statement is classified with it. */
  const stored = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  }, BOOK_KEY);
  assert.ok(stored !== null, "the book is kept in the browser");
  assert.equal(stored.rules.length, 1, `exactly one learned rule is stored, got ${stored.rules.length}`);
  assert.equal(stored.rules[0].origin, "learned", "the stored rule is a learned one");
  assert.ok(stored.rules[0].when.value.length > 0, "the learned rule keeps the motif of the corrected note");

  /* 4 — the figure, after the correction: it is still the one number the app answers with. */
  await page.getByRole("tab", { name: "Vue d'ensemble" }).click();
  const after = await bandValue(page);
  assert.match(after, /^-?[\d\s.,]+€$/, `leftToday is still a single figure, got "${after}"`);

  assert.deepEqual(errors, [], `no console error, got ${errors[0] ?? "none"}`);
  assert.deepEqual(foreign, [], `no foreign request, got ${foreign[0] ?? "none"}`);
  t.diagnostic(`${learned} · « ${text.split(" — ")[0]} » · leftToday ${before} → ${after}`);
  await closePage(opened);
});

test("foyer : importer un relevé réel, sans rien envoyer", { timeout: IMPORT_TIMEOUT }, async (t) => {
  const opened = await openPage(app.browser, app.base, "/envelopes/");
  const { page, errors, foreign } = opened;
  const pendingBefore = await pendingCount(page);

  await page.getByRole("tab", { name: "Import" }).click();
  await page.locator('main input[type="file"]').setInputFiles("fixtures/household-3y.csv");
  await page.waitForFunction(
    () => /séparateur/.test(document.querySelector("main")?.innerText ?? ""),
    null, { timeout: 30_000 },
  );
  const detected = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  assert.match(detected, /séparateur/, "the separator is detected before anything is imported");
  assert.match(detected, /décimale ,/, "the decimal comma is detected");
  assert.match(detected, /Rien d'importé/, "nothing is imported before the confirm click");

  await page.locator("main button").filter({ hasText: /^Importer/ }).first().click();
  await page.waitForFunction(
    () => /12\s?000 écriture\(s\) importée\(s\)/.test(document.querySelector("main")?.innerText ?? ""),
    null, { timeout: IMPORT_TIMEOUT },
  );
  const notice = (await page.getByRole("status").first().innerText()).replace(/\s+/g, " ");
  assert.match(notice, /12\s?000 écriture\(s\) importée\(s\)/, `the app reports the import: ${notice}`);
  assert.match(notice, /à affecter/i, "the app says what is left to do");

  const pendingAfter = await pendingCount(page);
  const waiting = pendingAfter - pendingBefore;
  assert.ok(waiting >= 11_000 && waiting < 12_000 + pendingBefore,
    `the imported spending lines are waiting to be classified (${waiting} new proposals)`);

  await page.getByRole("tab", { name: "Piste d'audit" }).click();
  const chain = page.locator("main .bb-sub").last();
  await chain.waitFor({ state: "visible" });
  assert.match((await chain.innerText()).replace(/\s+/g, " "), /Chaîne d'empreintes vérifiée : 12\s?\d{3} écriture\(s\)/, "the chain covers every imported line");

  await page.getByRole("tab", { name: "Vue d'ensemble" }).click();
  const figure = await bandValue(page);
  assert.match(figure, /^-?[\d\s.,]+€$/, `leftToday is still a single figure after the import, got "${figure}"`);

  assert.deepEqual(errors, [], `no console error, got ${errors[0] ?? "none"}`);
  assert.deepEqual(foreign, [], `no foreign request, got ${foreign[0] ?? "none"}`);
  t.diagnostic(`12 000 lines imported, ${waiting} spending lines to classify, leftToday ${figure}`);
  await closePage(opened);
});

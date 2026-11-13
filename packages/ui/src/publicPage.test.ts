import { describe, expect, it } from "vitest";
import { append, createJournal, describeError, headHash } from "@ledger/core";
import type { Entry, Journal } from "@ledger/core";
import { errorSentence } from "./errorMessage.js";
import { publicPage } from "./PublicPage.js";

const ID_A = "01HQ0000000000000000000000";
const ID_B = "01HQ0000000000000000000001";
const SAFE_NOTE = "Rent for November";
const HOSTILE_NOTE = "Gift <script>alert(\"x\")</script> & \"quotes\" > end";

/** A balanced entry: two postings, the same magnitude, opposite signs. */
function entry(id: string, note: string, amountMinor: number): Entry {
  return {
    id, date: "2026-11-03", note, unit: "EUR", kind: "transaction", reverses: null, tags: [],
    postings: [
      { id: `${id}-1`, accountId: "expenses:food", amountMinor, unit: "EUR" },
      { id: `${id}-2`, accountId: "assets:bank", amountMinor: -amountMinor, unit: "EUR" },
    ],
  };
}

function book(): Journal {
  let journal = createJournal("2026-11-01");
  journal = append(journal, entry(ID_A, SAFE_NOTE, 4820));
  journal = append(journal, entry(ID_B, HOSTILE_NOTE, 900));
  return journal;
}

function page(note?: string): string {
  return publicPage({
    title: "Annual report of the fund",
    journal: book(),
    period: "2026",
    unit: "EUR",
    locale: "en",
    ...(note === undefined ? {} : { note }),
  });
}

describe("publicPage", () => {
  it("is a standalone document: no script, no external resource, no web font", () => {
    const html = page();
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain("<style>");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("http://");
    expect(html).not.toContain("https://");
  });

  it("escapes what comes from the journal: markup stays text", () => {
    const html = page();
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;");
    expect(html).toContain("&quot;");
    expect(html).toContain("&gt;");
  });

  it("shows the entry ids, the hashes and the head of the chain", () => {
    const html = page();
    expect(html).toContain(ID_A);
    expect(html).toContain(ID_B);
    expect(html).toContain(headHash(book()));
    for (const record of book().records) expect(html).toContain(record.hash);
  });

  it("prints the title, the period, the totals and the note", () => {
    const html = page("What this chain proves.");
    expect(html).toContain("Annual report of the fund");
    expect(html).toContain("2026");
    expect(html).toContain("EUR");
    expect(html).toContain("What this chain proves.");
    expect(html).toContain("48.20");
  });
});

describe("errorSentence", () => {
  it("returns the core sentence for a code the dictionary does not know", () => {
    expect(errorSentence("NoSuchCode")).toBe(describeError("NoSuchCode"));
    expect(errorSentence("NoSuchCode")).toBe("Something went wrong; nothing was written.");
  });

  it("returns the core sentence for a code the dictionary knows", () => {
    expect(errorSentence("UnbalancedEntry", { sum: -40 })).toBe(describeError("UnbalancedEntry", { sum: -40 }));
    expect(errorSentence("UnbalancedEntry", { sum: -40 }))
      .toBe("This entry does not sum to zero. The postings sum to -40, not zero.");
    expect(errorSentence("UnbalancedEntry")).toBe(describeError("UnbalancedEntry"));
  });
});

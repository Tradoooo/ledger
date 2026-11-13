/** One sentence for one failure. The UI shows the sentence, never the code (docs/UI-API.md). */
import { describeError } from "@ledger/core";
import { t, type Locale, type MessageKey } from "./i18n.js";

/** The core codes the shared dictionary already knows how to say. */
const DICTIONARY_CODES: Readonly<Record<string, MessageKey>> = {
  UnbalancedEntry: "error.unbalanced",
  MixedUnits: "error.mixedUnits",
  BadReversal: "error.badReversal",
};

/** The locale of the shared dictionary: the sentence is written once, for everybody. */
const DEFAULT_LOCALE: Locale = "en";

/**
 * The sentence of a failure, in words.
 *
 * The core writes the English sentence and carries the numbers (the gap, the unit);
 * the dictionary translates the head of it when a key exists. Without a key the
 * core sentence is returned as it is — never the code.
 */
export function errorSentence(code: string, detail: Record<string, unknown> = {}): string {
  const full = describeError(code, detail);
  const key = DICTIONARY_CODES[code];
  if (key === undefined) return full;
  const bare = describeError(code);
  const tail = full.startsWith(bare) ? full.slice(bare.length) : "";
  return `${t(DEFAULT_LOCALE, key)}${tail}`;
}

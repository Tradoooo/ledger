/** Browser adapter: the clock and the randomness live here, never in the core (LED-N-04). */
import { ulidFactory } from "@ledger/core";

export function browserUlidFactory(): () => string {
  return ulidFactory(() => Date.now(), () => {
    const buffer = new Uint8Array(10);
    globalThis.crypto.getRandomValues(buffer);
    return buffer;
  });
}

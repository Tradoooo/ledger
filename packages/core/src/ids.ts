/** ULID: sortable identifiers. The clock and the randomness are injected (LED-N-04). */
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Encode 16 bytes (10 for time + 6 for randomness is not needed: we take 48 bits + 80 bits). */
export function ulidFrom(timeMs: number, random: readonly number[]): string {
  if (random.length < 10) throw new Error("ulidFrom needs 10 random bytes");
  let time = Math.floor(timeMs);
  let head = "";
  for (let index = 0; index < 10; index++) {
    head = CROCKFORD[time % 32]! + head;
    time = Math.floor(time / 32);
  }
  let tail = "";
  for (const byte of random.slice(0, 10)) tail += CROCKFORD[byte % 32]! + CROCKFORD[Math.floor(byte / 32)]!;
  return head + tail.slice(0, 16);
}

/** A factory bound to a clock and a random source: two calls never return the same id. */
export function ulidFactory(clock: () => number, randomBytes: () => Uint8Array): () => string {
  let last = 0;
  return () => {
    last += 1;
    return ulidFrom(clock() + last % 1000, Array.from(randomBytes()));
  };
}

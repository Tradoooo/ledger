import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { ulidFactory, ulidFrom } from "./ids.js";
import { EntryId } from "./schema.js";

describe("ulid", () => {
  it("produces valid, unique, sortable identifiers", () => {
    let counter = 0;
    const next = ulidFactory(() => 1730592000000, () => new Uint8Array(Array.from({ length: 10 }, () => (counter++ % 31) + 1)));
    const ids = Array.from({ length: 500 }, next);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(EntryId.safeParse(id).success).toBe(true);
    expect([...ids].sort()).toEqual(ids.map((_, index) => ids[index]!));
  });

  it("property: any clock and any random bytes give a schema-valid id", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 45 }), fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 10, maxLength: 10 }), (time, random) => {
        expect(EntryId.safeParse(ulidFrom(time, random)).success).toBe(true);
      }),
      { numRuns: 200, seed: 20261113 },
    );
  });
});

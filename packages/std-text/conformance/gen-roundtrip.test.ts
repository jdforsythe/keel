// Spec: std.text, clause "For every value `gen` produces for `line({ max: 80 })`, `line({ min: 0, max: 3 })`, `para({ max: 2000 })`, `Email` and `Slug`, `parse` accepts it and `parse(encode(v))` returns it; each `line({ max: 80 })` value has 1 to 80 graphemes, and `line({ max: 80 }).doc()` is `line(1..80)`."
// Seed 1337
import type { Schema } from "@keel/schema";
import { gen } from "@keel/schema/gen";
import { Email, Slug, graphemes, line, para } from "@keel/std-text";
import fc from "fast-check";
import { expect, test } from "vitest";

function roundtrips<T>(schema: Schema<T, boolean>, arb: fc.Arbitrary<T>): void {
  fc.assert(
    fc.property(arb, (v) => {
      const first = schema.parse(v);
      expect(first.ok).toBe(true);
      const back = schema.parse(schema.encode(v));
      expect(back.ok).toBe(true);
      if (back.ok) expect(back.value).toEqual(v);
    }),
    { seed: 1337, numRuns: 100 },
  );
}

test("For every value `gen` produces for `line({ max: 80 })`, `line({ min: 0, max: 3 })`, `para({ max: 2000 })`, `Email` and `Slug`, `parse` accepts it and `parse(encode(v))` returns it; each `line({ max: 80 })` value has 1 to 80 graphemes, and `line({ max: 80 }).doc()` is `line(1..80)`.", () => {
  const l80 = line({ max: 80 });
  const l03 = line({ min: 0, max: 3 });
  const p = para({ max: 2000 });
  roundtrips(l80, gen(l80));
  roundtrips(l03, gen(l03));
  roundtrips(p, gen(p));
  roundtrips(Email, gen(Email));
  roundtrips(Slug, gen(Slug));
  fc.assert(
    fc.property(gen(l80), (v) => {
      const n = graphemes(v);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(80);
    }),
    { seed: 1337, numRuns: 100 },
  );
  expect(l80.doc()).toBe("line(1..80)");
});

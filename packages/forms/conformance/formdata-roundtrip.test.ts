// fast-check seed: 1337
import { toFormData } from "@keel/forms";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED } from "./fixtures.ts";

const Shape = s.object({
  title: s.string({ min: 1 }),
  count: s.int(),
  price: s.number(),
  done: s.boolean(),
  kind: s.enum(["a", "b", "c"]),
  note: s.string({ min: 1 }).optional(),
});

test("for every generated valid value, FormData encode then decode by the schema returns an equal value", () => {
  fc.assert(
    fc.property(Shape.gen(), (value) => {
      const fd = toFormData(Shape, value);
      expect(Shape.decodeStrings(fd)).toEqual(ok(value));
    }),
    { seed: SEED, numRuns: 200 },
  );
});

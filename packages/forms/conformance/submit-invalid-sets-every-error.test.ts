// @vitest-environment happy-dom
// fast-check seed: 1337
import fc from "fast-check";
import { expect, test } from "vitest";
import { FIELDS, INVALID, RUNS, SEED, VALID, setup } from "./fixtures.ts";

test("submitting invalid values sets an error on every invalid field", async () => {
  await fc.assert(
    fc.asyncProperty(fc.record({ title: fc.boolean(), email: fc.boolean(), age: fc.boolean() }), async (bad) => {
      fc.pre(bad.title || bad.email || bad.age);
      const h = setup();
      try {
        h.fill({
          title: bad.title ? INVALID.title : VALID.title,
          email: bad.email ? INVALID.email : VALID.email,
          age: bad.age ? INVALID.age : VALID.age,
        });
        await h.submit();
        const expected = FIELDS.filter((n) => bad[n]).sort();
        const errors = h.f.errors();
        expect(Object.keys(errors).sort()).toEqual(expected);
        for (const n of expected) expect(String(errors[n]).length).toBeGreaterThan(0);
      } finally {
        h.dispose();
      }
    }),
    { seed: SEED, numRuns: RUNS },
  );
});

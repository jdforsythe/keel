// @vitest-environment happy-dom
// fast-check seed: 1337
import fc from "fast-check";
import { expect, test } from "vitest";
import { FIELDS, INVALID, RUNS, SEED, VALID, setup } from "./fixtures.ts";

test("submitting invalid values sends no request", async () => {
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
        expect(h.calls.length).toBe(0);
      } finally {
        h.dispose();
      }
    }),
    { seed: SEED, numRuns: RUNS },
  );
  expect(FIELDS.length).toBe(3);
});

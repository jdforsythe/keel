// @vitest-environment happy-dom
// fast-check seed: 1337
import fc from "fast-check";
import { expect, test } from "vitest";
import { FIELDS, INVALID, RUNS, SEED, VALID, fieldInput, setup } from "./fixtures.ts";

test("submitting invalid values focuses the first invalid field in document order", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.shuffledSubarray([...FIELDS], { minLength: 3, maxLength: 3 }),
      fc.record({ title: fc.boolean(), email: fc.boolean(), age: fc.boolean() }),
      async (order, bad) => {
        fc.pre(bad.title || bad.email || bad.age);
        const h = setup({ order });
        try {
          h.fill({
            title: bad.title ? INVALID.title : VALID.title,
            email: bad.email ? INVALID.email : VALID.email,
            age: bad.age ? INVALID.age : VALID.age,
          });
          await h.submit();
          const first = order.find((n) => bad[n]);
          expect(first).toBeDefined();
          expect(document.activeElement).toBe(fieldInput(h.root, first ?? ""));
        } finally {
          h.dispose();
        }
      },
    ),
    { seed: SEED, numRuns: RUNS },
  );
});

// @vitest-environment happy-dom
// fast-check seed: 1337
import { err } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { FIELDS, RUNS, SEED, VALID, setup } from "./fixtures.ts";

const subset = fc.subarray([...FIELDS]);

test("a keel.fields response sets exactly the listed field errors and clears all others", async () => {
  await fc.assert(
    fc.asyncProperty(subset, subset, async (first, second) => {
      const h = setup();
      try {
        h.fill(VALID);
        const reply = (names: readonly string[]) =>
          err({
            code: "keel.fields",
            message: "fields",
            data: Object.fromEntries(names.map((n) => [n, `bad ${n}`])),
          });
        h.handler.current = () => reply(first);
        await h.submit();
        expect(Object.keys(h.f.errors()).sort()).toEqual([...first].sort());
        h.handler.current = () => reply(second);
        await h.submit();
        const errors = h.f.errors();
        expect(Object.keys(errors).sort()).toEqual([...second].sort());
        for (const n of second) expect(errors[n]).toBe(`bad ${n}`);
      } finally {
        h.dispose();
      }
    }),
    { seed: SEED, numRuns: RUNS },
  );
});

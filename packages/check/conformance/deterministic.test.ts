// Seed 1337
// Spec: k.check, clause "Two runs on an unchanged tree produce identical output."
import { check, format } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { FIXTURES, one, SEED } from "./support.ts";

test("two runs on an unchanged tree produce identical output", () => {
  fc.assert(
    fc.property(fc.subarray(FIXTURES, { minLength: 1 }), fc.constantFrom("compact", "json", "pretty"), (fxs, mode) => {
      const files = fxs.map((f, i) => ({ path: `f${i}.tsx`, source: f.bad }));
      const a = check(files, {});
      const b = check(files, {});
      expect(b).toEqual(a);
      expect(format(b.diagnostics, { mode })).toBe(format(a.diagnostics, { mode }));
    }),
    { seed: SEED, numRuns: 25 },
  );
});

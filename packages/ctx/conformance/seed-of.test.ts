// Spec: k.ctx, clause "`seedOf(ctx)` is the seed given to `createCtx`, and `undefined` when none was given." (rfc:0070; red-team 0213)
// Seed 1337.
import { createCtx, seedOf } from "@keel/ctx";
import type { Mode } from "@keel/ctx";
import fc from "fast-check";
import { expect, test } from "vitest";

test("seedOf(ctx) is the seed given to createCtx, in every mode", () => {
  fc.assert(
    fc.property(fc.nat(), fc.constantFrom<Mode>("sim", "shell", "real"), (seed, mode) => {
      expect(seedOf(createCtx({ mode, seed }))).toBe(seed);
    }),
    { seed: 1337, numRuns: 100 },
  );
});

test("seedOf(ctx) is undefined when no seed was given, in every mode", () => {
  for (const mode of ["sim", "shell", "real"] satisfies Mode[]) expect(seedOf(createCtx({ mode }))).toBeUndefined();
  expect(seedOf(createCtx({}))).toBeUndefined();
});

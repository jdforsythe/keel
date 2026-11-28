// Spec: k.attempt, clause "`attempt(() => 1)` does not compile, and called untyped with one argument it throws a value `isDefect(v, 'E1452')` accepts; the type of `attempt(() => (c ? 1 : err(T)), expect)` is `Result<number, typeof T | E>` for `expect` returning `E | undefined`."
// Seed 1337. The compile-time half is attempt-types.test-d.ts.
import { attempt, isDefect } from "@keel/schema";
import fc from "fast-check";
import { expect, it } from "vitest";
import { RUNS, SEED } from "./fixtures";

const call = (...args: unknown[]): unknown => {
  try {
    return Reflect.apply(attempt, undefined, args);
  } catch (e) {
    return e;
  }
};

it("called untyped with one argument, attempt throws a value isDefect(v, 'E1452') accepts", () => {
  const v = call(() => 1);
  expect(isDefect(v, "E1452")).toBe(true);
});

it("property: whatever the one argument is, attempt called with it throws an E1452 defect", () => {
  fc.assert(
    fc.property(fc.anything(), (x) => {
      expect(isDefect(call(x), "E1452")).toBe(true);
    }),
    { seed: SEED, numRuns: RUNS },
  );
});

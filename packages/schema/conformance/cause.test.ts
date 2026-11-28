// Spec: k.attempt, clause "With `A = s.error('m.a', s.object({ n: s.int() }))` and `B = s.error('m.b', s.object({}))`: `B.causedBy(A.make({ n: 1 }), {})` has `cause` deep-equal to `A.make({ n: 1 })` and round-trips JSON; `A.in` of it is that cause, `A.in(B.make({}))` is `undefined`, and `A.in` of an error whose only `m.a` is 9 steps down is `undefined`."
// Seed 1337.
import { s } from "@keel/schema";
import type { KeelError } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RUNS, SEED } from "./fixtures";

const opts = { seed: SEED, numRuns: RUNS };
const A = s.error("m.a", s.object({ n: s.int() }));
const B = s.error("m.b", s.object({}));

/** `inner` under `k` wrappers of `B`, the outermost first. */
const under = (k: number, inner: KeelError<string, unknown>): KeelError<string, unknown> => {
  let e = inner;
  for (let i = 0; i < k; i++) e = B.causedBy(e, {});
  return e;
};

describe("k.attempt: causedBy and in", () => {
  it("B.causedBy(A.make({ n: 1 }), {}) has cause deep-equal to A.make({ n: 1 }) and round-trips JSON", () => {
    const e = B.causedBy(A.make({ n: 1 }), {});
    expect(e.cause).toEqual(A.make({ n: 1 }));
    expect(e.code).toBe("m.b");
    expect(JSON.parse(JSON.stringify(e))).toEqual(e);
  });

  it("A.in of it is that cause", () => {
    const e = B.causedBy(A.make({ n: 1 }), {});
    expect(A.in(e)).toEqual(A.make({ n: 1 }));
  });

  it("A.in(B.make({})) is undefined", () => {
    expect(A.in(B.make({}))).toBeUndefined();
  });

  it("A.in of an error whose only m.a is 9 steps down is undefined", () => {
    expect(A.in(under(9, A.make({ n: 1 })))).toBeUndefined();
  });

  it("property: a wrapped failure is still the failure it wraps, however often it was wrapped within 7 steps", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 7 }), fc.integer({ min: -1000, max: 1000 }), (k, n) => {
        expect(A.in(under(k, A.make({ n })))?.data.n).toBe(n);
      }),
      opts,
    );
  });

  it("property: A.in of an error is it itself when it has A's code, and a chain with no m.a gives undefined", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 7 }), fc.integer({ min: -9, max: 9 }), (k, n) => {
        const a = A.make({ n });
        expect(A.in(a)).toEqual(a);
        expect(A.in(under(k, B.make({})))).toBeUndefined();
      }),
      opts,
    );
  });
});

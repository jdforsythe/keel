// Spec: k.attempt, clause "`err(e)` takes a `KeelError` and nothing else. Any other value (an `Error`, a string, an object without a string `code`, a string `message` and an own `data`) is E1458 at check and, at run time, the defect E1458."
// Spec: k.attempt, clause "In `modules/m/a.ts`, `err(new Error('x'))`, `err('x')` and `err({ code: 'a.b' })` are one E1458 each at the argument; `err(T)` is none; called untyped, `err('x')` throws a value `isDefect(v, 'E1458')` accepts."
// Seed 1337. The compile-time half is attempt-types.test-d.ts; the check half is packages/check/conformance/attempt-rules.test.ts.
import { err, isDefect } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RUNS, SEED } from "./fixtures";

const opts = { seed: SEED, numRuns: RUNS };
const call = (x: unknown): unknown => {
  try {
    return Reflect.apply(err, undefined, [x]);
  } catch (e) {
    return e;
  }
};
const isKeelError = (x: unknown): boolean =>
  typeof x === "object" &&
  x !== null &&
  typeof Reflect.get(x, "code") === "string" &&
  typeof Reflect.get(x, "message") === "string" &&
  Object.hasOwn(x, "data");

describe("k.attempt: err takes a KeelError and nothing else", () => {
  it("called untyped, err('x') throws a value isDefect(v, 'E1458') accepts", () => {
    expect(isDefect(call("x"), "E1458")).toBe(true);
  });

  it("err(new Error('x')) and err({ code: 'a.b' }) are the defect E1458", () => {
    expect(isDefect(call(new Error("x")), "E1458")).toBe(true);
    expect(isDefect(call({ code: "a.b" }), "E1458")).toBe(true);
  });

  it("err of an object holding code and message but no own data is the defect E1458", () => {
    expect(isDefect(call({ code: "a.b", message: "m" }), "E1458")).toBe(true);
    expect(isDefect(call(Object.create({ data: 1 })), "E1458")).toBe(true);
  });

  it("property: err of any value that is no KeelError is the defect E1458", () => {
    fc.assert(
      fc.property(
        fc.anything().filter((x) => !isKeelError(x)),
        (x) => {
          expect(isDefect(call(x), "E1458")).toBe(true);
        },
      ),
      opts,
    );
  });

  it("property: err of a KeelError is { ok: false, error } with that very error", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), fc.jsonValue(), (code, message, data) => {
        const e = { code, message, data };
        expect(call(e)).toEqual({ ok: false, error: e });
      }),
      opts,
    );
  });
});

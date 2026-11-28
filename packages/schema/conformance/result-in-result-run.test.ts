// Spec: k.attempt, clause "Called untyped, `ok(ok(1))` and `ok(err(T))` each throw a value `isDefect(v, 'E1459')` accepts, `wrap(err(T))` with that `wrap` throws one too, and `ok({ ok: true, value: 1 })` is `ok` of that plain object; `await attempt(async () => ok(await attempt(f, expect)), expect)` rejects with such a defect and never resolves to a value whose `value` holds an `ok` key."
// Seed 1337. Called untyped: the file reaches `ok` through an `unknown`-typed binding, as the clause says. The check half is packages/check/conformance/result-in-result.test.ts.
import { attempt, err, isDefect, ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RUNS, SEED } from "./fixtures";

const T = s.error("m.t", s.object({})).make({});
const okU: unknown = ok;
const call = (f: unknown, ...args: unknown[]): unknown => {
  try {
    return Reflect.apply(Object(f), undefined, args);
  } catch (e) {
    return e;
  }
};
const wrap = (v: unknown): unknown => call(okU, v);
const never = (x: unknown) => (x instanceof RangeError ? T : undefined);

describe("k.attempt: a Result holds no Result (run time)", () => {
  it("called untyped, ok(ok(1)) throws a value isDefect(v, 'E1459') accepts", () => {
    expect(isDefect(wrap(ok(1)), "E1459")).toBe(true);
  });

  it("called untyped, ok(err(T)) throws a value isDefect(v, 'E1459') accepts", () => {
    expect(isDefect(wrap(err(T)), "E1459")).toBe(true);
  });

  it("`wrap(err(T))` with `function wrap<V>(v: V) { return ok(v) }` throws one too", () => {
    function wrapGeneric<V>(v: V) {
      return ok(v);
    }
    expect(isDefect(call(wrapGeneric, err(T)), "E1459")).toBe(true);
  });

  it("called untyped, ok({ ok: true, value: 1 }) is ok of that plain object", () => {
    expect(wrap({ ok: true, value: 1 })).toEqual({ ok: true, value: { ok: true, value: 1 } });
  });

  it("property: ok of a keel Result throws the defect E1459; ok of any other value is ok of it", () => {
    fc.assert(
      fc.property(fc.jsonValue(), fc.boolean(), (v, wrapIt) => {
        if (wrapIt) {
          expect(isDefect(wrap(ok(v)), "E1459")).toBe(true);
          expect(isDefect(wrap(err(T)), "E1459")).toBe(true);
        } else if (!(typeof v === "object" && v !== null && "ok" in v)) {
          expect(wrap(v)).toEqual({ ok: true, value: v });
        }
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("`await attempt(async () => ok(await attempt(f, expect)), expect)` rejects with such a defect and never resolves to a value whose `value` holds an `ok` key", async () => {
    const f = async (): Promise<number> => 1;
    const nested = attempt(async () => (okU instanceof Function ? okU(await attempt(f, never)) : undefined), never);
    const settled = await nested.then(
      (v: unknown) => ({ resolved: v }),
      (e: unknown) => ({ rejected: e }),
    );
    expect("rejected" in settled && isDefect(settled.rejected, "E1459")).toBe(true);
    if ("resolved" in settled) {
      const v: unknown = settled.resolved;
      const inner = typeof v === "object" && v !== null ? Reflect.get(v, "value") : undefined;
      expect(typeof inner === "object" && inner !== null && "ok" in inner).toBe(false);
    }
  });
});

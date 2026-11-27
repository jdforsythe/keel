// Spec: k.defects, clause "`defect('no row')` throws a value `v` with `v instanceof Error`, `v.name` `Defect`, `v.message` `no row`, no own `code` or `data` property, and `isDefect(v)` true; `defect('bad key', 'E2801', { data: { key: 'a b' } })` throws one with `message` `E2801 bad key`, own `code` `E2801`, own `data` deep-equal to `{ key: 'a b' }`, `Object.keys(v)` empty, `isDefect(v, 'E2801')` true and `isDefect(v, 'E2802')` false."
// Spec: k.defects, clause "`isDefect(new Error('x'))`, `isDefect(Object.assign(new Error('x'), { name: 'Defect', code: 'E2801' }))`, `isDefect('x')` and `isDefect` of an object given every own key of a defect, symbol keys among them, by `Reflect.ownKeys` and `Object.defineProperty`, are false."
// Spec: k.defects, clause "`defect('x', { cause: c })` throws a value whose `cause` is `c` itself, for `c` a `KeelError` and for `c` an `Error`; an `async` function that calls `defect('x')` returns a promise that rejects with a value `isDefect` accepts."
// Seed 1337.
import { defect, isDefect } from "@keel/schema";
import type { KeelError } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RUNS, SEED } from "./fixtures";

const opts = { seed: SEED, numRuns: RUNS };
const thrown = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return undefined;
};
const rejected = (p: Promise<unknown>): Promise<unknown> =>
  p.then(
    () => undefined,
    (e: unknown) => e,
  );
const own = (v: unknown, k: string): PropertyDescriptor | undefined =>
  typeof v === "object" && v !== null ? Object.getOwnPropertyDescriptor(v, k) : undefined;
const code = fc.integer({ min: 1000, max: 9999 }).map((n): `E${number}` => `E${n}`);
const copyOwn = (from: object, to: object): void => {
  for (const k of Reflect.ownKeys(from)) {
    const desc = Object.getOwnPropertyDescriptor(from, k);
    if (desc !== undefined) Object.defineProperty(to, k, desc);
  }
};

describe("k.defects: what defect throws", () => {
  it("defect('no row') throws an Error named Defect, message `no row`, no own code or data, and isDefect is true", () => {
    const v = thrown(() => defect("no row"));
    expect(v instanceof Error).toBe(true);
    if (!(v instanceof Error)) return;
    expect(v.name).toBe("Defect");
    expect(v.message).toBe("no row");
    expect(own(v, "code")).toBeUndefined();
    expect(own(v, "data")).toBeUndefined();
    expect(isDefect(v)).toBe(true);
  });

  it("defect(message) has that message and no own code or data, for every message", () => {
    fc.assert(
      fc.property(fc.string(), (m) => {
        const v = thrown(() => defect(m));
        expect(v instanceof Error && v.message).toBe(m);
        expect(own(v, "code")).toBeUndefined();
        expect(isDefect(v)).toBe(true);
      }),
      opts,
    );
  });

  it("defect('bad key', 'E2801', { data: { key: 'a b' } }) throws `E2801 bad key` with own non-enumerable code and data, no enumerable keys, isDefect true for E2801 and false for E2802", () => {
    const v = thrown(() => defect("bad key", "E2801", { data: { key: "a b" } }));
    expect(v instanceof Error).toBe(true);
    if (!(v instanceof Error)) return;
    expect(v.message).toBe("E2801 bad key");
    expect(own(v, "code")?.value).toBe("E2801");
    expect(own(v, "code")?.enumerable).toBe(false);
    expect(own(v, "data")?.value).toEqual({ key: "a b" });
    expect(own(v, "data")?.enumerable).toBe(false);
    expect(Object.keys(v)).toEqual([]);
    expect(isDefect(v, "E2801")).toBe(true);
    expect(isDefect(v, "E2802")).toBe(false);
  });

  it("property: defect(message, code, { data }) is `<code> <message>`, its code and data own, isDefect true only for its code", () => {
    fc.assert(
      fc.property(fc.string(), code, code, fc.dictionary(fc.string(), fc.jsonValue()), (m, c, other, data) => {
        const v = thrown(() => defect(m, c, { data }));
        expect(v instanceof Error && v.message).toBe(`${c} ${m}`);
        expect(own(v, "data")?.value).toEqual(data);
        expect(isDefect(v, c)).toBe(true);
        expect(isDefect(v, other)).toBe(other === c);
        expect(Object.keys(v instanceof Error ? v : {})).toEqual([]);
      }),
      opts,
    );
  });
});

describe("k.defects: isDefect is the kernel's record, not a shape", () => {
  it("isDefect(new Error('x')), a hand-made Defect with a code, and isDefect('x') are false", () => {
    expect(isDefect(new Error("x"))).toBe(false);
    expect(isDefect(Object.assign(new Error("x"), { name: "Defect", code: "E2801" }))).toBe(false);
    expect(isDefect("x")).toBe(false);
  });

  it("isDefect of an object given every own key of a defect, symbol keys among them, is false", () => {
    fc.assert(
      fc.property(fc.string(), code, (m, c) => {
        const d = thrown(() => defect(m, c, { data: { a: 1 } }));
        if (!(d instanceof Error)) throw new Error("not a defect");
        const copy = new Error(m);
        copyOwn(d, copy);
        expect(isDefect(copy)).toBe(false);
        expect(isDefect(copy, c)).toBe(false);
        const plain = Object.create(Object.getPrototypeOf(d));
        copyOwn(d, plain);
        expect(isDefect(plain)).toBe(false);
      }),
      opts,
    );
  });

  it("isDefect is false of any value defect did not throw", () => {
    fc.assert(
      fc.property(fc.anything(), (x) => {
        expect(isDefect(x)).toBe(false);
      }),
      opts,
    );
  });
});

describe("k.defects: cause and async", () => {
  it("defect('x', { cause: c }) throws a value whose cause is c itself, for a KeelError", () => {
    const c: KeelError<"a.b", { n: number }> = { code: "a.b", message: "a.b", data: { n: 1 } };
    const v = thrown(() => defect("x", { cause: c }));
    expect(v instanceof Error && v.cause).toBe(c);
  });

  it("defect('x', { cause: c }) throws a value whose cause is c itself, for an Error", () => {
    const c = new Error("inner");
    const v = thrown(() => defect("x", { cause: c }));
    expect(v instanceof Error && v.cause).toBe(c);
  });

  it("defect('x', 'E2801', { data, cause }) carries both", () => {
    const c = new RangeError("r");
    const v = thrown(() => defect("x", "E2801", { data: { id: 1 }, cause: c }));
    expect(v instanceof Error && v.cause).toBe(c);
    expect(own(v, "data")?.value).toEqual({ id: 1 });
  });

  it("an async function that calls defect('x') returns a promise that rejects with a value isDefect accepts", async () => {
    const p = (async () => {
      defect("x");
    })();
    expect(isDefect(await rejected(p))).toBe(true);
  });
});

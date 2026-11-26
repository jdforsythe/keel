// Spec: k.errors, clause "`defect('no row 3')` throws a value `v` with `v instanceof Error`, `v.name` `Defect`, `v.message` `no row 3`, no own `code` property, and `isDefect(v)` true; `defect('bad key', 'E2801')` throws one with `message` `E2801 bad key`, own `code` `E2801`, `Object.keys(v)` not holding `code`, `isDefect(v, 'E2801')` true and `isDefect(v, 'E2802')` false; `isDefect(new Error('x'))`, `isDefect(Object.assign(new Error('x'), { name: 'Defect' }))` and `isDefect('x')` are false."
// Spec: k.errors, clause "`attempt(() => defect('bad key', 'E2801'))` is `err` with code `keel.unexpected` and `data.cause` `Defect: E2801 bad key`; an `async` function that calls `defect('x')` returns a promise that rejects with a value `isDefect` accepts."
// Seed 1337.
import { attempt, defect, isDefect } from "@keel/schema";
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
const ownCode = (v: Error): unknown => Object.getOwnPropertyDescriptor(v, "code")?.value;
const code = fc.integer({ min: 1000, max: 9999 }).map((n): `E${number}` => `E${n}`);

describe("k.errors: defect", () => {
  it("defect('no row 3') throws an Error named Defect, message `no row 3`, no own code, and isDefect is true", () => {
    const v = thrown(() => defect("no row 3"));
    expect(v instanceof Error).toBe(true);
    if (!(v instanceof Error)) return;
    expect(v.name).toBe("Defect");
    expect(v.message).toBe("no row 3");
    expect(Object.hasOwn(v, "code")).toBe(false);
    expect(isDefect(v)).toBe(true);
  });

  it("defect(message) throws an Error named Defect with that message, no own code, for every message", () => {
    fc.assert(
      fc.property(fc.string(), (m) => {
        const v = thrown(() => defect(m));
        expect(v instanceof Error).toBe(true);
        if (!(v instanceof Error)) return;
        expect(v.name).toBe("Defect");
        expect(v.message).toBe(m);
        expect(Object.hasOwn(v, "code")).toBe(false);
        expect(isDefect(v)).toBe(true);
      }),
      opts,
    );
  });

  it("defect('bad key', 'E2801') throws message `E2801 bad key`, own code E2801 not enumerable, isDefect(v, 'E2801') true and isDefect(v, 'E2802') false", () => {
    const v = thrown(() => defect("bad key", "E2801"));
    expect(v instanceof Error).toBe(true);
    if (!(v instanceof Error)) return;
    expect(v.message).toBe("E2801 bad key");
    expect(Object.hasOwn(v, "code")).toBe(true);
    expect(ownCode(v)).toBe("E2801");
    expect(Object.keys(v)).not.toContain("code");
    expect(isDefect(v, "E2801")).toBe(true);
    expect(isDefect(v, "E2802")).toBe(false);
  });

  it("defect(message, code) throws `<code> <message>` with own non-enumerable code, true only for its own code, for every message and code", () => {
    fc.assert(
      fc.property(fc.string(), code, code, (m, c, other) => {
        const v = thrown(() => defect(m, c));
        expect(v instanceof Error).toBe(true);
        if (!(v instanceof Error)) return;
        expect(v.name).toBe("Defect");
        expect(v.message).toBe(`${c} ${m}`);
        expect(ownCode(v)).toBe(c);
        expect(Object.keys(v)).not.toContain("code");
        expect(isDefect(v)).toBe(true);
        expect(isDefect(v, c)).toBe(true);
        expect(isDefect(v, other)).toBe(other === c);
      }),
      opts,
    );
  });

  it("isDefect(new Error('x')), isDefect(Object.assign(new Error('x'), { name: 'Defect' })) and isDefect('x') are false", () => {
    expect(isDefect(new Error("x"))).toBe(false);
    expect(isDefect(Object.assign(new Error("x"), { name: "Defect" }))).toBe(false);
    expect(isDefect("x")).toBe(false);
  });

  it("isDefect is false of any value defect did not throw", () => {
    fc.assert(
      fc.property(fc.anything(), fc.string(), (x, m) => {
        expect(isDefect(x)).toBe(false);
        expect(isDefect(Object.assign(new Error(m), { name: "Defect", code: "E2801" }), "E2801")).toBe(false);
      }),
      opts,
    );
  });
});

describe("k.errors: defect through attempt and async", () => {
  it("attempt(() => defect('bad key', 'E2801')) is err keel.unexpected with data.cause `Defect: E2801 bad key`", () => {
    const r = attempt(() => defect("bad key", "E2801"));
    expect(r).toMatchObject({
      ok: false,
      error: { code: "keel.unexpected", data: { cause: "Defect: E2801 bad key" } },
    });
  });

  it("attempt without expect makes any defect keel.unexpected with data.cause `Defect: <its message>`", () => {
    fc.assert(
      fc.property(fc.string(), (m) => {
        const r = attempt(() => defect(m));
        expect(r).toMatchObject({ ok: false, error: { code: "keel.unexpected", data: { cause: `Defect: ${m}` } } });
      }),
      opts,
    );
  });

  it("an async function that calls defect('x') returns a promise that rejects with a value isDefect accepts", async () => {
    const p = (async () => {
      defect("x");
    })();
    expect(isDefect(await rejected(p))).toBe(true);
  });
});
